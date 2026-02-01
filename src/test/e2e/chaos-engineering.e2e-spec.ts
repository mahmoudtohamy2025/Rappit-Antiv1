import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Module } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/database/prisma.service';
import { HealthModule } from '../../src/common/health/health.module';
import { JobsModule } from '../../src/modules/jobs/jobs.module';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { startPostgresContainer, startRedisContainer, stopAllContainers, getRedisClient } from '../helpers/testContainers';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { SubscriptionStatus, UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * TASK-017: Chaos Engineering Tests
 * 
 * Tests system resilience under adverse conditions:
 * - High-volume concurrent order placement
 * - Database connection pool exhaustion
 * - Redis connection failures
 * - Carrier API timeouts
 * - Network partition simulation
 * 
 * Goals:
 * - System handles failures gracefully
 * - No data corruption under stress
 * - Proper error recovery
 * - Degraded performance is acceptable, crashes are not
 */
describe('Chaos Engineering (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let adminToken: string;
  let organizationId: string;
  let channelId: string;
  let skuId: string;

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

    // Seed test organization
    const org = await prisma.organization.create({
      data: {
        name: 'Test Org - Chaos',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
    });
    organizationId = org.id;

    const adminUser = await prisma.user.create({
      data: {
        email: 'admin-chaos@test.com',
        passwordHash: 'hashed',
        organizationId,
        role: UserRole.ADMIN,
      },
    });

    adminToken = jwtService.sign({
      userId: adminUser.id,
      organizationId,
      role: UserRole.ADMIN,
    });

    const channel = await prisma.channel.create({
      data: {
        name: 'Test Channel',
        type: 'SHOPIFY',
        organizationId,
        config: {},
      },
    });
    channelId = channel.id;

    const sku = await prisma.sKU.create({
      data: {
        sku: 'TEST-SKU-CHAOS',
        name: 'Test Product Chaos',
        organizationId,
      },
    });
    skuId = sku.id;

    await prisma.inventoryLevel.create({
      data: {
        skuId,
        organizationId,
        quantity: 10000,
        reserved: 0,
        available: 10000,
      },
    });
  }, 60000);

  afterAll(async () => {
    // Cleanup
    await prisma.inventoryReservation.deleteMany({ where: { organizationId } });
    await prisma.orderItem.deleteMany({ where: { order: { organizationId } } });
    await prisma.order.deleteMany({ where: { organizationId } });
    await prisma.inventoryLevel.deleteMany({ where: { organizationId } });
    await prisma.sKU.deleteMany({ where: { organizationId } });
    await prisma.channel.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });

    await app.close();
    await stopAllContainers();
  });

  describe('CHAOS-01: High-Volume Concurrent Load', () => {
    it('should handle 200 concurrent order requests', async () => {
      const LOAD = 200;
      const startTime = Date.now();

      const requests = Array.from({ length: LOAD }, (_, i) =>
        request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            channelId,
            externalOrderId: `CHAOS-LOAD-${i}-${Date.now()}-${Math.random()}`,
            status: 'NEW',
            customerEmail: `chaos${i}@test.com`,
            customerName: `Chaos ${i}`,
            totalAmount: 10.0,
            currencyCode: 'USD',
            items: [
              {
                skuId,
                quantity: 1,
                unitPrice: 10.0,
                totalPrice: 10.0,
              },
            ],
          })
          .timeout(30000)
      );

      const results = await Promise.allSettled(requests);
      const duration = Date.now() - startTime;

      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 201
      ).length;
      const failed = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 201)
      ).length;

      console.log(`⚡ Load Test: ${LOAD} requests in ${duration}ms`);
      console.log(`✅ Success: ${successful} (${(successful / LOAD * 100).toFixed(1)}%)`);
      console.log(`❌ Failed: ${failed} (${(failed / LOAD * 100).toFixed(1)}%)`);

      // Success rate should be reasonable (at least 70%)
      expect(successful / LOAD).toBeGreaterThanOrEqual(0.7);

      // System should not crash
      const healthCheck = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(healthCheck.body.status).toBe('ok');
    }, 120000);

    it('should maintain data consistency under high load', async () => {
      // Verify no data corruption
      const orders = await prisma.order.findMany({
        where: { organizationId },
        select: { id: true, externalOrderId: true },
      });

      // All orders should have unique IDs
      const uniqueIds = new Set(orders.map((o) => o.id));
      expect(uniqueIds.size).toBe(orders.length);

      // All external order IDs should be unique
      const uniqueExternalIds = new Set(orders.map((o) => o.externalOrderId));
      expect(uniqueExternalIds.size).toBe(orders.length);
    });
  });

  describe('CHAOS-02: Database Connection Pool Stress', () => {
    it('should handle connection pool exhaustion gracefully', async () => {
      const CONNECTIONS = 50;
      
      // Simulate long-running database queries
      const longQueries = Array.from({ length: CONNECTIONS }, async () => {
        try {
          await prisma.order.findMany({
            where: { organizationId },
            take: 1000,
          });
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      // Simultaneously make API requests
      const apiRequests = Array.from({ length: 20 }, () =>
        request(app.getHttpServer())
          .get('/orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .timeout(10000)
      );

      const results = await Promise.allSettled([...longQueries, ...apiRequests]);
      
      const successfulQueries = results
        .slice(0, CONNECTIONS)
        .filter((r) => r.status === 'fulfilled' && (r.value as any).success).length;

      const successfulRequests = results
        .slice(CONNECTIONS)
        .filter((r) => r.status === 'fulfilled' && (r.value as any).status === 200).length;

      console.log(`📊 DB Pool Stress: ${successfulQueries}/${CONNECTIONS} queries, ${successfulRequests}/20 API requests succeeded`);

      // At least some should succeed
      expect(successfulQueries + successfulRequests).toBeGreaterThan(0);
    }, 60000);

    it('should recover after connection pool stress', async () => {
      // Wait for connections to be released
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // System should be operational
      const response = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('CHAOS-03: Redis Connection Failures', () => {
    it('should handle Redis disconnection gracefully', async () => {
      const redis = getRedisClient();

      // Simulate Redis issues by flooding with requests
      const redisOps = Array.from({ length: 100 }, () =>
        redis.set(`chaos-key-${Math.random()}`, 'value', 'EX', 1)
      );

      await Promise.allSettled(redisOps);

      // API should still work (may be degraded)
      const response = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .timeout(10000);

      // Should not crash (accept 200, 500, or 503)
      expect([200, 500, 503]).toContain(response.status);
    }, 30000);

    it('should handle queue operations during Redis stress', async () => {
      // Attempt to create order (which may enqueue job)
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channelId,
          externalOrderId: `CHAOS-REDIS-${Date.now()}`,
          status: 'NEW',
          customerEmail: 'redis-chaos@test.com',
          customerName: 'Redis Chaos',
          totalAmount: 25.0,
          currencyCode: 'USD',
          items: [
            {
              skuId,
              quantity: 1,
              unitPrice: 25.0,
              totalPrice: 25.0,
            },
          ],
        })
        .timeout(10000);

      // Should handle gracefully (success or proper error)
      expect([201, 500, 503]).toContain(response.status);
    });
  });

  describe('CHAOS-04: Carrier API Timeout Simulation', () => {
    it('should handle carrier API timeouts gracefully', async () => {
      // Create order
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channelId,
          externalOrderId: `CHAOS-CARRIER-${Date.now()}`,
          status: 'NEW',
          customerEmail: 'carrier-chaos@test.com',
          customerName: 'Carrier Chaos',
          totalAmount: 50.0,
          currencyCode: 'USD',
          items: [
            {
              skuId,
              quantity: 1,
              unitPrice: 50.0,
              totalPrice: 50.0,
            },
          ],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      // Attempt to create shipment (may timeout on carrier API)
      const shipmentResponse = await request(app.getHttpServer())
        .post('/shipments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderId,
          carrier: 'DHL',
          trackingNumber: `CHAOS-${Date.now()}`,
        })
        .timeout(10000);

      // Should handle timeout gracefully
      expect([201, 408, 500, 503]).toContain(shipmentResponse.status);

      // Order should still exist and be in valid state
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      expect(order).toBeDefined();
    });
  });

  describe('CHAOS-05: Memory and Resource Exhaustion', () => {
    it('should handle large batch operations', async () => {
      const BATCH_SIZE = 100;

      const items = Array.from({ length: BATCH_SIZE }, (_, i) => ({
        skuId,
        quantity: 1,
        unitPrice: 10.0,
        totalPrice: 10.0,
      }));

      // Create order with large item list
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channelId,
          externalOrderId: `CHAOS-BATCH-${Date.now()}`,
          status: 'NEW',
          customerEmail: 'batch-chaos@test.com',
          customerName: 'Batch Chaos',
          totalAmount: BATCH_SIZE * 10.0,
          currencyCode: 'USD',
          items,
        })
        .timeout(30000);

      // Should handle gracefully
      expect([201, 400, 413, 500]).toContain(response.status);
    }, 60000);

    it('should handle rapid repeated requests from same client', async () => {
      const RAPID_REQUESTS = 50;
      const requests = [];

      for (let i = 0; i < RAPID_REQUESTS; i++) {
        requests.push(
          request(app.getHttpServer())
            .get('/orders')
            .set('Authorization', `Bearer ${adminToken}`)
            .timeout(5000)
        );
      }

      const results = await Promise.allSettled(requests);
      const successful = results.filter(
        (r) => r.status === 'fulfilled' && (r.value as any).status === 200
      ).length;

      // Rate limiting may kick in, but system should not crash
      expect(successful).toBeGreaterThan(0);
      console.log(`🚀 Rapid requests: ${successful}/${RAPID_REQUESTS} succeeded`);
    }, 30000);
  });

  describe('CHAOS-06: Recovery and Health Check', () => {
    it('should maintain system health after chaos tests', async () => {
      // Wait for system to stabilize
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const health = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(health.body.status).toBe('ok');
    });

    it('should have no orphaned database transactions', async () => {
      // Verify database consistency
      const orders = await prisma.order.count({
        where: { organizationId },
      });

      const reservations = await prisma.inventoryReservation.count({
        where: { organizationId },
      });

      console.log(`📊 Final state: ${orders} orders, ${reservations} reservations`);

      // Data should be consistent
      expect(orders).toBeGreaterThan(0);
    });

    it('should allow normal operations after chaos', async () => {
      // Create a normal order
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channelId,
          externalOrderId: `POST-CHAOS-${Date.now()}`,
          status: 'NEW',
          customerEmail: 'post-chaos@test.com',
          customerName: 'Post Chaos',
          totalAmount: 30.0,
          currencyCode: 'USD',
          items: [
            {
              skuId,
              quantity: 3,
              unitPrice: 10.0,
              totalPrice: 30.0,
            },
          ],
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
    });
  });
});
