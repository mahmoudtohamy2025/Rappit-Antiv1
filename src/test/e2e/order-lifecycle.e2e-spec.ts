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
 * TASK-016: Full Order Lifecycle E2E Test
 * 
 * Tests complete order flow: Import → Reserve → Ship → Deliver
 * 
 * Coverage:
 * - Order import from channel
 * - Inventory reservation on order placement
 * - Order state transitions (NEW → PROCESSING → ... → DELIVERED)
 * - Inventory deduction on shipment
 * - Shipment tracking update
 * - Order completion
 */
describe('Order Lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Test data
  let adminToken: string;
  let organizationId: string;
  let channelId: string;
  let skuId: string;
  let inventoryLevelId: string;
  let orderId: string;
  let shipmentId: string;

  const INITIAL_STOCK = 100;
  const ORDER_QUANTITY = 5;

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
        name: 'Test Org - Order Lifecycle',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
    });
    organizationId = org.id;

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin-lifecycle@test.com',
        passwordHash: 'hashed',
        organizationId,
        role: UserRole.ADMIN,
      },
    });

    // Generate JWT token
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

    // Create SKU with inventory
    const sku = await prisma.sKU.create({
      data: {
        sku: 'TEST-SKU-LIFECYCLE',
        name: 'Test Product Lifecycle',
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
    await prisma.order.deleteMany({ where: { organizationId } });
    await prisma.inventoryLevel.deleteMany({ where: { organizationId } });
    await prisma.sKU.deleteMany({ where: { organizationId } });
    await prisma.channel.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });

    await app.close();
    await stopAllContainers();
  });

  describe('Phase 1: Order Import and Reservation', () => {
    it('should import order from channel', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channelId,
          externalOrderId: `EXT-${uuidv4()}`,
          status: OrderStatus.NEW,
          customerEmail: 'customer@test.com',
          customerName: 'Test Customer',
          totalAmount: 50.0,
          currencyCode: 'USD',
          items: [
            {
              skuId,
              quantity: ORDER_QUANTITY,
              unitPrice: 10.0,
              totalPrice: 50.0,
            },
          ],
        })
        .expect(201);

      orderId = response.body.id;
      expect(orderId).toBeDefined();
      expect(response.body.status).toBe(OrderStatus.NEW);
    });

    it('should reserve inventory for order', async () => {
      // Check inventory reservation was created
      const reservation = await prisma.inventoryReservation.findFirst({
        where: {
          orderId,
          skuId,
          organizationId,
        },
      });

      expect(reservation).toBeDefined();
      expect(reservation?.quantity).toBe(ORDER_QUANTITY);

      // Check inventory level updated
      const inventoryLevel = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      expect(inventoryLevel?.reserved).toBe(ORDER_QUANTITY);
      expect(inventoryLevel?.available).toBe(INITIAL_STOCK - ORDER_QUANTITY);
    });
  });

  describe('Phase 2: Order Processing', () => {
    it('should transition order to PROCESSING', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: OrderStatus.PROCESSING,
          comment: 'Order confirmed and processing',
        })
        .expect(200);

      expect(response.body.status).toBe(OrderStatus.PROCESSING);
    });

    it('should transition order through fulfillment states', async () => {
      // PICKING
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.PICKING })
        .expect(200);

      // PICKED
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.PICKED })
        .expect(200);

      // PACKING
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.PACKING })
        .expect(200);

      // PACKED
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.PACKED })
        .expect(200);

      expect(response.body.status).toBe(OrderStatus.PACKED);
    });
  });

  describe('Phase 3: Shipment Creation and Inventory Deduction', () => {
    it('should create shipment and deduct inventory', async () => {
      // Create shipment
      const shipmentResponse = await request(app.getHttpServer())
        .post('/shipments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderId,
          carrier: 'DHL',
          trackingNumber: `TRACK-${Date.now()}`,
        })
        .expect(201);

      shipmentId = shipmentResponse.body.id;
      expect(shipmentId).toBeDefined();

      // Update order status to SHIPPED
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.SHIPPED })
        .expect(200);

      // Verify inventory was deducted and reservation released
      const inventoryLevel = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      expect(inventoryLevel?.quantity).toBe(INITIAL_STOCK - ORDER_QUANTITY);
      expect(inventoryLevel?.reserved).toBe(0);
      expect(inventoryLevel?.available).toBe(INITIAL_STOCK - ORDER_QUANTITY);

      // Verify reservation was released
      const reservation = await prisma.inventoryReservation.findFirst({
        where: { orderId, skuId },
      });

      expect(reservation).toBeNull();
    });

    it('should update order status to READY_TO_SHIP', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.READY_TO_SHIP })
        .expect(200);

      expect(response.body.status).toBe(OrderStatus.READY_TO_SHIP);
    });
  });

  describe('Phase 4: Delivery and Completion', () => {
    it('should update shipment tracking to IN_TRANSIT', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.IN_TRANSIT })
        .expect(200);

      expect(response.body.status).toBe(OrderStatus.IN_TRANSIT);
    });

    it('should complete order as DELIVERED', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: OrderStatus.DELIVERED,
          comment: 'Package delivered to customer',
        })
        .expect(200);

      expect(response.body.status).toBe(OrderStatus.DELIVERED);

      // Verify order in database
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      expect(order?.status).toBe(OrderStatus.DELIVERED);
      expect(order?.deliveredAt).toBeDefined();
    });

    it('should have recorded all timeline events', async () => {
      const timelineEvents = await prisma.orderTimelineEvent.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });

      // Should have events for each status transition
      expect(timelineEvents.length).toBeGreaterThan(5);

      // Verify key events exist
      const statuses = timelineEvents.map((e) => e.newStatus);
      expect(statuses).toContain(OrderStatus.NEW);
      expect(statuses).toContain(OrderStatus.PROCESSING);
      expect(statuses).toContain(OrderStatus.SHIPPED);
      expect(statuses).toContain(OrderStatus.DELIVERED);
    });
  });

  describe('Phase 5: Verification', () => {
    it('should maintain inventory consistency', async () => {
      const inventoryLevel = await prisma.inventoryLevel.findUnique({
        where: { id: inventoryLevelId },
      });

      // Final inventory should be initial - order quantity
      expect(inventoryLevel?.quantity).toBe(INITIAL_STOCK - ORDER_QUANTITY);
      expect(inventoryLevel?.reserved).toBe(0);
      expect(inventoryLevel?.available).toBe(INITIAL_STOCK - ORDER_QUANTITY);
    });

    it('should have no orphaned reservations', async () => {
      const reservations = await prisma.inventoryReservation.findMany({
        where: { organizationId },
      });

      expect(reservations).toHaveLength(0);
    });
  });
});
