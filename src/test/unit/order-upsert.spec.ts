/**
 * Order Upsert Service Unit Tests (ORD-04)
 * 
 * Step A: Write Tests BEFORE Implementation
 * 
 * Tests cover:
 * - Idempotent order creation (channel_id + external_id)
 * - Duplicate webhook handling (returns existing)
 * - Inventory reservation on first creation only
 * - No double-reservation on updates
 * - Line item change detection
 * - Cross-org isolation
 * 
 * Idempotency Key: channel_id + external_id (unique constraint)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
    OrderUpsertService,
    OrderUpsertInput,
    OrderUpsertResult,
    LineItemInput,
} from '../../src/modules/orders/order-upsert.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { OrderStatus } from '../../src/modules/orders/order-state-machine';

describe('OrderUpsertService', () => {
    let service: OrderUpsertService;
    let prisma: jest.Mocked<PrismaService>;

    // Mock inventory service
    const mockInventoryService = {
        reserveForOrder: jest.fn(),
        releaseForOrder: jest.fn(),
        checkAvailability: jest.fn(),
    };

    // Test data
    const testChannelId = 'channel-shopify-123';
    const testOrgId = 'org-123';
    const testExternalId = 'shopify-order-12345';

    const sampleOrderInput: OrderUpsertInput = {
        channelId: testChannelId,
        organizationId: testOrgId,
        externalId: testExternalId,
        externalOrderNumber: 'ORD-001',
        status: OrderStatus.PENDING,
        totalAmount: 150.00,
        currency: 'USD',
        customerEmail: 'customer@example.com',
        customerName: 'John Doe',
        lineItems: [
            { sku: 'PROD-A', quantity: 2, price: 50.00, name: 'Product A' },
            { sku: 'PROD-B', quantity: 1, price: 50.00, name: 'Product B' },
        ],
        shippingAddress: {
            street: '123 Main St',
            city: 'New York',
            country: 'US',
        },
    };

    const existingOrder = {
        id: 'order-uuid-123',
        channelId: testChannelId,
        organizationId: testOrgId,
        externalId: testExternalId,
        externalOrderNumber: 'ORD-001',
        status: OrderStatus.PENDING,
        totalAmount: 150.00,
        currency: 'USD',
        customerEmail: 'customer@example.com',
        customerName: 'John Doe',
        inventoryReserved: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        prisma = {
            order: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                upsert: jest.fn(),
            },
            orderLineItem: {
                createMany: jest.fn(),
                deleteMany: jest.fn(),
                findMany: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
            $queryRaw: jest.fn(),
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
    // IDEMPOTENT CREATE
    // =========================================================================
    describe('idempotent order creation', () => {
        it('should create order with idempotency key (channel_id + external_id)', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(null); // No existing order
            prisma.order.create.mockResolvedValueOnce({
                ...existingOrder,
                id: 'new-order-uuid',
                inventoryReserved: true,
            } as any);
            mockInventoryService.reserveForOrder.mockResolvedValueOnce({ success: true });

            const result = await service.upsertOrder(sampleOrderInput);

            expect(result.created).toBe(true);
            expect(result.order.id).toBeDefined();
            expect(prisma.order.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        channelId: testChannelId,
                        externalId: testExternalId,
                    }),
                })
            );
        });

        it('should generate idempotency key from channel_id + external_id', () => {
            const key = service.generateIdempotencyKey(testChannelId, testExternalId);

            expect(key).toBe(`${testChannelId}:${testExternalId}`);
        });

        it('should enforce unique constraint on idempotency key', async () => {
            // First call finds existing order (simulates race condition resolved)
            prisma.order.findFirst.mockResolvedValueOnce(existingOrder as any);
            prisma.orderLineItem.findMany.mockResolvedValueOnce([
                { sku: 'PROD-A', quantity: 2 },
                { sku: 'PROD-B', quantity: 1 },
            ] as any);

            const result = await service.upsertOrder(sampleOrderInput);

            expect(result.created).toBe(false);
            expect(result.order.id).toBe(existingOrder.id);
        });
    });

    // =========================================================================
    // DUPLICATE RETURNS EXISTING
    // =========================================================================
    describe('duplicate handling', () => {
        it('should return existing order on duplicate webhook', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(existingOrder as any);
            prisma.orderLineItem.findMany.mockResolvedValueOnce([
                { sku: 'PROD-A', quantity: 2 },
                { sku: 'PROD-B', quantity: 1 },
            ] as any);

            const result = await service.upsertOrder(sampleOrderInput);

            expect(result.created).toBe(false);
            expect(result.updated).toBe(false);
            expect(result.order.id).toBe(existingOrder.id);
        });

        it('should not call create when order already exists', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(existingOrder as any);
            prisma.orderLineItem.findMany.mockResolvedValueOnce([
                { sku: 'PROD-A', quantity: 2 },
                { sku: 'PROD-B', quantity: 1 },
            ] as any);

            await service.upsertOrder(sampleOrderInput);

            expect(prisma.order.create).not.toHaveBeenCalled();
        });

        it('should update existing order when data changes', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(existingOrder as any);
            prisma.order.update.mockResolvedValueOnce({
                ...existingOrder,
                totalAmount: 200.00,
            } as any);

            const updatedInput = {
                ...sampleOrderInput,
                totalAmount: 200.00, // Changed
            };

            const result = await service.upsertOrder(updatedInput);

            expect(result.updated).toBe(true);
            expect(prisma.order.update).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // INVENTORY RESERVATION - FIRST CREATION ONLY
    // =========================================================================
    describe('inventory reservation on first creation', () => {
        it('should reserve inventory on first order creation', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(null);
            prisma.order.create.mockResolvedValueOnce({
                ...existingOrder,
                inventoryReserved: true,
            } as any);
            mockInventoryService.reserveForOrder.mockResolvedValueOnce({ success: true });

            await service.upsertOrder(sampleOrderInput);

            expect(mockInventoryService.reserveForOrder).toHaveBeenCalledWith(
                expect.objectContaining({
                    organizationId: testOrgId,
                    lineItems: expect.arrayContaining([
                        expect.objectContaining({ sku: 'PROD-A', quantity: 2 }),
                        expect.objectContaining({ sku: 'PROD-B', quantity: 1 }),
                    ]),
                })
            );
        });

        it('should mark order as inventoryReserved after successful reservation', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(null);
            prisma.order.create.mockResolvedValueOnce({
                ...existingOrder,
                inventoryReserved: true,
            } as any);
            mockInventoryService.reserveForOrder.mockResolvedValueOnce({ success: true });

            const result = await service.upsertOrder(sampleOrderInput);

            expect(result.inventoryReserved).toBe(true);
        });

        it('should NOT reserve inventory on update (duplicate)', async () => {
            prisma.order.findFirst.mockResolvedValueOnce({
                ...existingOrder,
                inventoryReserved: true,
            } as any);

            await service.upsertOrder(sampleOrderInput);

            expect(mockInventoryService.reserveForOrder).not.toHaveBeenCalled();
        });

        it('should NOT double-reserve if already reserved', async () => {
            prisma.order.findFirst.mockResolvedValueOnce({
                ...existingOrder,
                inventoryReserved: true,
            } as any);
            prisma.order.update.mockResolvedValueOnce(existingOrder as any);

            // Update with new data
            const updatedInput = { ...sampleOrderInput, customerName: 'Jane Doe' };
            await service.upsertOrder(updatedInput);

            expect(mockInventoryService.reserveForOrder).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // LINE ITEM CHANGE DETECTION
    // =========================================================================
    describe('line item change detection', () => {
        it('should flag when line items are added', async () => {
            const existingWithLineItems = {
                ...existingOrder,
                lineItems: [
                    { sku: 'PROD-A', quantity: 2 },
                ],
            };
            prisma.order.findFirst.mockResolvedValueOnce(existingWithLineItems as any);
            prisma.orderLineItem.findMany.mockResolvedValueOnce([
                { sku: 'PROD-A', quantity: 2 },
            ] as any);
            prisma.order.update.mockResolvedValueOnce(existingOrder as any);

            const inputWithNewItem = {
                ...sampleOrderInput,
                lineItems: [
                    { sku: 'PROD-A', quantity: 2, price: 50, name: 'Product A' },
                    { sku: 'PROD-C', quantity: 1, price: 75, name: 'Product C' }, // NEW
                ],
            };

            const result = await service.upsertOrder(inputWithNewItem);

            expect(result.lineItemsChanged).toBe(true);
        });

        it('should flag when line item quantity changes', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(existingOrder as any);
            prisma.orderLineItem.findMany.mockResolvedValueOnce([
                { sku: 'PROD-A', quantity: 2 },
                { sku: 'PROD-B', quantity: 1 },
            ] as any);
            prisma.order.update.mockResolvedValueOnce(existingOrder as any);

            const inputWithQuantityChange = {
                ...sampleOrderInput,
                lineItems: [
                    { sku: 'PROD-A', quantity: 5, price: 50, name: 'Product A' }, // Changed from 2
                    { sku: 'PROD-B', quantity: 1, price: 50, name: 'Product B' },
                ],
            };

            const result = await service.upsertOrder(inputWithQuantityChange);

            expect(result.lineItemsChanged).toBe(true);
        });

        it('should NOT flag when line items are unchanged', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(existingOrder as any);
            prisma.orderLineItem.findMany.mockResolvedValueOnce([
                { sku: 'PROD-A', quantity: 2 },
                { sku: 'PROD-B', quantity: 1 },
            ] as any);

            const result = await service.upsertOrder(sampleOrderInput);

            expect(result.lineItemsChanged).toBe(false);
        });

        it('should flag when line items are removed', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(existingOrder as any);
            prisma.orderLineItem.findMany.mockResolvedValueOnce([
                { sku: 'PROD-A', quantity: 2 },
                { sku: 'PROD-B', quantity: 1 },
                { sku: 'PROD-C', quantity: 3 }, // Will be removed
            ] as any);
            prisma.order.update.mockResolvedValueOnce(existingOrder as any);

            const result = await service.upsertOrder(sampleOrderInput);

            expect(result.lineItemsChanged).toBe(true);
        });
    });

    // =========================================================================
    // CROSS-ORG ISOLATION
    // =========================================================================
    describe('cross-org isolation', () => {
        it('should not find order from different organization', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(null); // Not found in this org
            prisma.order.create.mockResolvedValueOnce({
                ...existingOrder,
                organizationId: 'org-456',
            } as any);
            mockInventoryService.reserveForOrder.mockResolvedValueOnce({ success: true });

            const inputForDifferentOrg = {
                ...sampleOrderInput,
                organizationId: 'org-456',
            };

            const result = await service.upsertOrder(inputForDifferentOrg);

            expect(prisma.order.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: 'org-456',
                    }),
                })
            );
            expect(result.created).toBe(true);
        });

        it('should allow same external_id in different organizations', async () => {
            // Org 1 has the order
            prisma.order.findFirst.mockResolvedValueOnce(null);
            prisma.order.create.mockResolvedValueOnce({
                ...existingOrder,
                organizationId: 'org-other',
            } as any);
            mockInventoryService.reserveForOrder.mockResolvedValueOnce({ success: true });

            const inputOtherOrg = {
                ...sampleOrderInput,
                organizationId: 'org-other',
            };

            const result = await service.upsertOrder(inputOtherOrg);

            expect(result.created).toBe(true);
        });

        it('should scope channel lookup to organization', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(existingOrder as any);

            await service.upsertOrder(sampleOrderInput);

            expect(prisma.order.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        channelId: testChannelId,
                        externalId: testExternalId,
                        organizationId: testOrgId,
                    }),
                })
            );
        });
    });

    // =========================================================================
    // VALIDATION
    // =========================================================================
    describe('input validation', () => {
        it('should reject order with missing channelId', async () => {
            const invalidInput = { ...sampleOrderInput, channelId: '' };

            await expect(service.upsertOrder(invalidInput)).rejects.toThrow(BadRequestException);
        });

        it('should reject order with missing externalId', async () => {
            const invalidInput = { ...sampleOrderInput, externalId: '' };

            await expect(service.upsertOrder(invalidInput)).rejects.toThrow(BadRequestException);
        });

        it('should reject order with empty line items', async () => {
            const invalidInput = { ...sampleOrderInput, lineItems: [] };

            await expect(service.upsertOrder(invalidInput)).rejects.toThrow(BadRequestException);
        });

        it('should reject order with negative quantity', async () => {
            const invalidInput = {
                ...sampleOrderInput,
                lineItems: [{ sku: 'PROD', quantity: -1, price: 10, name: 'Test' }],
            };

            await expect(service.upsertOrder(invalidInput)).rejects.toThrow(BadRequestException);
        });
    });

    // =========================================================================
    // ERROR HANDLING
    // =========================================================================
    describe('error handling', () => {
        it('should rollback on inventory reservation failure', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(null);
            mockInventoryService.reserveForOrder.mockRejectedValueOnce(
                new Error('Insufficient stock')
            );

            await expect(service.upsertOrder(sampleOrderInput)).rejects.toThrow(/Insufficient stock/);
            expect(prisma.order.create).not.toHaveBeenCalled();
        });

        it('should handle database connection errors', async () => {
            prisma.order.findFirst.mockRejectedValueOnce(new Error('Connection failed'));

            await expect(service.upsertOrder(sampleOrderInput)).rejects.toThrow(/Connection failed/);
        });
    });

    // =========================================================================
    // CONCURRENCY HELPER
    // =========================================================================
    describe('advisory lock', () => {
        it('should acquire advisory lock for idempotency key', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(null);
            prisma.order.create.mockResolvedValueOnce(existingOrder as any);
            mockInventoryService.reserveForOrder.mockResolvedValueOnce({ success: true });

            await service.upsertOrder(sampleOrderInput);

            // Should call $queryRaw for advisory lock
            expect(prisma.$queryRaw).toHaveBeenCalled();
        });
    });
});
