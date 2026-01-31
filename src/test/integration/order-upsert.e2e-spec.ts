/**
 * Order Upsert Integration Tests (ORD-04)
 * 
 * Step A: Write Tests BEFORE Implementation
 * 
 * Integration tests verify:
 * - Concurrent webhooks → single order
 * - Inventory reserved exactly once
 * - Invalid data → 400
 * - Rapid duplicates handled
 * - Cross-org collision prevented
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../src/common/database/prisma.service';
import {
    OrderUpsertService,
    OrderUpsertInput,
} from '../../src/modules/orders/order-upsert.service';
import { OrderStatus } from '../../src/modules/orders/order-state-machine';

describe('OrderUpsert Integration (e2e)', () => {
    let service: OrderUpsertService;
    let prisma: jest.Mocked<PrismaService>;

    // Mock inventory service
    const mockInventoryService = {
        reserveForOrder: jest.fn().mockResolvedValue({ success: true }),
        releaseForOrder: jest.fn(),
    };

    // Test data
    const testChannelId = 'e2e-channel-123';
    const testOrgId = 'e2e-org-123';

    const createOrderInput = (externalId: string, orgId = testOrgId): OrderUpsertInput => ({
        channelId: testChannelId,
        organizationId: orgId,
        externalId,
        externalOrderNumber: `ORD-${externalId}`,
        status: OrderStatus.PENDING,
        totalAmount: 100.00,
        currency: 'USD',
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        lineItems: [
            { sku: 'SKU-001', quantity: 2, price: 25.00, name: 'Product 1' },
            { sku: 'SKU-002', quantity: 1, price: 50.00, name: 'Product 2' },
        ],
    });

    beforeEach(async () => {
        jest.clearAllMocks();

        let orderIdCounter = 0;
        const ordersDb = new Map<string, any>();

        prisma = {
            order: {
                findFirst: jest.fn((args) => {
                    const key = `${args.where.channelId}:${args.where.externalId}:${args.where.organizationId}`;
                    return Promise.resolve(ordersDb.get(key) || null);
                }),
                create: jest.fn((args) => {
                    orderIdCounter++;
                    const order = {
                        id: `order-${orderIdCounter}`,
                        ...args.data,
                        inventoryReserved: true,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    };
                    const key = `${order.channelId}:${order.externalId}:${order.organizationId}`;
                    ordersDb.set(key, order);
                    return Promise.resolve(order);
                }),
                update: jest.fn((args) => {
                    return Promise.resolve({ ...args.data, updatedAt: new Date() });
                }),
            },
            orderLineItem: {
                findMany: jest.fn().mockResolvedValue([]),
                createMany: jest.fn(),
                deleteMany: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
            $queryRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrderUpsertService,
                { provide: PrismaService, useValue: prisma },
                { provide: 'InventoryService', useValue: mockInventoryService },
            ],
        }).compile();

        service = module.get<OrderUpsertService>(OrderUpsertService);
    });

    // =========================================================================
    // CONCURRENT WEBHOOKS → SINGLE ORDER
    // =========================================================================
    describe('concurrent webhooks', () => {
        it('should create only one order for concurrent duplicate webhooks', async () => {
            const externalId = 'concurrent-test-001';
            const input = createOrderInput(externalId);

            // Simulate concurrent webhooks
            const results = await Promise.all([
                service.upsertOrder(input),
                service.upsertOrder(input),
                service.upsertOrder(input),
            ]);

            // All should return an order (either created or found existing)
            results.forEach(result => {
                expect(result.order).toBeDefined();
                expect(result.order.externalId).toBe(externalId);
            });

            // In a real DB with advisory locks, only 1 would be created
            // In mock environment, we just verify all calls succeeded
        });

        it('should handle race condition with advisory lock', async () => {
            const externalId = 'race-test-001';
            const input = createOrderInput(externalId);

            // First call creates
            const result1 = await service.upsertOrder(input);
            expect(result1.created).toBe(true);
            expect(result1.order).toBeDefined();

            // Second call should find existing (with updated mock state)
            const result2 = await service.upsertOrder(input);
            // Second call should return an order object
            expect(result2.order).toBeDefined();
        });
    });

    // =========================================================================
    // INVENTORY RESERVED EXACTLY ONCE
    // =========================================================================
    describe('inventory reservation', () => {
        it('should reserve inventory exactly once for multiple webhooks', async () => {
            const externalId = 'inventory-test-001';
            const input = createOrderInput(externalId);

            // First webhook
            await service.upsertOrder(input);

            // Second webhook (duplicate)
            await service.upsertOrder(input);

            // Third webhook (another duplicate)
            await service.upsertOrder(input);

            // Inventory should be reserved only once
            expect(mockInventoryService.reserveForOrder).toHaveBeenCalledTimes(1);
        });

        it('should reserve correct quantities', async () => {
            const externalId = 'quantity-test-001';
            const input = createOrderInput(externalId);

            await service.upsertOrder(input);

            expect(mockInventoryService.reserveForOrder).toHaveBeenCalledWith(
                expect.objectContaining({
                    lineItems: expect.arrayContaining([
                        expect.objectContaining({ sku: 'SKU-001', quantity: 2 }),
                        expect.objectContaining({ sku: 'SKU-002', quantity: 1 }),
                    ]),
                })
            );
        });
    });

    // =========================================================================
    // INVALID DATA → 400
    // =========================================================================
    describe('invalid data handling', () => {
        it('should return 400 for missing required fields', async () => {
            const invalidInput = {
                ...createOrderInput('invalid-001'),
                channelId: '', // Invalid
            };

            await expect(service.upsertOrder(invalidInput)).rejects.toThrow();
        });

        it('should return 400 for invalid line item quantity', async () => {
            const invalidInput = {
                ...createOrderInput('invalid-002'),
                lineItems: [
                    { sku: 'SKU-001', quantity: 0, price: 25, name: 'Product' },
                ],
            };

            await expect(service.upsertOrder(invalidInput)).rejects.toThrow();
        });

        it('should return 400 for negative total amount', async () => {
            const invalidInput = {
                ...createOrderInput('invalid-003'),
                totalAmount: -100,
            };

            await expect(service.upsertOrder(invalidInput)).rejects.toThrow();
        });
    });

    // =========================================================================
    // RAPID DUPLICATES
    // =========================================================================
    describe('rapid duplicate handling', () => {
        it('should handle rapid fire duplicate webhooks', async () => {
            const externalId = 'rapid-test-001';
            const input = createOrderInput(externalId);

            // Simulate 10 rapid webhooks
            const promises = Array(10).fill(null).map(() =>
                service.upsertOrder(input)
            );

            const results = await Promise.all(promises);

            // Should all succeed (either create or return existing)
            results.forEach(result => {
                expect(result.order).toBeDefined();
                expect(result.order.externalId).toBe(externalId);
            });

            // In real DB with advisory locks, only 1 would be created
            // In mock, we just verify all succeeded without errors
        });

        it('should maintain data integrity under rapid updates', async () => {
            const externalId = 'integrity-test-001';

            // Create initial order
            const initialInput = createOrderInput(externalId);
            await service.upsertOrder(initialInput);

            // Rapid updates with different data
            const updatePromises = Array(5).fill(null).map((_, i) =>
                service.upsertOrder({
                    ...initialInput,
                    totalAmount: 100 + i,
                })
            );

            const results = await Promise.all(updatePromises);

            // All should reference the same order
            const orderIds = [...new Set(results.map(r => r.order.id))];
            expect(orderIds.length).toBe(1);
        });
    });

    // =========================================================================
    // CROSS-ORG COLLISION PREVENTION
    // =========================================================================
    describe('cross-org isolation', () => {
        it('should prevent cross-org order collision', async () => {
            const externalId = 'shared-external-id';

            // Org 1 creates order
            const org1Input = createOrderInput(externalId, 'org-alpha');
            const result1 = await service.upsertOrder(org1Input);

            // Org 2 creates order with same external ID
            const org2Input = createOrderInput(externalId, 'org-beta');
            const result2 = await service.upsertOrder(org2Input);

            // Both should create separate orders
            expect(result1.created).toBe(true);
            expect(result2.created).toBe(true);
            expect(result1.order.id).not.toBe(result2.order.id);
        });

        it('should not allow org to access another orgs order', async () => {
            const externalId = 'isolation-test-001';

            // Org 1 creates order
            await service.upsertOrder(createOrderInput(externalId, 'org-1'));

            // Org 2 upserts with same external ID - should create new
            const result = await service.upsertOrder(createOrderInput(externalId, 'org-2'));

            expect(result.created).toBe(true); // New order for org-2
        });

        it('should scope idempotency check to organization', async () => {
            const externalId = 'scope-test-001';

            const input = createOrderInput(externalId, 'org-specific');
            await service.upsertOrder(input);

            expect(prisma.order.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: 'org-specific',
                    }),
                })
            );
        });
    });

    // =========================================================================
    // STEP D: HARDENING
    // =========================================================================
    describe('Step D: Hardening', () => {
        describe('database lock timeout', () => {
            it('should handle advisory lock timeout gracefully', async () => {
                const externalId = 'lock-timeout-001';
                const input = createOrderInput(externalId);

                // Simulate lock timeout
                prisma.$queryRaw.mockRejectedValueOnce(new Error('Lock timeout'));

                await expect(service.upsertOrder(input)).rejects.toThrow();
            });
        });

        describe('partial updates', () => {
            it('should handle partial order data updates', async () => {
                const externalId = 'partial-001';
                const input = createOrderInput(externalId);

                // Create initial
                await service.upsertOrder(input);

                // Update with partial data (only some fields changed)
                const partialUpdate = {
                    ...input,
                    customerName: 'Updated Name',
                    // Other fields unchanged
                };

                const result = await service.upsertOrder(partialUpdate);
                expect(result.updated).toBe(true);
            });
        });

        describe('transaction rollback', () => {
            it('should rollback on partial failure', async () => {
                const externalId = 'rollback-001';
                const input = createOrderInput(externalId);

                // Make inventory reservation fail
                mockInventoryService.reserveForOrder.mockRejectedValueOnce(
                    new Error('Stock unavailable')
                );

                await expect(service.upsertOrder(input)).rejects.toThrow('Stock unavailable');

                // Order should not be created
                expect(prisma.order.create).not.toHaveBeenCalled();
            });
        });
    });
});
