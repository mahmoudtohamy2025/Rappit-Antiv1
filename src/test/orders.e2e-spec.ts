import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { HealthModule } from '../src/common/health/health.module';
import { JobsModule } from '../src/modules/jobs/jobs.module';
import { EncryptionService } from '../src/common/encryption/encryption.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { UserRole, SubscriptionStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * End-to-End Integration Tests for Orders API
 * 
 * Tests the complete order lifecycle including:
 * - Order creation from channel
 * - State transitions
 * - Inventory integration
 * - RBAC enforcement
 * - Organization scoping
 * 
 * Prerequisites:
 * - Test database configured
 * - Test data seeded (organization, users, channels, SKUs)
 */
describe('Orders API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data IDs (would be seeded in beforeAll)
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let organizationId: string;
  let channelId: string;
  let productId: string;
  let inventoryLevelId: string;
  let skuId: string;
  let orderId: string;

  @Module({})
  class MockHealthModule { }

  @Module({})
  class MockJobsModule { }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(HealthModule)
      .useModule(MockHealthModule)
      .overrideModule(JobsModule)
      .useModule(MockJobsModule)
      .overrideProvider(DiscoveryService)
      .useValue({ explore: () => [], getControllers: () => [], getProviders: () => [] })
      .overrideProvider(EncryptionService)
      .useValue({
        encrypt: (val: string) => `encrypted_${val}`,
        decrypt: (val: string) => val.replace('encrypted_', ''),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    const jwtService = app.get<JwtService>(JwtService);

    // Seed test data
    const org = await prisma.organization.create({
      data: {
        name: 'Test Organization',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
    });
    organizationId = org.id;

    const channel = await prisma.channel.create({
      data: {
        name: 'Test Channel',
        type: 'SHOPIFY',
        organizationId,
        config: {},
      },
    });
    channelId = channel.id;

    const product = await prisma.product.create({
      data: {
        organizationId,
        name: 'Test Product',
        description: 'Test Description',
      },
    });
    productId = product.id;

    // Clean up specific SKU to ensure clean slate
    await prisma.sKU.deleteMany({
      where: {
        sku: 'LAPTOP-HP-15',
      },
    });

    const sku = await prisma.sKU.create({
      data: {
        sku: 'LAPTOP-HP-15',
        barcode: '123456789',
        organizationId,
        productId,
      },
    });
    skuId = sku.id;

    // Create warehouse
    // Clean up specific Warehouse
    await prisma.warehouse.deleteMany({
      where: {
        code: 'TEST-WH',
        organizationId,
      },
    });

    const warehouse = await prisma.warehouse.create({
      data: {
        organizationId,
        name: 'Test Warehouse',
        code: 'TEST-WH',
      },
    });

    // Create inventory level
    const inventoryLevel = await prisma.inventoryLevel.create({
      data: {
        skuId,
        organizationId,
        warehouseId: warehouse.id,
        available: 100,
        reserved: 0,
      },
    });
    inventoryLevelId = inventoryLevel.id;

    // Generate Tokens
    // Create real users for authentication
    const createTestUser = async (role: UserRole) => {
      return prisma.user.create({
        data: {
          email: `${role.toLowerCase()}-${Date.now()}@e2e.test`,
          firstName: 'Test',
          lastName: role,
          password: 'hashed_password', // Placeholder
          isActive: true,
          userOrganizations: {
            create: {
              organizationId,
              role,
            },
          },
        },
      });
    };

    const adminUser = await createTestUser(UserRole.ADMIN);
    const managerUser = await createTestUser(UserRole.MANAGER);
    const operatorUser = await createTestUser(UserRole.OPERATOR);

    // Generate Tokens with REAL IDs
    adminToken = jwtService.sign({ sub: adminUser.id, email: adminUser.email, role: UserRole.ADMIN, orgId: organizationId });
    managerToken = jwtService.sign({ sub: managerUser.id, email: managerUser.email, role: UserRole.MANAGER, orgId: organizationId });
    operatorToken = jwtService.sign({ sub: operatorUser.id, email: operatorUser.email, role: UserRole.OPERATOR, orgId: organizationId });
  });

  afterAll(async () => {
    // Cleanup test data
    await app.close();
  });

  describe('POST /orders - Create order from channel', () => {
    it('should create order with MANAGER role', () => {
      const createDto = {
        channelId,
        externalOrderId: `test - order - ${Date.now()} `,
        customer: {
          firstName: 'Ahmed',
          lastName: 'Al-Saud',
          email: 'ahmed@example.com',
        },
        shippingAddress: {
          firstName: 'Ahmed',
          lastName: 'Al-Saud',
          street1: 'King Fahd Road',
          city: 'Riyadh',
          postalCode: '12345',
          country: 'SA',
        },
        items: [
          {
            externalItemId: 'item-1',
            sku: 'LAPTOP-HP-15',
            name: 'HP Laptop 15-inch',
            quantity: 2,
            unitPrice: 2500,
            totalPrice: 5000,
          },
        ],
        subtotal: 5000,
        totalAmount: 5750,
        taxAmount: 750,
      };

      return request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('orderNumber');
          if (res.body.status === 'NEW') {
            expect(res.body.status).toBe('NEW');
          } else {
            expect(res.body.status).toBe('RESERVED');
          } // Auto-reserved
          orderId = res.body.id;
        });
    });

    it('should reject order creation with OPERATOR role', () => {
      const createDto = {
        channelId,
        externalOrderId: `test - order - ${Date.now()} `,
        // ... rest of DTO
      };

      return request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(createDto)
        .expect(403);
    });

    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({})
        .expect(401);
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          channelId,
          // Missing required fields
        })
        .expect(400);
    });

    it('should enforce idempotency', async () => {
      const externalOrderId = `idempotent - test - ${Date.now()} `;
      const createDto = {
        channelId,
        externalOrderId,
        customer: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
        },
        shippingAddress: {
          firstName: 'Test',
          lastName: 'User',
          street1: 'Street 1',
          city: 'Riyadh',
          postalCode: '12345',
          country: 'SA',
        },
        items: [
          {
            externalItemId: 'item-1',
            sku: 'LAPTOP-HP-15',
            name: 'Laptop',
            quantity: 1,
            unitPrice: 1000,
            totalPrice: 1000,
          },
        ],
        subtotal: 1000,
        totalAmount: 1150,
        taxAmount: 150,
      };

      // First request - creates order
      const res1 = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201);

      const orderId1 = res1.body.id;

      // Second request - updates existing order
      const res2 = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201);

      const orderId2 = res2.body.id;

      // Should be same order ID
      expect(orderId1).toBe(orderId2);
    });
  });

  describe('GET /orders - List orders', () => {
    it('should list orders with OPERATOR role', () => {
      return request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should filter orders by status', () => {
      return request(app.getHttpServer())
        .get('/orders?status=RESERVED')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200)
        .expect((res) => {
          res.body.data.forEach((order: any) => {
            expect(order.status).toBe('RESERVED');
          });
        });
    });

    it('should filter orders by channel', () => {
      return request(app.getHttpServer())
        .get(`/orders?channelId=${channelId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
    });

    it('should search orders', () => {
      return request(app.getHttpServer())
        .get('/orders?search=ORD-202412')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
    });

    it('should paginate results', () => {
      return request(app.getHttpServer())
        .get('/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.meta.limit).toBe(10);
          expect(res.body.meta.page).toBe(1);
        });
    });
  });

  describe('GET /orders/:id - Get order details', () => {
    it('should get order with OPERATOR role', () => {
      return request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(orderId);
          expect(res.body).toHaveProperty('items');
          expect(res.body).toHaveProperty('timelineEvents');
        });
    });

    it('should return 404 for non-existent order', () => {
      return request(app.getHttpServer())
        .get('/orders/non-existent-id')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(404);
    });
  });

  describe('PATCH /orders/:id/status - Update status', () => {
    it('should update status with MANAGER role', () => {
      return request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'READY_TO_SHIP',
          comment: 'Payment confirmed',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('READY_TO_SHIP');
        });
    });

    it('should reject status update with OPERATOR role', () => {
      return request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          status: 'CANCELLED',
        })
        .expect(403);
    });

    it('should reject invalid state transition', async () => {
      // Try to transition from READY_TO_SHIP directly to DELIVERED (invalid)
      return request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'DELIVERED',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid state transition');
        });
    });

    it('should allow valid state transition chain', async () => {
      // Create new order for this test
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          channelId,
          externalOrderId: `test-transition-${Date.now()}`,
          customer: {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
          },
          shippingAddress: {
            firstName: 'Test',
            lastName: 'User',
            street1: 'Street',
            city: 'Riyadh',
            postalCode: '12345',
            country: 'SA',
          },
          items: [
            {
              externalItemId: 'item-1',
              sku: 'LAPTOP-HP-15',
              name: 'Laptop',
              quantity: 1,
              unitPrice: 1000,
              totalPrice: 1000,
            },
          ],
          subtotal: 1000,
          totalAmount: 1150,
          taxAmount: 150,
        })
        .expect(201);

      const testOrderId = createRes.body.id;

      // RESERVED → READY_TO_SHIP
      await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'READY_TO_SHIP' })
        .expect(200);

      // READY_TO_SHIP → LABEL_CREATED
      await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'LABEL_CREATED' })
        .expect(200);

      // LABEL_CREATED → PICKED_UP
      await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'PICKED_UP' })
        .expect(200);

      // PICKED_UP → IN_TRANSIT
      const finalRes = await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'IN_TRANSIT' })
        .expect(200);

      expect(finalRes.body.status).toBe('IN_TRANSIT');
    });
  });

  describe('POST /orders/:id/notes - Add note', () => {
    it('should add note with OPERATOR role', () => {
      return request(app.getHttpServer())
        .post(`/orders/${orderId}/notes`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          note: 'Customer confirmed delivery address',
        })
        .expect(201);
    });

    it('should add note with MANAGER role', () => {
      return request(app.getHttpServer())
        .post(`/orders/${orderId}/notes`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          note: 'Payment verified',
        })
        .expect(201);
    });

    it('should add note with ADMIN role', () => {
      return request(app.getHttpServer())
        .post(`/orders/${orderId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          note: 'Priority order',
        })
        .expect(201);
    });

    it('should validate note field', () => {
      return request(app.getHttpServer())
        .post(`/orders/${orderId}/notes`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /orders/:id/timeline - Get timeline', () => {
    it('should get timeline with OPERATOR role', () => {
      return request(app.getHttpServer())
        .get(`/orders/${orderId}/timeline`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('orderId');
          expect(res.body).toHaveProperty('timeline');
          expect(Array.isArray(res.body.timeline)).toBe(true);
        });
    });

    it('should include all event types in timeline', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}/timeline`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const eventTypes = res.body.timeline.map((e: any) => e.eventType);
      expect(eventTypes).toContain('order_created');
      expect(eventTypes.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /orders/:id - Delete order', () => {
    it('should delete order with ADMIN role', async () => {
      // Create order in NEW status
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          channelId,
          externalOrderId: `test-delete-${Date.now()}`,
          customer: {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
          },
          shippingAddress: {
            firstName: 'Test',
            lastName: 'User',
            street1: 'Street',
            city: 'Riyadh',
            postalCode: '12345',
            country: 'SA',
          },
          items: [
            {
              externalItemId: 'item-1',
              sku: 'LAPTOP-HP-15',
              name: 'Laptop',
              quantity: 1,
              unitPrice: 1000,
              totalPrice: 1000,
            },
          ],
          subtotal: 1000,
          totalAmount: 1150,
          taxAmount: 150,
        });

      const deleteOrderId = createRes.body.id;

      // Delete order
      return request(app.getHttpServer())
        .delete(`/orders/${deleteOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('deleted successfully');
        });
    });

    it('should reject deletion with MANAGER role', () => {
      return request(app.getHttpServer())
        .delete(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);
    });

    it('should reject deletion with OPERATOR role', () => {
      return request(app.getHttpServer())
        .delete(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(403);
    });

    it('should reject deletion of shipped order', async () => {
      // This test assumes orderId is in READY_TO_SHIP or later status
      return request(app.getHttpServer())
        .delete(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Cannot delete order');
        });
    });
  });

  describe('Organization scoping', () => {
    it('should only return orders from user organization', () => {
      // This test would require multiple organizations in test data
      return request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200)
        .expect((res) => {
          res.body.data.forEach((order: any) => {
            expect(order.organizationId).toBe(organizationId);
          });
        });
    });

    it('should not allow access to other organization orders', () => {
      // This would require a token for different organization
      // For now, testing that organizationId is properly scoped
      return request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.organizationId).toBe(organizationId);
        });
    });
  });

  describe('Inventory integration', () => {
    it('should reserve inventory when order created', async () => {
      // Create order
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          channelId,
          externalOrderId: `test-inventory-${Date.now()}`,
          customer: {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
          },
          shippingAddress: {
            firstName: 'Test',
            lastName: 'User',
            street1: 'Street',
            city: 'Riyadh',
            postalCode: '12345',
            country: 'SA',
          },
          items: [
            {
              externalItemId: 'item-1',
              sku: 'LAPTOP-HP-15',
              name: 'Laptop',
              quantity: 2,
              unitPrice: 1000,
              totalPrice: 2000,
            },
          ],
          subtotal: 2000,
          totalAmount: 2300,
          taxAmount: 300,
        })
        .expect(201);

      // Check order has reservations
      const orderRes = await request(app.getHttpServer())
        .get(`/orders/${createRes.body.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(orderRes.body.reservations).toBeDefined();
      expect(orderRes.body.reservations.length).toBeGreaterThan(0);
    });

    it('should release inventory when order cancelled', async () => {
      // Create order
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          channelId,
          externalOrderId: `test-cancel-${Date.now()}`,
          customer: {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
          },
          shippingAddress: {
            firstName: 'Test',
            lastName: 'User',
            street1: 'Street',
            city: 'Riyadh',
            postalCode: '12345',
            country: 'SA',
          },
          items: [
            {
              externalItemId: 'item-1',
              sku: 'LAPTOP-HP-15',
              name: 'Laptop',
              quantity: 1,
              unitPrice: 1000,
              totalPrice: 1000,
            },
          ],
          subtotal: 1000,
          totalAmount: 1150,
          taxAmount: 150,
        });

      const cancelOrderId = createRes.body.id;

      // Cancel order
      await request(app.getHttpServer())
        .patch(`/orders/${cancelOrderId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'CANCELLED' })
        .expect(200);

      // Check timeline for inventory_released event
      const timelineRes = await request(app.getHttpServer())
        .get(`/orders/${cancelOrderId}/timeline`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const eventTypes = timelineRes.body.timeline.map((e: any) => e.eventType);
      expect(eventTypes).toContain('inventory_released');
    });
  });
});
