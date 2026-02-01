import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Module } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { Queue, Worker } from 'bullmq';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/database/prisma.service';
import { HealthModule } from '../../src/common/health/health.module';
import { JobsModule } from '../../src/modules/jobs/jobs.module';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { SubscriptionStatus, UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { startPostgresContainer, startRedisContainer, stopAllContainers, getRedisConfig } from '../helpers/testContainers';
import crypto from 'crypto';

/**
 * TASK-016: Webhook → Queue → Worker → Database Flow Test
 * 
 * Tests end-to-end webhook processing flow:
 * 1. Webhook received and verified
 * 2. Job enqueued in BullMQ
 * 3. Worker processes job
 * 4. Data persisted to database
 * 5. Idempotency check prevents duplicate processing
 * 
 * Coverage:
 * - Webhook signature verification
 * - Job queue integration
 * - Worker processing
 * - Database persistence
 * - Idempotency (duplicate webhook handling)
 */
describe('Webhook Queue Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let queue: Queue;
  let worker: Worker;

  // Test data
  let organizationId: string;
  let channelId: string;
  let webhookSecret: string;

  @Module({})
  class MockHealthModule {}

  @Module({})
  class MockJobsModule {}

  beforeAll(async () => {
    // Start test containers
    await startPostgresContainer();
    await startRedisContainer();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(HealthModule)
      .useModule(MockHealthModule)
      .overrideModule(JobsModule)
      .useModule(MockJobsModule)
      .overrideProvider(DiscoveryService)
      .useValue({ explore: () => [], getControllers: () => [], getProviders: () => [] })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Setup queue and worker
    const redisConfig = getRedisConfig();
    queue = new Queue('order-webhooks', {
      connection: {
        host: redisConfig.host,
        port: redisConfig.port,
        maxRetriesPerRequest: null,
      },
    });

    // Create worker to process jobs
    worker = new Worker(
      'order-webhooks',
      async (job) => {
        // Simulate order processing
        const { orderId, channelId, organizationId, webhookData } = job.data;
        
        // Create order in database
        await prisma.order.create({
          data: {
            id: orderId,
            channelId,
            organizationId,
            externalOrderId: webhookData.externalOrderId,
            status: 'NEW',
            customerEmail: webhookData.customerEmail,
            customerName: webhookData.customerName,
            totalAmount: webhookData.totalAmount,
            currencyCode: 'USD',
          },
        });

        return { success: true, orderId };
      },
      {
        connection: {
          host: redisConfig.host,
          port: redisConfig.port,
          maxRetriesPerRequest: null,
        },
      },
    );

    // Seed test organization
    const org = await prisma.organization.create({
      data: {
        name: 'Test Org - Webhook Flow',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
    });
    organizationId = org.id;

    // Create channel with webhook secret
    webhookSecret = 'test-webhook-secret-' + uuidv4();
    const channel = await prisma.channel.create({
      data: {
        name: 'Test Channel',
        type: 'SHOPIFY',
        organizationId,
        config: {
          webhookSecret,
        },
      },
    });
    channelId = channel.id;
  }, 60000);

  afterAll(async () => {
    // Stop worker and queue
    await worker.close();
    await queue.close();

    // Cleanup test data
    await prisma.order.deleteMany({ where: { organizationId } });
    await prisma.processedWebhookEvent.deleteMany({ where: { organizationId } });
    await prisma.channel.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });

    await app.close();
    await stopAllContainers();
  });

  /**
   * Generate HMAC signature for webhook
   */
  function generateWebhookSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');
  }

  describe('Webhook Reception', () => {
    it('should reject webhook with invalid signature', async () => {
      const payload = {
        orderId: uuidv4(),
        customerEmail: 'test@test.com',
      };

      await request(app.getHttpServer())
        .post(`/webhooks/shopify/${channelId}`)
        .set('X-Shopify-Hmac-SHA256', 'invalid-signature')
        .send(payload)
        .expect(401);
    });

    it('should accept webhook with valid signature and enqueue job', async () => {
      const externalOrderId = `SHOP-${Date.now()}`;
      const payload = {
        id: externalOrderId,
        email: 'customer@test.com',
        customer: {
          first_name: 'Test',
          last_name: 'Customer',
        },
        total_price: '99.99',
        currency: 'USD',
      };

      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, webhookSecret);

      const response = await request(app.getHttpServer())
        .post(`/webhooks/shopify/${channelId}`)
        .set('X-Shopify-Hmac-SHA256', signature)
        .set('X-Shopify-Topic', 'orders/create')
        .send(payload)
        .expect(202);

      expect(response.body.message).toContain('accepted');

      // Verify job was enqueued
      const jobs = await queue.getJobs(['waiting', 'active']);
      expect(jobs.length).toBeGreaterThan(0);
    });
  });

  describe('Queue Processing', () => {
    it('should process webhook job and create order', async () => {
      const orderId = uuidv4();
      const externalOrderId = `SHOP-${Date.now()}`;

      // Add job to queue
      const job = await queue.add('process-order', {
        orderId,
        channelId,
        organizationId,
        webhookData: {
          externalOrderId,
          customerEmail: 'test@test.com',
          customerName: 'Test Customer',
          totalAmount: 49.99,
        },
      });

      // Wait for job to complete
      await job.waitUntilFinished(queue.events, 10000);

      // Verify order was created in database
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      expect(order).toBeDefined();
      expect(order?.externalOrderId).toBe(externalOrderId);
      expect(order?.customerEmail).toBe('test@test.com');
      expect(order?.status).toBe('NEW');
    });

    it('should handle job failure gracefully', async () => {
      const job = await queue.add('process-order', {
        orderId: 'invalid-id',
        channelId: 'invalid-channel',
        organizationId: 'invalid-org',
        webhookData: {},
      });

      // Job should fail
      await expect(
        job.waitUntilFinished(queue.events, 10000)
      ).rejects.toThrow();

      // Verify job is in failed state
      const state = await job.getState();
      expect(state).toBe('failed');
    });
  });

  describe('Idempotency', () => {
    it('should prevent duplicate webhook processing', async () => {
      const webhookId = `webhook-${uuidv4()}`;
      const externalOrderId = `SHOP-${Date.now()}`;

      // First webhook
      await prisma.processedWebhookEvent.create({
        data: {
          webhookId,
          channelId,
          organizationId,
          eventType: 'orders/create',
          processedAt: new Date(),
        },
      });

      const payload = {
        id: externalOrderId,
        email: 'customer@test.com',
        total_price: '99.99',
      };

      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, webhookSecret);

      // Send duplicate webhook
      const response = await request(app.getHttpServer())
        .post(`/webhooks/shopify/${channelId}`)
        .set('X-Shopify-Hmac-SHA256', signature)
        .set('X-Shopify-Webhook-Id', webhookId)
        .set('X-Shopify-Topic', 'orders/create')
        .send(payload)
        .expect(200);

      expect(response.body.message).toContain('already processed');
    });

    it('should process new webhook after previous success', async () => {
      const webhookId1 = `webhook-${uuidv4()}`;
      const webhookId2 = `webhook-${uuidv4()}`;
      const externalOrderId1 = `SHOP-${Date.now()}-1`;
      const externalOrderId2 = `SHOP-${Date.now()}-2`;

      // First webhook
      await prisma.processedWebhookEvent.create({
        data: {
          webhookId: webhookId1,
          channelId,
          organizationId,
          eventType: 'orders/create',
          processedAt: new Date(),
        },
      });

      // Send second, different webhook
      const payload = {
        id: externalOrderId2,
        email: 'customer2@test.com',
        total_price: '79.99',
      };

      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, webhookSecret);

      const response = await request(app.getHttpServer())
        .post(`/webhooks/shopify/${channelId}`)
        .set('X-Shopify-Hmac-SHA256', signature)
        .set('X-Shopify-Webhook-Id', webhookId2)
        .set('X-Shopify-Topic', 'orders/create')
        .send(payload)
        .expect(202);

      expect(response.body.message).toContain('accepted');
    });
  });

  describe('End-to-End Flow', () => {
    it('should complete full webhook → queue → worker → database flow', async () => {
      const orderId = uuidv4();
      const externalOrderId = `SHOP-E2E-${Date.now()}`;
      const webhookId = `webhook-e2e-${uuidv4()}`;

      // Step 1: Receive webhook
      const payload = {
        id: externalOrderId,
        email: 'e2e@test.com',
        customer: {
          first_name: 'E2E',
          last_name: 'Test',
        },
        total_price: '199.99',
        currency: 'USD',
      };

      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, webhookSecret);

      await request(app.getHttpServer())
        .post(`/webhooks/shopify/${channelId}`)
        .set('X-Shopify-Hmac-SHA256', signature)
        .set('X-Shopify-Webhook-Id', webhookId)
        .set('X-Shopify-Topic', 'orders/create')
        .send(payload)
        .expect(202);

      // Step 2: Wait for job processing (with timeout)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 3: Verify webhook event was recorded
      const webhookEvent = await prisma.processedWebhookEvent.findFirst({
        where: {
          webhookId,
          channelId,
        },
      });

      expect(webhookEvent).toBeDefined();
      expect(webhookEvent?.eventType).toBe('orders/create');

      // Step 4: Verify order was created
      const order = await prisma.order.findFirst({
        where: {
          externalOrderId,
          channelId,
        },
      });

      expect(order).toBeDefined();
      expect(order?.customerEmail).toBe('e2e@test.com');
      expect(order?.status).toBe('NEW');
    });
  });
});
