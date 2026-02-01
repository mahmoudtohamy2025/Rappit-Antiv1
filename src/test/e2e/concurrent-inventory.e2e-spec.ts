import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Module } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/database/prisma.service';
import { HealthModule } from '../../src/common/health/health.module';
import { JobsModule } from '../../src/modules/jobs/jobs.module';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { SubscriptionStatus, UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { startPostgresContainer, startRedisContainer, stopAllContainers } from '../helpers/testContainers';
import request from 'supertest';

/**
 * TASK-016 & TASK-017: Concurrent Inventory Reservation Test
 * 
 * Tests inventory reservation under concurrent load:
 * - Multiple orders placed simultaneously
 * - Inventory reservations don't oversell
 * - Race condition handling
 * - Database transaction isolation
 * 
 * Chaos Engineering Aspects:
 * - High-volume concurrent requests
 * - Database connection pool under load
 * - Transaction conflicts
 */
describe('Concurrent Inventory Reservation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Test data
  let adminToken: string;
  let organizationId: string;
  let channelId: string;
  let skuId: string;
  let inventoryLevelId: string;

  const INITIAL_STOCK = 100;
  const CONCURRENT_ORDERS = 30;
  const QUANTITY_PER_ORDER = 5;

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
        name: 'Test Org - Concurrent Inventory',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
    });
    organizationId = org.id;

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin-concurrent@test.com',
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

    // Create channel
    const channel = await prisma.channel.create({
      data: {
        name: 'Test Channel',
        type: 'SHOPIFY',
        organizationId,
        config: {},
      },
    });
    channelId = channel.id;

    // Create SKU
    const sku = await prisma.sKU.create({
      data: {
        sku: 'TEST-SKU-CONCURRENT',
        name: 'Test Product Concurrent',
        organizationId,
      },
    });
    skuId = sku.id;

    // Create inventory level
    const inventoryLevel = await prisma.inventoryLevel.create({
      data: {
        skuId,
        organizationId,
        quantity: INITIAL_STOCK,
        reserved: 0,
        available: INITIAL_STOCK,
      },
    });
    inventoryLevelId = inventoryLevel.id;
  }, 60000);

  afterAll(async () => {
    // Cleanup test data
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

  describe('Concurrent Order Placement', () => {
    it('should handle concurrent orders without overselling', async () => {
      const orderPromises = Array.from({ length: CONCURRENT_ORDERS }, (_, i) =>
        request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            channelId,
            externalOrderId: `CONCURRENT-${i}-${Date.now()}`,
            status: 'NEW',
            customerEmail: `customer${i}@test.com`,
            customerName: `Customer ${i}`,
            totalAmount: QUANTITY_PER_ORDER * 10.0,
            currencyCode: 'USD',
            items: [
              {
                skuId,
                quantity: QUANTITY_PER_ORDER,
                unitPrice: 10.0,
                totalPrice: QUANTITY_PER_ORDER * 10.0,
              },
            ],
          })
      );

      // Execute all orders concurrently
      const results = await Promise.allSettled(orderPromises);

      // Count successful orders
      const successfulOrders = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 201
      );
      const failedOrders = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 201)
      );

      console.log(
        `✅ Successful orders: ${successfulOrders.length}/${CONCURRENT_ORDERS}`
      );
      console.log(`❌ Failed orders: ${failedOrders.length}/${CONCURRENT_ORDERS}`);

      // At least some orders should succeed
      expect(successfulOrders.length).toBeGreaterThan(0);

      // Expected successful orders: floor(INITIAL_STOCK / QUANTITY_PER_ORDER)
      const maxPossibleOrders = Math.floor(INITIAL_STOCK / QUANTITY_PER_ORDER);
      expect(successfulOrders.length).toBeLessThanOrEqual(maxPossibleOrders);
    }, 60000);

    it('should never exceed available inventory', async () => {
      // Check inventory level
      const inventoryLevel = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      expect(inventoryLevel).toBeDefined();

      // Total reserved should not exceed initial stock
      expect(inventoryLevel!.reserved).toBeLessThanOrEqual(INITIAL_STOCK);

      // Available should be non-negative
      expect(inventoryLevel!.available).toBeGreaterThanOrEqual(0);

      // Consistency check: quantity = available + reserved
      expect(inventoryLevel!.quantity).toBe(
        inventoryLevel!.available + inventoryLevel!.reserved
      );
    });

    it('should have valid reservations for all orders', async () => {
      // Get all reservations
      const reservations = await prisma.inventoryReservation.findMany({
        where: {
          skuId,
          organizationId,
        },
      });

      // Calculate total reserved
      const totalReserved = reservations.reduce(
        (sum, r) => sum + r.quantity,
        0
      );

      // Check against inventory level
      const inventoryLevel = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      expect(totalReserved).toBe(inventoryLevel!.reserved);
    });
  });

  describe('Race Condition Prevention', () => {
    it('should handle rapid sequential reservations correctly', async () => {
      const RAPID_ORDERS = 10;
      const orderIds: string[] = [];

      // Place orders rapidly in sequence
      for (let i = 0; i < RAPID_ORDERS; i++) {
        try {
          const response = await request(app.getHttpServer())
            .post('/orders')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              channelId,
              externalOrderId: `RAPID-${i}-${Date.now()}`,
              status: 'NEW',
              customerEmail: `rapid${i}@test.com`,
              customerName: `Rapid ${i}`,
              totalAmount: QUANTITY_PER_ORDER * 10.0,
              currencyCode: 'USD',
              items: [
                {
                  skuId,
                  quantity: QUANTITY_PER_ORDER,
                  unitPrice: 10.0,
                  totalPrice: QUANTITY_PER_ORDER * 10.0,
                },
              ],
            });

          if (response.status === 201) {
            orderIds.push(response.body.id);
          }
        } catch (error) {
          // Expected when out of stock
        }
      }

      // Verify all reservations are unique
      const reservations = await prisma.inventoryReservation.findMany({
        where: {
          orderId: { in: orderIds },
        },
      });

      const uniqueOrderIds = new Set(reservations.map((r) => r.orderId));
      expect(uniqueOrderIds.size).toBe(reservations.length);
    });
  });

  describe('Database Transaction Isolation', () => {
    it('should maintain isolation between concurrent transactions', async () => {
      // Reset inventory for this test
      await prisma.inventoryReservation.deleteMany({ where: { skuId } });
      await prisma.inventoryLevel.update({
        where: { id: inventoryLevelId },
        data: {
          quantity: 50,
          reserved: 0,
          available: 50,
        },
      });

      const ISOLATION_ORDERS = 20;
      const orderPromises = Array.from({ length: ISOLATION_ORDERS }, (_, i) =>
        request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            channelId,
            externalOrderId: `ISOLATION-${i}-${Date.now()}`,
            status: 'NEW',
            customerEmail: `isolation${i}@test.com`,
            customerName: `Isolation ${i}`,
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
      );

      await Promise.allSettled(orderPromises);

      // Verify inventory consistency
      const inventoryLevel = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      const reservations = await prisma.inventoryReservation.findMany({
        where: { skuId },
      });

      const totalReserved = reservations.reduce((sum, r) => sum + r.quantity, 0);

      // Database state should be consistent
      expect(inventoryLevel!.reserved).toBe(totalReserved);
      expect(inventoryLevel!.available).toBe(
        inventoryLevel!.quantity - inventoryLevel!.reserved
      );
    });
  });

  describe('Stress Test', () => {
    it('should handle extreme concurrent load gracefully', async () => {
      // Reset inventory
      await prisma.inventoryReservation.deleteMany({ where: { skuId } });
      await prisma.inventoryLevel.update({
        where: { id: inventoryLevelId },
        data: {
          quantity: 200,
          reserved: 0,
          available: 200,
        },
      });

      const EXTREME_LOAD = 100;
      const startTime = Date.now();

      const orderPromises = Array.from({ length: EXTREME_LOAD }, (_, i) =>
        request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            channelId,
            externalOrderId: `STRESS-${i}-${Date.now()}-${Math.random()}`,
            status: 'NEW',
            customerEmail: `stress${i}@test.com`,
            customerName: `Stress ${i}`,
            totalAmount: 20.0,
            currencyCode: 'USD',
            items: [
              {
                skuId,
                quantity: 2,
                unitPrice: 10.0,
                totalPrice: 20.0,
              },
            ],
          })
          .timeout(30000)
      );

      const results = await Promise.allSettled(orderPromises);
      const duration = Date.now() - startTime;

      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 201
      ).length;

      console.log(`⚡ Processed ${EXTREME_LOAD} requests in ${duration}ms`);
      console.log(`✅ Success rate: ${(successful / EXTREME_LOAD) * 100}%`);

      // Should handle gracefully (not crash)
      expect(successful).toBeGreaterThan(0);

      // Verify final inventory state is consistent
      const inventoryLevel = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      expect(inventoryLevel!.reserved).toBeLessThanOrEqual(200);
      expect(inventoryLevel!.available).toBeGreaterThanOrEqual(0);
    }, 90000);
  });
});
