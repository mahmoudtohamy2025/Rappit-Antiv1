import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Module } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/database/prisma.service';
import { HealthModule } from '../../src/common/health/health.module';
import { JobsModule } from '../../src/modules/jobs/jobs.module';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { SubscriptionStatus, UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { startPostgresContainer, startRedisContainer, stopAllContainers } from '../helpers/testContainers';

/**
 * TASK-018: Security-Focused Tenant Isolation Tests
 * 
 * Comprehensive security test suite for multi-tenant isolation:
 * - Direct ID access attempts across tenants
 * - SQL injection attempts for tenant bypass
 * - API endpoint authorization for wrong tenant
 * - Query parameter manipulation for tenant access
 * - JWT token with wrong organization claim
 * 
 * Security Requirements:
 * - All cross-tenant access attempts MUST return 404 (not 403)
 * - No information disclosure about other tenants
 * - SQL injection attempts must be safely handled
 * - JWT tampering must be rejected
 */
describe('Security: Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Organization A
  let orgA: {
    id: string;
    userId: string;
    token: string;
    orderId: string;
    channelId: string;
    inventoryId: string;
  };

  // Organization B
  let orgB: {
    id: string;
    userId: string;
    token: string;
    orderId: string;
    channelId: string;
    inventoryId: string;
  };

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

    // Setup Organization A
    const orgAEntity = await prisma.organization.create({
      data: {
        name: 'Organization A - Security',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
    });

    const userA = await prisma.user.create({
      data: {
        email: 'admin-a-security@test.com',
        passwordHash: 'hashed',
        organizationId: orgAEntity.id,
        role: UserRole.ADMIN,
      },
    });

    const tokenA = jwtService.sign({
      userId: userA.id,
      organizationId: orgAEntity.id,
      role: UserRole.ADMIN,
    });

    const channelA = await prisma.channel.create({
      data: {
        name: 'Channel A',
        type: 'SHOPIFY',
        organizationId: orgAEntity.id,
        config: {},
      },
    });

    const skuA = await prisma.sKU.create({
      data: {
        sku: 'SKU-A-SECURITY',
        name: 'Product A',
        organizationId: orgAEntity.id,
      },
    });

    const inventoryA = await prisma.inventoryLevel.create({
      data: {
        skuId: skuA.id,
        organizationId: orgAEntity.id,
        quantity: 100,
        reserved: 0,
        available: 100,
      },
    });

    const orderA = await prisma.order.create({
      data: {
        channelId: channelA.id,
        organizationId: orgAEntity.id,
        externalOrderId: 'ORDER-A-SECURITY',
        status: 'NEW',
        customerEmail: 'customer-a@test.com',
        customerName: 'Customer A',
        totalAmount: 99.99,
        currencyCode: 'USD',
      },
    });

    orgA = {
      id: orgAEntity.id,
      userId: userA.id,
      token: tokenA,
      orderId: orderA.id,
      channelId: channelA.id,
      inventoryId: inventoryA.id,
    };

    // Setup Organization B (similar structure)
    const orgBEntity = await prisma.organization.create({
      data: {
        name: 'Organization B - Security',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
    });

    const userB = await prisma.user.create({
      data: {
        email: 'admin-b-security@test.com',
        passwordHash: 'hashed',
        organizationId: orgBEntity.id,
        role: UserRole.ADMIN,
      },
    });

    const tokenB = jwtService.sign({
      userId: userB.id,
      organizationId: orgBEntity.id,
      role: UserRole.ADMIN,
    });

    const channelB = await prisma.channel.create({
      data: {
        name: 'Channel B',
        type: 'SHOPIFY',
        organizationId: orgBEntity.id,
        config: {},
      },
    });

    const skuB = await prisma.sKU.create({
      data: {
        sku: 'SKU-B-SECURITY',
        name: 'Product B',
        organizationId: orgBEntity.id,
      },
    });

    const inventoryB = await prisma.inventoryLevel.create({
      data: {
        skuId: skuB.id,
        organizationId: orgBEntity.id,
        quantity: 100,
        reserved: 0,
        available: 100,
      },
    });

    const orderB = await prisma.order.create({
      data: {
        channelId: channelB.id,
        organizationId: orgBEntity.id,
        externalOrderId: 'ORDER-B-SECURITY',
        status: 'NEW',
        customerEmail: 'customer-b@test.com',
        customerName: 'Customer B',
        totalAmount: 99.99,
        currencyCode: 'USD',
      },
    });

    orgB = {
      id: orgBEntity.id,
      userId: userB.id,
      token: tokenB,
      orderId: orderB.id,
      channelId: channelB.id,
      inventoryId: inventoryB.id,
    };
  }, 60000);

  afterAll(async () => {
    // Cleanup
    await prisma.order.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.inventoryLevel.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.sKU.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.channel.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });

    await app.close();
    await stopAllContainers();
  });

  describe('SEC-01: Direct ID Access Attempts', () => {
    it('should return 404 when accessing other tenant order by ID', async () => {
      await request(app.getHttpServer())
        .get(`/orders/${orgB.orderId}`)
        .set('Authorization', `Bearer ${orgA.token}`)
        .expect(404);
    });

    it('should return 404 when accessing other tenant channel by ID', async () => {
      await request(app.getHttpServer())
        .get(`/channels/${orgB.channelId}`)
        .set('Authorization', `Bearer ${orgA.token}`)
        .expect(404);
    });

    it('should return 404 when accessing other tenant inventory by ID', async () => {
      await request(app.getHttpServer())
        .get(`/inventory/${orgB.inventoryId}`)
        .set('Authorization', `Bearer ${orgA.token}`)
        .expect(404);
    });

    it('should NOT leak existence of other tenant resources', async () => {
      const response = await request(app.getHttpServer())
        .get(`/orders/${orgB.orderId}`)
        .set('Authorization', `Bearer ${orgA.token}`)
        .expect(404);

      // Should not reveal that the order exists for another tenant
      expect(response.body.message).not.toContain('belongs to another');
      expect(response.body.message).not.toContain('different organization');
      expect(response.body.message).toMatch(/not found/i);
    });
  });

  describe('SEC-02: SQL Injection Attempts', () => {
    it('should safely handle SQL injection in order ID', async () => {
      const sqlInjections = [
        "' OR '1'='1",
        "'; DROP TABLE orders; --",
        "' UNION SELECT * FROM users --",
        `${orgB.orderId}' OR organizationId='${orgA.id}`,
      ];

      for (const injection of sqlInjections) {
        await request(app.getHttpServer())
          .get(`/orders/${injection}`)
          .set('Authorization', `Bearer ${orgA.token}`)
          .expect(404);
      }
    });

    it('should safely handle SQL injection in query parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders')
        .query({ status: "NEW' OR organizationId='any" })
        .set('Authorization', `Bearer ${orgA.token}`)
        .expect(200);

      // Should return empty or own orders only
      const orders = response.body.data || response.body;
      if (Array.isArray(orders)) {
        orders.forEach((order: any) => {
          expect(order.organizationId).toBe(orgA.id);
        });
      }
    });

    it('should safely handle SQL injection in filter parameters', async () => {
      await request(app.getHttpServer())
        .get('/orders')
        .query({
          customerEmail: "test@test.com' OR '1'='1",
          organizationId: `${orgB.id}' OR '1'='1`,
        })
        .set('Authorization', `Bearer ${orgA.token}`)
        .expect(200);
    });
  });

  describe('SEC-03: API Authorization Bypass Attempts', () => {
    it('should reject update to other tenant order', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${orgB.orderId}/status`)
        .set('Authorization', `Bearer ${orgA.token}`)
        .send({ status: 'PROCESSING' })
        .expect(404);

      // Verify order was not modified
      const order = await prisma.order.findUnique({
        where: { id: orgB.orderId },
      });
      expect(order?.status).toBe('NEW');
    });

    it('should reject delete of other tenant channel', async () => {
      await request(app.getHttpServer())
        .delete(`/channels/${orgB.channelId}`)
        .set('Authorization', `Bearer ${orgA.token}`)
        .expect(404);

      // Verify channel still exists
      const channel = await prisma.channel.findUnique({
        where: { id: orgB.channelId },
      });
      expect(channel).toBeDefined();
    });

    it('should reject create order with other tenant channel', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${orgA.token}`)
        .send({
          channelId: orgB.channelId, // Using Org B's channel
          externalOrderId: 'MALICIOUS-ORDER',
          status: 'NEW',
          customerEmail: 'attacker@test.com',
          customerName: 'Attacker',
          totalAmount: 99.99,
          currencyCode: 'USD',
        });

      // Should be rejected (either 404 or 400)
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('SEC-04: Query Parameter Manipulation', () => {
    it('should ignore organizationId in query parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders')
        .query({ organizationId: orgB.id })
        .set('Authorization', `Bearer ${orgA.token}`)
        .expect(200);

      // Should return only Org A's orders
      const orders = response.body.data || response.body;
      if (Array.isArray(orders) && orders.length > 0) {
        orders.forEach((order: any) => {
          expect(order.organizationId).toBe(orgA.id);
          expect(order.organizationId).not.toBe(orgB.id);
        });
      }
    });

    it('should ignore userId manipulation in body', async () => {
      // Attempt to create resource for different user
      const response = await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', `Bearer ${orgA.token}`)
        .send({
          name: 'Malicious Channel',
          type: 'SHOPIFY',
          userId: orgB.userId, // Trying to use Org B's user
          organizationId: orgB.id, // Trying to use Org B
          config: {},
        });

      if (response.status === 201) {
        // If created, verify it belongs to Org A (not B)
        const channel = await prisma.channel.findUnique({
          where: { id: response.body.id },
        });
        expect(channel?.organizationId).toBe(orgA.id);
      }
    });
  });

  describe('SEC-05: JWT Token Tampering', () => {
    it('should reject JWT with wrong organization claim', async () => {
      // Create token with mismatched org
      const maliciousToken = jwtService.sign({
        userId: orgA.userId,
        organizationId: orgB.id, // Wrong org
        role: UserRole.ADMIN,
      });

      await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${maliciousToken}`)
        .expect((res) => {
          // Should either reject (401/403) or return empty/wrong data
          expect([401, 403, 404]).toContain(res.status);
        });
    });

    it('should reject expired JWT token', async () => {
      const expiredToken = jwtService.sign(
        {
          userId: orgA.userId,
          organizationId: orgA.id,
          role: UserRole.ADMIN,
        },
        { expiresIn: '0s' } // Expired immediately
      );

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should reject JWT with invalid signature', async () => {
      const validToken = orgA.token;
      // Tamper with token
      const tamperedToken = validToken.slice(0, -10) + 'tampered00';

      await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    });

    it('should reject JWT with elevated role claim', async () => {
      // Create operator user
      const operatorUser = await prisma.user.create({
        data: {
          email: 'operator-security@test.com',
          passwordHash: 'hashed',
          organizationId: orgA.id,
          role: UserRole.OPERATOR,
        },
      });

      // Create token with elevated role
      const elevatedToken = jwtService.sign({
        userId: operatorUser.id,
        organizationId: orgA.id,
        role: UserRole.ADMIN, // Claiming ADMIN but user is OPERATOR
      });

      // Attempt admin-only action
      const response = await request(app.getHttpServer())
        .post('/users/invite')
        .set('Authorization', `Bearer ${elevatedToken}`)
        .send({
          email: 'newuser@test.com',
          role: 'MANAGER',
        });

      // Should be rejected based on actual user role
      expect([401, 403]).toContain(response.status);

      // Cleanup
      await prisma.user.delete({ where: { id: operatorUser.id } });
    });
  });

  describe('SEC-06: Cross-Tenant Data Aggregation', () => {
    it('should not leak tenant count in list responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${orgA.token}`)
        .expect(200);

      // Response should not reveal total system-wide count
      expect(response.body.total).not.toBeDefined();
      expect(response.body.totalOrganizations).not.toBeDefined();
    });

    it('should not allow aggregation across tenants', async () => {
      // Attempt to query with multiple org IDs
      const response = await request(app.getHttpServer())
        .get('/orders')
        .query({ organizationId: [orgA.id, orgB.id] })
        .set('Authorization', `Bearer ${orgA.token}`)
        .expect(200);

      // Should only return Org A's data
      const orders = response.body.data || response.body;
      if (Array.isArray(orders)) {
        orders.forEach((order: any) => {
          expect(order.organizationId).toBe(orgA.id);
        });
      }
    });
  });

  describe('SEC-07: Bidirectional Isolation Verification', () => {
    it('should prevent Org B from accessing Org A resources', async () => {
      // Test all endpoints in reverse
      await request(app.getHttpServer())
        .get(`/orders/${orgA.orderId}`)
        .set('Authorization', `Bearer ${orgB.token}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/channels/${orgA.channelId}`)
        .set('Authorization', `Bearer ${orgB.token}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/inventory/${orgA.inventoryId}`)
        .set('Authorization', `Bearer ${orgB.token}`)
        .expect(404);
    });
  });
});
