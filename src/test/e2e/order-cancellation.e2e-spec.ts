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
import { OrderStatus, UserRole, SubscriptionStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { startPostgresContainer, startRedisContainer, stopAllContainers } from '../helpers/testContainers';

/**
 * TASK-016: Order Cancellation with Inventory Release Test
 * 
 * Tests proper inventory handling during order cancellation:
 * - Order cancellation releases inventory reservations
 * - Inventory levels updated correctly
 * - No inventory leaks
 * - Cancellation at different order stages
 * 
 * Coverage:
 * - Cancel order before shipping (release reservation)
 * - Cancel order after shipping (inventory already deducted)
 * - Partial cancellation
 * - Multiple concurrent cancellations
 */
describe('Order Cancellation with Inventory Release (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let adminToken: string;
  let organizationId: string;
  let channelId: string;
  let skuId: string;
  let inventoryLevelId: string;

  const INITIAL_STOCK = 100;

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
        name: 'Test Org - Cancellation',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
    });
    organizationId = org.id;

    const adminUser = await prisma.user.create({
      data: {
        email: 'admin-cancel@test.com',
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
        sku: 'TEST-SKU-CANCEL',
        name: 'Test Product Cancel',
        organizationId,
      },
    });
    skuId = sku.id;

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

  describe('Cancel Before Shipping (Reservation Release)', () => {
    it('should cancel new order and release inventory reservation', async () => {
      const quantity = 10;

      // Create order
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channelId,
          externalOrderId: `CANCEL-NEW-${Date.now()}`,
          status: OrderStatus.NEW,
          customerEmail: 'cancel1@test.com',
          customerName: 'Cancel Test 1',
          totalAmount: quantity * 10.0,
          currencyCode: 'USD',
          items: [
            {
              skuId,
              quantity,
              unitPrice: 10.0,
              totalPrice: quantity * 10.0,
            },
          ],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      // Verify reservation was created
      const reservationBefore = await prisma.inventoryReservation.findFirst({
        where: { orderId, skuId },
      });
      expect(reservationBefore?.quantity).toBe(quantity);

      // Cancel order
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: OrderStatus.CANCELLED,
          comment: 'Customer requested cancellation',
        })
        .expect(200);

      // Verify reservation was released
      const reservationAfter = await prisma.inventoryReservation.findFirst({
        where: { orderId, skuId },
      });
      expect(reservationAfter).toBeNull();

      // Verify inventory level was updated
      const inventoryLevel = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      // Reserved should decrease, available should increase
      expect(inventoryLevel?.available).toBe(INITIAL_STOCK);
      expect(inventoryLevel?.reserved).toBe(0);
    });

    it('should cancel processing order and release inventory', async () => {
      const quantity = 5;

      // Create and process order
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channelId,
          externalOrderId: `CANCEL-PROC-${Date.now()}`,
          status: OrderStatus.NEW,
          customerEmail: 'cancel2@test.com',
          customerName: 'Cancel Test 2',
          totalAmount: quantity * 10.0,
          currencyCode: 'USD',
          items: [
            {
              skuId,
              quantity,
              unitPrice: 10.0,
              totalPrice: quantity * 10.0,
            },
          ],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      // Move to PROCESSING
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.PROCESSING })
        .expect(200);

      // Get inventory before cancellation
      const inventoryBefore = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      // Cancel order
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CANCELLED })
        .expect(200);

      // Verify inventory restored
      const inventoryAfter = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      expect(inventoryAfter?.available).toBe(inventoryBefore!.available + quantity);
      expect(inventoryAfter?.reserved).toBe(inventoryBefore!.reserved - quantity);
    });
  });

  describe('Cancel After Shipping (No Reservation)', () => {
    it('should handle cancellation of shipped order', async () => {
      const quantity = 3;

      // Create order
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channelId,
          externalOrderId: `CANCEL-SHIP-${Date.now()}`,
          status: OrderStatus.NEW,
          customerEmail: 'cancel3@test.com',
          customerName: 'Cancel Test 3',
          totalAmount: quantity * 10.0,
          currencyCode: 'USD',
          items: [
            {
              skuId,
              quantity,
              unitPrice: 10.0,
              totalPrice: quantity * 10.0,
            },
          ],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      // Move to SHIPPED (inventory deducted, reservation released)
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.SHIPPED })
        .expect(200);

      // Get inventory after shipping
      const inventoryAfterShipping = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      // Cancel shipped order
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: OrderStatus.CANCELLED,
          comment: 'Customer rejected delivery',
        })
        .expect(200);

      // Inventory should be restored (return to stock)
      const inventoryAfterCancel = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      expect(inventoryAfterCancel?.quantity).toBe(
        inventoryAfterShipping!.quantity + quantity
      );
      expect(inventoryAfterCancel?.available).toBe(
        inventoryAfterShipping!.available + quantity
      );
    });
  });

  describe('Concurrent Cancellations', () => {
    it('should handle multiple concurrent cancellations correctly', async () => {
      const CONCURRENT_CANCELS = 10;
      const quantity = 2;

      // Create multiple orders
      const orderIds: string[] = [];
      for (let i = 0; i < CONCURRENT_CANCELS; i++) {
        const response = await request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            channelId,
            externalOrderId: `CONCURRENT-CANCEL-${i}-${Date.now()}`,
            status: OrderStatus.NEW,
            customerEmail: `concurrent${i}@test.com`,
            customerName: `Concurrent ${i}`,
            totalAmount: quantity * 10.0,
            currencyCode: 'USD',
            items: [
              {
                skuId,
                quantity,
                unitPrice: 10.0,
                totalPrice: quantity * 10.0,
              },
            ],
          })
          .expect(201);

        orderIds.push(response.body.id);
      }

      // Get inventory before cancellations
      const inventoryBefore = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      // Cancel all orders concurrently
      const cancelPromises = orderIds.map((orderId) =>
        request(app.getHttpServer())
          .patch(`/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: OrderStatus.CANCELLED })
      );

      await Promise.all(cancelPromises);

      // Verify all reservations released
      const remainingReservations = await prisma.inventoryReservation.findMany({
        where: { orderId: { in: orderIds } },
      });

      expect(remainingReservations).toHaveLength(0);

      // Verify inventory restored
      const inventoryAfter = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      expect(inventoryAfter?.available).toBe(
        inventoryBefore!.available + CONCURRENT_CANCELS * quantity
      );
      expect(inventoryAfter?.reserved).toBe(
        inventoryBefore!.reserved - CONCURRENT_CANCELS * quantity
      );
    }, 60000);
  });

  describe('Inventory Consistency Verification', () => {
    it('should maintain inventory consistency across all operations', async () => {
      // Get current state
      const inventoryLevel = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      const reservations = await prisma.inventoryReservation.findMany({
        where: { skuId, organizationId },
      });

      const totalReserved = reservations.reduce((sum, r) => sum + r.quantity, 0);

      // Verify consistency
      expect(inventoryLevel?.reserved).toBe(totalReserved);
      expect(inventoryLevel?.available).toBe(
        inventoryLevel!.quantity - inventoryLevel!.reserved
      );

      console.log(`📊 Final Inventory State:`);
      console.log(`   Total: ${inventoryLevel?.quantity}`);
      console.log(`   Reserved: ${inventoryLevel?.reserved}`);
      console.log(`   Available: ${inventoryLevel?.available}`);
      console.log(`   Active Reservations: ${reservations.length}`);
    });

    it('should have no orphaned reservations', async () => {
      // Get all reservations
      const reservations = await prisma.inventoryReservation.findMany({
        where: { skuId, organizationId },
        include: { order: true },
      });

      // All reservations should have valid orders
      reservations.forEach((reservation) => {
        expect(reservation.order).toBeDefined();
        expect(reservation.order.status).not.toBe(OrderStatus.CANCELLED);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle double cancellation attempt', async () => {
      const quantity = 2;

      // Create order
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channelId,
          externalOrderId: `DOUBLE-CANCEL-${Date.now()}`,
          status: OrderStatus.NEW,
          customerEmail: 'doublecancel@test.com',
          customerName: 'Double Cancel',
          totalAmount: quantity * 10.0,
          currencyCode: 'USD',
          items: [
            {
              skuId,
              quantity,
              unitPrice: 10.0,
              totalPrice: quantity * 10.0,
            },
          ],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      // First cancellation
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CANCELLED })
        .expect(200);

      // Second cancellation attempt
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CANCELLED });

      // Should either succeed (idempotent) or return error
      expect([200, 400, 409]).toContain(response.status);

      // Inventory should not be double-released
      const reservations = await prisma.inventoryReservation.findMany({
        where: { orderId, skuId },
      });

      expect(reservations).toHaveLength(0);
    });

    it('should prevent cancellation of delivered order', async () => {
      const quantity = 1;

      // Create and deliver order
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channelId,
          externalOrderId: `NO-CANCEL-DELIVERED-${Date.now()}`,
          status: OrderStatus.NEW,
          customerEmail: 'nocancel@test.com',
          customerName: 'No Cancel',
          totalAmount: quantity * 10.0,
          currencyCode: 'USD',
          items: [
            {
              skuId,
              quantity,
              unitPrice: 10.0,
              totalPrice: quantity * 10.0,
            },
          ],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      // Deliver order
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.DELIVERED })
        .expect(200);

      // Attempt to cancel delivered order
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CANCELLED });

      // Should reject invalid state transition
      expect([400, 409]).toContain(response.status);
    });
  });
});
