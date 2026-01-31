/**
 * Order Cancellation Service Unit Tests (ORD-03)
 * 
 * Step A: Write Tests BEFORE Implementation
 * 
 * Tests cover:
 * - Inventory released for PENDING/CONFIRMED/PROCESSING
 * - SHIPPED/DELIVERED cannot be cancelled
 * - Idempotent cancellation
 * - Atomic status + inventory update
 * - Audit event emission
 * - Cross-org isolation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
    OrderCancellationService,
    CancellationResult,
    CancellationReason,
} from '../../src/modules/orders/order-cancellation.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { OrderStatus } from '../../src/modules/orders/order-state-machine';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('OrderCancellationService', () => {
    let service: OrderCancellationService;
    let prisma: jest.Mocked<PrismaService>;
    let eventEmitter: jest.Mocked<EventEmitter2>;

    // Mock inventory service
    const mockInventoryService = {
        releaseForOrder: jest.fn(),
        getReservationForOrder: jest.fn(),
    };

    // Test data
    const testOrgId = 'org-123';
    const testChannelId = 'channel-shopify-123';

    const createMockOrder = (status: OrderStatus, inventoryReserved = true) => ({
        id: `order-${Date.now()}`,
        organizationId: testOrgId,
        channelId: testChannelId,
        externalId: 'ext-order-123',
        status,
        inventoryReserved,
        lineItems: [
            { id: 'li-1', sku: 'PROD-A', quantity: 2 },
            { id: 'li-2', sku: 'PROD-B', quantity: 1 },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    beforeEach(async () => {
        jest.clearAllMocks();

        prisma = {
            order: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
            },
            orderLineItem: {
                findMany: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
        } as any;

        eventEmitter = {
            emit: jest.fn(),
            emitAsync: jest.fn(),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrderCancellationService,
                { provide: PrismaService, useValue: prisma },
                { provide: 'InventoryService', useValue: mockInventoryService },
                { provide: EventEmitter2, useValue: eventEmitter },
            ],
        }).compile();

        service = module.get<OrderCancellationService>(OrderCancellationService);
    });

    // =========================================================================
    // INVENTORY RELEASED FOR CANCELLABLE STATES
    // =========================================================================
    describe('inventory release for cancellable states', () => {
        it('should release inventory for PENDING order', async () => {
            const order = createMockOrder(OrderStatus.PENDING);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);
            prisma.order.update.mockResolvedValueOnce({
                ...order,
                status: OrderStatus.CANCELLED,
                inventoryReserved: false,
            } as any);
            mockInventoryService.releaseForOrder.mockResolvedValueOnce({ success: true });

            const result = await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.CUSTOMER_REQUEST,
            });

            expect(result.cancelled).toBe(true);
            expect(result.inventoryReleased).toBe(true);
            expect(mockInventoryService.releaseForOrder).toHaveBeenCalledWith({
                orderId: order.id,
                lineItems: expect.any(Array),
            });
        });

        it('should release inventory for CONFIRMED order', async () => {
            const order = createMockOrder(OrderStatus.CONFIRMED);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);
            prisma.order.update.mockResolvedValueOnce({
                ...order,
                status: OrderStatus.CANCELLED,
            } as any);
            mockInventoryService.releaseForOrder.mockResolvedValueOnce({ success: true });

            const result = await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.CUSTOMER_REQUEST,
            });

            expect(result.cancelled).toBe(true);
            expect(result.inventoryReleased).toBe(true);
        });

        it('should release inventory for PROCESSING order', async () => {
            const order = createMockOrder(OrderStatus.PROCESSING);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);
            prisma.order.update.mockResolvedValueOnce({
                ...order,
                status: OrderStatus.CANCELLED,
            } as any);
            mockInventoryService.releaseForOrder.mockResolvedValueOnce({ success: true });

            const result = await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.OUT_OF_STOCK,
            });

            expect(result.cancelled).toBe(true);
            expect(result.inventoryReleased).toBe(true);
        });

        it('should release correct quantity per line item', async () => {
            const order = createMockOrder(OrderStatus.PENDING);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);
            prisma.order.update.mockResolvedValueOnce({
                ...order,
                status: OrderStatus.CANCELLED,
            } as any);
            mockInventoryService.releaseForOrder.mockResolvedValueOnce({ success: true });

            await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.CUSTOMER_REQUEST,
            });

            expect(mockInventoryService.releaseForOrder).toHaveBeenCalledWith({
                orderId: order.id,
                lineItems: expect.arrayContaining([
                    expect.objectContaining({ sku: 'PROD-A', quantity: 2 }),
                    expect.objectContaining({ sku: 'PROD-B', quantity: 1 }),
                ]),
            });
        });
    });

    // =========================================================================
    // NON-CANCELLABLE STATES
    // =========================================================================
    describe('non-cancellable states', () => {
        it('should reject cancellation for SHIPPED order', async () => {
            const order = createMockOrder(OrderStatus.SHIPPED);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);

            await expect(
                service.cancelOrder({
                    orderId: order.id,
                    organizationId: testOrgId,
                    reason: CancellationReason.CUSTOMER_REQUEST,
                })
            ).rejects.toThrow(BadRequestException);

            expect(mockInventoryService.releaseForOrder).not.toHaveBeenCalled();
        });

        it('should reject cancellation for DELIVERED order', async () => {
            const order = createMockOrder(OrderStatus.DELIVERED);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);

            await expect(
                service.cancelOrder({
                    orderId: order.id,
                    organizationId: testOrgId,
                    reason: CancellationReason.CUSTOMER_REQUEST,
                })
            ).rejects.toThrow(BadRequestException);

            expect(mockInventoryService.releaseForOrder).not.toHaveBeenCalled();
        });

        it('should provide descriptive error for non-cancellable state', async () => {
            const order = createMockOrder(OrderStatus.SHIPPED);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);

            try {
                await service.cancelOrder({
                    orderId: order.id,
                    organizationId: testOrgId,
                    reason: CancellationReason.CUSTOMER_REQUEST,
                });
                fail('Should have thrown');
            } catch (error) {
                expect(error.message).toContain('SHIPPED');
            }
        });
    });

    // =========================================================================
    // IDEMPOTENT CANCELLATION
    // =========================================================================
    describe('idempotent cancellation', () => {
        it('should return success for already cancelled order', async () => {
            const order = createMockOrder(OrderStatus.CANCELLED);
            order.inventoryReserved = false;
            prisma.order.findFirst.mockResolvedValueOnce(order as any);

            const result = await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.CUSTOMER_REQUEST,
            });

            expect(result.cancelled).toBe(true);
            expect(result.alreadyCancelled).toBe(true);
            expect(result.inventoryReleased).toBe(false);
        });

        it('should not release inventory twice for already cancelled order', async () => {
            const order = createMockOrder(OrderStatus.CANCELLED);
            order.inventoryReserved = false;
            prisma.order.findFirst.mockResolvedValueOnce(order as any);

            await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.CUSTOMER_REQUEST,
            });

            expect(mockInventoryService.releaseForOrder).not.toHaveBeenCalled();
        });

        it('should handle concurrent cancellation requests', async () => {
            const order = createMockOrder(OrderStatus.PENDING);
            prisma.order.findFirst.mockResolvedValue(order as any);
            prisma.order.update.mockResolvedValue({
                ...order,
                status: OrderStatus.CANCELLED,
            } as any);
            mockInventoryService.releaseForOrder.mockResolvedValue({ success: true });

            // Simulate concurrent requests
            const results = await Promise.all([
                service.cancelOrder({
                    orderId: order.id,
                    organizationId: testOrgId,
                    reason: CancellationReason.CUSTOMER_REQUEST,
                }),
                service.cancelOrder({
                    orderId: order.id,
                    organizationId: testOrgId,
                    reason: CancellationReason.CUSTOMER_REQUEST,
                }),
            ]);

            // Both should succeed (one actual, one idempotent)
            expect(results.filter(r => r.cancelled)).toHaveLength(2);
        });
    });

    // =========================================================================
    // ATOMIC STATUS + INVENTORY UPDATE
    // =========================================================================
    describe('atomic operations', () => {
        it('should update status and release inventory atomically', async () => {
            const order = createMockOrder(OrderStatus.PENDING);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);
            prisma.order.update.mockResolvedValueOnce({
                ...order,
                status: OrderStatus.CANCELLED,
            } as any);
            mockInventoryService.releaseForOrder.mockResolvedValueOnce({ success: true });

            await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.CUSTOMER_REQUEST,
            });

            // Should be called within transaction
            expect(prisma.$transaction).toHaveBeenCalled();
        });

        it('should rollback if inventory release fails', async () => {
            const order = createMockOrder(OrderStatus.PENDING);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);
            mockInventoryService.releaseForOrder.mockRejectedValueOnce(
                new Error('Inventory release failed')
            );

            await expect(
                service.cancelOrder({
                    orderId: order.id,
                    organizationId: testOrgId,
                    reason: CancellationReason.CUSTOMER_REQUEST,
                })
            ).rejects.toThrow(/inventory|release|failed/i);

            // Order status should not be updated if inventory release fails
            expect(prisma.order.update).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // AUDIT EVENT EMISSION
    // =========================================================================
    describe('audit events', () => {
        it('should emit cancellation audit event', async () => {
            const order = createMockOrder(OrderStatus.PENDING);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);
            prisma.order.update.mockResolvedValueOnce({
                ...order,
                status: OrderStatus.CANCELLED,
            } as any);
            mockInventoryService.releaseForOrder.mockResolvedValueOnce({ success: true });

            await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.CUSTOMER_REQUEST,
            });

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'order.cancelled',
                expect.objectContaining({
                    orderId: order.id,
                    previousStatus: OrderStatus.PENDING,
                    reason: CancellationReason.CUSTOMER_REQUEST,
                })
            );
        });

        it('should include inventory release info in audit event', async () => {
            const order = createMockOrder(OrderStatus.CONFIRMED);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);
            prisma.order.update.mockResolvedValueOnce({
                ...order,
                status: OrderStatus.CANCELLED,
            } as any);
            mockInventoryService.releaseForOrder.mockResolvedValueOnce({ success: true });

            await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.OUT_OF_STOCK,
            });

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'order.cancelled',
                expect.objectContaining({
                    inventoryReleased: true,
                    lineItems: expect.arrayContaining([
                        expect.objectContaining({ sku: 'PROD-A' }),
                    ]),
                })
            );
        });
    });

    // =========================================================================
    // CROSS-ORG ISOLATION
    // =========================================================================
    describe('cross-org isolation', () => {
        it('should reject cancellation of order from different org', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(null); // Not found in this org

            await expect(
                service.cancelOrder({
                    orderId: 'order-123',
                    organizationId: 'different-org',
                    reason: CancellationReason.CUSTOMER_REQUEST,
                })
            ).rejects.toThrow(NotFoundException);
        });

        it('should scope order lookup to organization', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(null);

            try {
                await service.cancelOrder({
                    orderId: 'order-123',
                    organizationId: testOrgId,
                    reason: CancellationReason.CUSTOMER_REQUEST,
                });
            } catch { }

            expect(prisma.order.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: testOrgId,
                    }),
                })
            );
        });
    });

    // =========================================================================
    // CANCELLATION REASONS
    // =========================================================================
    describe('cancellation reasons', () => {
        it('should accept CUSTOMER_REQUEST reason', async () => {
            const order = createMockOrder(OrderStatus.PENDING);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);
            prisma.order.update.mockResolvedValueOnce({
                ...order,
                status: OrderStatus.CANCELLED,
            } as any);
            mockInventoryService.releaseForOrder.mockResolvedValueOnce({ success: true });

            const result = await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.CUSTOMER_REQUEST,
            });

            expect(result.reason).toBe(CancellationReason.CUSTOMER_REQUEST);
        });

        it('should accept OUT_OF_STOCK reason', async () => {
            const order = createMockOrder(OrderStatus.PENDING);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);
            prisma.order.update.mockResolvedValueOnce({
                ...order,
                status: OrderStatus.CANCELLED,
            } as any);
            mockInventoryService.releaseForOrder.mockResolvedValueOnce({ success: true });

            const result = await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.OUT_OF_STOCK,
            });

            expect(result.reason).toBe(CancellationReason.OUT_OF_STOCK);
        });

        it('should store cancellation reason with order', async () => {
            const order = createMockOrder(OrderStatus.PENDING);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);
            prisma.order.update.mockResolvedValueOnce({
                ...order,
                status: OrderStatus.CANCELLED,
                cancellationReason: CancellationReason.FRAUD_SUSPECTED,
            } as any);
            mockInventoryService.releaseForOrder.mockResolvedValueOnce({ success: true });

            await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.FRAUD_SUSPECTED,
            });

            expect(prisma.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        cancellationReason: CancellationReason.FRAUD_SUSPECTED,
                    }),
                })
            );
        });
    });

    // =========================================================================
    // NO INVENTORY RESERVED
    // =========================================================================
    describe('orders without inventory reservation', () => {
        it('should cancel order without releasing if no inventory was reserved', async () => {
            const order = createMockOrder(OrderStatus.PENDING, false);
            prisma.order.findFirst.mockResolvedValueOnce(order as any);
            prisma.order.update.mockResolvedValueOnce({
                ...order,
                status: OrderStatus.CANCELLED,
            } as any);

            const result = await service.cancelOrder({
                orderId: order.id,
                organizationId: testOrgId,
                reason: CancellationReason.CUSTOMER_REQUEST,
            });

            expect(result.cancelled).toBe(true);
            expect(result.inventoryReleased).toBe(false);
            expect(mockInventoryService.releaseForOrder).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // ERROR HANDLING
    // =========================================================================
    describe('error handling', () => {
        it('should handle order not found', async () => {
            prisma.order.findFirst.mockResolvedValueOnce(null);

            await expect(
                service.cancelOrder({
                    orderId: 'non-existent',
                    organizationId: testOrgId,
                    reason: CancellationReason.CUSTOMER_REQUEST,
                })
            ).rejects.toThrow(NotFoundException);
        });

        it('should handle database errors gracefully', async () => {
            prisma.order.findFirst.mockRejectedValueOnce(new Error('DB connection failed'));

            await expect(
                service.cancelOrder({
                    orderId: 'order-123',
                    organizationId: testOrgId,
                    reason: CancellationReason.CUSTOMER_REQUEST,
                })
            ).rejects.toThrow(/DB connection failed/);
        });
    });
});
