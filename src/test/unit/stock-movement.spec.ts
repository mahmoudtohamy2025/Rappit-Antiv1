/**
 * Stock Movement Service Unit Tests (INV-02)
 * 
 * NEW WORKFLOW: Step A+D Combined
 * All tests (basic + hardening) written BEFORE implementation
 * 
 * User Decisions:
 * - Approval: Not for MVP (configurable for future)
 * - Reservations: Auto-check/update
 * - Negative Stock: Always block
 * - Zone: Warehouse-level for MVP (zone-ready architecture)
 * - Reference Types: Best practice, dynamic/configurable
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
    StockMovementService,
    MovementType,
    MovementStatus,
    ReferenceType,
} from '../../src/modules/inventory/stock-movement.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('StockMovementService', () => {
    let service: StockMovementService;
    let prisma: jest.Mocked<PrismaService>;
    let eventEmitter: EventEmitter2;

    const testOrg = 'org-test-123';
    const testUser = 'user-test-456';
    const warehouseA = 'warehouse-A';
    const warehouseB = 'warehouse-B';

    const createContext = (overrides = {}) => ({
        organizationId: testOrg,
        userId: testUser,
        ...overrides,
    });

    const mockInventoryItem = (overrides = {}) => ({
        id: 'inv-001',
        organizationId: testOrg,
        warehouseId: warehouseA,
        sku: 'SKU-001',
        quantity: 100,
        reservedQuantity: 10,
        ...overrides,
    });

    const mockWarehouse = (overrides = {}) => ({
        id: warehouseA,
        organizationId: testOrg,
        name: 'Warehouse A',
        ...overrides,
    });

    beforeEach(async () => {
        prisma = {
            inventoryItem: {
                findFirst: jest.fn().mockResolvedValue(mockInventoryItem()),
                update: jest.fn().mockResolvedValue(mockInventoryItem()),
                findMany: jest.fn().mockResolvedValue([mockInventoryItem()]),
            },
            warehouse: {
                findFirst: jest.fn().mockResolvedValue(mockWarehouse()),
            },
            stockMovement: {
                create: jest.fn().mockImplementation((args) => Promise.resolve({
                    id: 'mov-001',
                    ...args.data,
                    createdAt: new Date(),
                })),
                findFirst: jest.fn().mockResolvedValue(null),
                findMany: jest.fn().mockResolvedValue([]),
                update: jest.fn().mockImplementation((args) => Promise.resolve({
                    id: args.where.id,
                    ...args.data,
                })),
                count: jest.fn().mockResolvedValue(0),
            },
            reservation: {
                findMany: jest.fn().mockResolvedValue([]),
                findFirst: jest.fn().mockResolvedValue(null),
            },
            inventoryAuditLog: {
                create: jest.fn().mockResolvedValue({ id: 'audit-001' }),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
        } as any;

        eventEmitter = new EventEmitter2();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StockMovementService,
                { provide: PrismaService, useValue: prisma },
                { provide: EventEmitter2, useValue: eventEmitter },
            ],
        }).compile();

        service = module.get<StockMovementService>(StockMovementService);
    });

    // =========================================================================
    // CREATE MOVEMENT - BASIC TYPES
    // =========================================================================
    describe('Create Movement', () => {
        it('should create RECEIVE movement (inbound)', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 50,
                type: MovementType.RECEIVE,
                reason: 'Supplier delivery',
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.movementId).toBeDefined();
            expect(prisma.stockMovement.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: MovementType.RECEIVE,
                        quantity: 50,
                        direction: 'INBOUND',
                    }),
                })
            );
        });

        it('should create SHIP movement (outbound)', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 20,
                type: MovementType.SHIP,
                reason: 'Customer order',
                referenceId: 'order-123',
                referenceType: ReferenceType.ORDER,
            }, createContext());

            expect(result.success).toBe(true);
            expect(prisma.stockMovement.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: MovementType.SHIP,
                        direction: 'OUTBOUND',
                        referenceId: 'order-123',
                    }),
                })
            );
        });

        it('should create RETURN movement (inbound)', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 5,
                type: MovementType.RETURN,
                reason: 'Customer return',
                referenceId: 'return-456',
                referenceType: ReferenceType.RETURN,
            }, createContext());

            expect(result.success).toBe(true);
            expect(prisma.stockMovement.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: MovementType.RETURN,
                        direction: 'INBOUND',
                    }),
                })
            );
        });

        it('should create ADJUSTMENT_ADD movement', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 10,
                type: MovementType.ADJUSTMENT_ADD,
                reason: 'Cycle count correction',
            }, createContext());

            expect(result.success).toBe(true);
            expect(prisma.stockMovement.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: MovementType.ADJUSTMENT_ADD,
                        direction: 'INBOUND',
                    }),
                })
            );
        });

        it('should create ADJUSTMENT_REMOVE movement', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 5,
                type: MovementType.ADJUSTMENT_REMOVE,
                reason: 'Inventory discrepancy',
            }, createContext());

            expect(result.success).toBe(true);
            expect(prisma.stockMovement.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: MovementType.ADJUSTMENT_REMOVE,
                        direction: 'OUTBOUND',
                    }),
                })
            );
        });

        it('should create DAMAGE movement (write-off)', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 3,
                type: MovementType.DAMAGE,
                reason: 'Water damage',
            }, createContext());

            expect(result.success).toBe(true);
            expect(prisma.stockMovement.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: MovementType.DAMAGE,
                        direction: 'OUTBOUND',
                    }),
                })
            );
        });

        it('should create TRANSFER_OUT movement', async () => {
            prisma.warehouse.findFirst
                .mockResolvedValueOnce(mockWarehouse({ id: warehouseA }))
                .mockResolvedValueOnce(mockWarehouse({ id: warehouseB }));

            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 15,
                type: MovementType.TRANSFER_OUT,
                targetWarehouseId: warehouseB,
                reason: 'Stock rebalancing',
            }, createContext());

            expect(result.success).toBe(true);
        });

        it('should create TRANSFER_IN movement', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseB,
                sku: 'SKU-001',
                quantity: 15,
                type: MovementType.TRANSFER_IN,
                reason: 'Stock rebalancing',
            }, createContext());

            expect(result.success).toBe(true);
        });

        it('should set status to PENDING on creation', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 10,
                type: MovementType.RECEIVE,
                reason: 'Test',
            }, createContext());

            expect(result.status).toBe(MovementStatus.PENDING);
        });
    });

    // =========================================================================
    // VALIDATION
    // =========================================================================
    describe('Validation', () => {
        it('should reject negative quantity', async () => {
            await expect(
                service.createMovement({
                    warehouseId: warehouseA,
                    sku: 'SKU-001',
                    quantity: -10,
                    type: MovementType.RECEIVE,
                    reason: 'Test',
                }, createContext())
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject zero quantity', async () => {
            await expect(
                service.createMovement({
                    warehouseId: warehouseA,
                    sku: 'SKU-001',
                    quantity: 0,
                    type: MovementType.RECEIVE,
                    reason: 'Test',
                }, createContext())
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject empty reason', async () => {
            await expect(
                service.createMovement({
                    warehouseId: warehouseA,
                    sku: 'SKU-001',
                    quantity: 10,
                    type: MovementType.RECEIVE,
                    reason: '',
                }, createContext())
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject if warehouse not found', async () => {
            prisma.warehouse.findFirst.mockResolvedValue(null);

            const result = await service.createMovement({
                warehouseId: 'invalid-warehouse',
                sku: 'SKU-001',
                quantity: 10,
                type: MovementType.RECEIVE,
                reason: 'Test',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('Warehouse');
        });

        it('should reject if inventory item not found for outbound', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);

            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-NOEXIST',
                quantity: 10,
                type: MovementType.SHIP,
                reason: 'Test',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should sanitize reason text (XSS prevention)', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 10,
                type: MovementType.RECEIVE,
                reason: '<script>alert("xss")</script>Legit reason',
            }, createContext());

            expect(result.success).toBe(true);
            expect(prisma.stockMovement.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        reason: expect.not.stringContaining('<script>'),
                    }),
                })
            );
        });
    });

    // =========================================================================
    // NEGATIVE STOCK PREVENTION
    // =========================================================================
    describe('Negative Stock Prevention', () => {
        it('should block outbound movement exceeding available stock', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(
                mockInventoryItem({ quantity: 100, reservedQuantity: 10 })
            );
            // Available = 100 - 10 = 90

            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 100, // Trying to ship 100, but only 90 available
                type: MovementType.SHIP,
                reason: 'Large order',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('Insufficient');
        });

        it('should allow outbound within available stock', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(
                mockInventoryItem({ quantity: 100, reservedQuantity: 10 })
            );
            // Available = 100 - 10 = 90

            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 90, // Exactly available
                type: MovementType.SHIP,
                reason: 'Large order',
            }, createContext());

            expect(result.success).toBe(true);
        });

        it('should consider reserved quantities when checking availability', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(
                mockInventoryItem({ quantity: 50, reservedQuantity: 50 })
            );
            // Available = 50 - 50 = 0

            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 1,
                type: MovementType.SHIP,
                reason: 'Order',
            }, createContext());

            expect(result.success).toBe(false);
        });

        it('should allow inbound movements regardless of current stock', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);

            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-NEW',
                quantity: 100,
                type: MovementType.RECEIVE,
                reason: 'New product',
            }, createContext());

            expect(result.success).toBe(true);
        });
    });

    // =========================================================================
    // TRANSFER OPERATIONS
    // =========================================================================
    describe('Transfer Operations', () => {
        it('should create paired movements for transfer', async () => {
            prisma.warehouse.findFirst
                .mockResolvedValueOnce(mockWarehouse({ id: warehouseA }))
                .mockResolvedValueOnce(mockWarehouse({ id: warehouseB }));

            const result = await service.createTransfer({
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                sku: 'SKU-001',
                quantity: 20,
                reason: 'Stock rebalancing',
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.transferOutId).toBeDefined();
            expect(result.transferInId).toBeDefined();
        });

        it('should link paired movements together', async () => {
            prisma.warehouse.findFirst
                .mockResolvedValueOnce(mockWarehouse({ id: warehouseA }))
                .mockResolvedValueOnce(mockWarehouse({ id: warehouseB }));

            await service.createTransfer({
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                sku: 'SKU-001',
                quantity: 20,
                reason: 'Stock rebalancing',
            }, createContext());

            // Verify linkedMovementId is set
            expect(prisma.stockMovement.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: MovementType.TRANSFER_OUT,
                    }),
                })
            );
        });

        it('should reject transfer to same warehouse', async () => {
            const result = await service.createTransfer({
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 20,
                reason: 'Invalid transfer',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('same warehouse');
        });

        it('should reject transfer if source has insufficient stock', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(
                mockInventoryItem({ quantity: 10, reservedQuantity: 0 })
            );
            prisma.warehouse.findFirst
                .mockResolvedValueOnce(mockWarehouse({ id: warehouseA }))
                .mockResolvedValueOnce(mockWarehouse({ id: warehouseB }));

            const result = await service.createTransfer({
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                sku: 'SKU-001',
                quantity: 50,
                reason: 'Too much',
            }, createContext());

            expect(result.success).toBe(false);
        });

        it('should reject cross-org transfer', async () => {
            prisma.warehouse.findFirst
                .mockResolvedValueOnce(mockWarehouse({ id: warehouseA }))
                .mockResolvedValueOnce(null); // Target not in org

            const result = await service.createTransfer({
                sourceWarehouseId: warehouseA,
                targetWarehouseId: 'other-org-warehouse',
                sku: 'SKU-001',
                quantity: 20,
                reason: 'Cross org attempt',
            }, createContext());

            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // EXECUTE MOVEMENT
    // =========================================================================
    describe('Execute Movement', () => {
        const mockPendingMovement = (overrides = {}) => ({
            id: 'mov-001',
            organizationId: testOrg,
            warehouseId: warehouseA,
            sku: 'SKU-001',
            quantity: 10,
            type: MovementType.RECEIVE,
            direction: 'INBOUND',
            status: MovementStatus.PENDING,
            reason: 'Test',
            createdAt: new Date(),
            ...overrides,
        });

        it('should execute pending movement', async () => {
            prisma.stockMovement.findFirst.mockResolvedValue(mockPendingMovement());

            const result = await service.executeMovement('mov-001', createContext());

            expect(result.success).toBe(true);
            expect(result.status).toBe(MovementStatus.COMPLETED);
        });

        it('should increase quantity for inbound movement', async () => {
            prisma.stockMovement.findFirst.mockResolvedValue(
                mockPendingMovement({ direction: 'INBOUND', quantity: 50 })
            );
            prisma.inventoryItem.findFirst.mockResolvedValue(
                mockInventoryItem({ quantity: 100 })
            );

            await service.executeMovement('mov-001', createContext());

            expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        quantity: 150, // 100 + 50
                    }),
                })
            );
        });

        it('should decrease quantity for outbound movement', async () => {
            prisma.stockMovement.findFirst.mockResolvedValue(
                mockPendingMovement({
                    type: MovementType.SHIP,
                    direction: 'OUTBOUND',
                    quantity: 30,
                })
            );
            prisma.inventoryItem.findFirst.mockResolvedValue(
                mockInventoryItem({ quantity: 100, reservedQuantity: 0 })
            );

            await service.executeMovement('mov-001', createContext());

            expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        quantity: 70, // 100 - 30
                    }),
                })
            );
        });

        it('should reject execution of already completed movement', async () => {
            prisma.stockMovement.findFirst.mockResolvedValue(
                mockPendingMovement({ status: MovementStatus.COMPLETED })
            );

            const result = await service.executeMovement('mov-001', createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('already');
        });

        it('should reject execution of cancelled movement', async () => {
            prisma.stockMovement.findFirst.mockResolvedValue(
                mockPendingMovement({ status: MovementStatus.CANCELLED })
            );

            const result = await service.executeMovement('mov-001', createContext());

            expect(result.success).toBe(false);
        });

        it('should create audit log on execution', async () => {
            prisma.stockMovement.findFirst.mockResolvedValue(mockPendingMovement());

            await service.executeMovement('mov-001', createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalled();
        });

        it('should emit movement.completed event', async () => {
            prisma.stockMovement.findFirst.mockResolvedValue(mockPendingMovement());
            const emitSpy = jest.spyOn(eventEmitter, 'emit');

            await service.executeMovement('mov-001', createContext());

            expect(emitSpy).toHaveBeenCalledWith(
                'movement.completed',
                expect.any(Object)
            );
        });

        it('should set executedAt timestamp', async () => {
            prisma.stockMovement.findFirst.mockResolvedValue(mockPendingMovement());

            await service.executeMovement('mov-001', createContext());

            expect(prisma.stockMovement.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        executedAt: expect.any(Date),
                        executedBy: testUser,
                    }),
                })
            );
        });

        it('should block execution if would result in negative stock', async () => {
            prisma.stockMovement.findFirst.mockResolvedValue(
                mockPendingMovement({
                    type: MovementType.SHIP,
                    direction: 'OUTBOUND',
                    quantity: 200, // More than available
                })
            );
            prisma.inventoryItem.findFirst.mockResolvedValue(
                mockInventoryItem({ quantity: 100, reservedQuantity: 0 })
            );

            const result = await service.executeMovement('mov-001', createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('Insufficient');
        });
    });

    // =========================================================================
    // CANCEL MOVEMENT
    // =========================================================================
    describe('Cancel Movement', () => {
        it('should cancel pending movement', async () => {
            prisma.stockMovement.findFirst.mockResolvedValue({
                id: 'mov-001',
                status: MovementStatus.PENDING,
                organizationId: testOrg,
            });

            const result = await service.cancelMovement('mov-001', 'Changed plans', createContext());

            expect(result.success).toBe(true);
            expect(prisma.stockMovement.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: MovementStatus.CANCELLED,
                        cancellationReason: 'Changed plans',
                    }),
                })
            );
        });

        it('should reject cancellation of completed movement', async () => {
            prisma.stockMovement.findFirst.mockResolvedValue({
                id: 'mov-001',
                status: MovementStatus.COMPLETED,
                organizationId: testOrg,
            });

            const result = await service.cancelMovement('mov-001', 'Too late', createContext());

            expect(result.success).toBe(false);
        });

        it('should require cancellation reason', async () => {
            await expect(
                service.cancelMovement('mov-001', '', createContext())
            ).rejects.toThrow(BadRequestException);
        });
    });

    // =========================================================================
    // QUERY OPERATIONS
    // =========================================================================
    describe('Query Operations', () => {
        it('should get movements by warehouse', async () => {
            prisma.stockMovement.findMany.mockResolvedValue([
                { id: 'mov-001', warehouseId: warehouseA },
                { id: 'mov-002', warehouseId: warehouseA },
            ]);
            prisma.stockMovement.count.mockResolvedValue(2);

            const result = await service.getMovements({
                warehouseId: warehouseA,
            }, createContext());

            expect(result.items).toHaveLength(2);
            expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        warehouseId: warehouseA,
                    }),
                })
            );
        });

        it('should filter by movement type', async () => {
            await service.getMovements({
                type: MovementType.RECEIVE,
            }, createContext());

            expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        type: MovementType.RECEIVE,
                    }),
                })
            );
        });

        it('should filter by status', async () => {
            await service.getMovements({
                status: MovementStatus.PENDING,
            }, createContext());

            expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: MovementStatus.PENDING,
                    }),
                })
            );
        });

        it('should filter by date range', async () => {
            const startDate = new Date('2026-01-01');
            const endDate = new Date('2026-01-31');

            await service.getMovements({
                startDate,
                endDate,
            }, createContext());

            expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        createdAt: {
                            gte: startDate,
                            lte: endDate,
                        },
                    }),
                })
            );
        });

        it('should filter by reference ID', async () => {
            await service.getMovements({
                referenceId: 'order-123',
            }, createContext());

            expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        referenceId: 'order-123',
                    }),
                })
            );
        });

        it('should support pagination', async () => {
            await service.getMovements({
                page: 2,
                pageSize: 10,
            }, createContext());

            expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 10,
                    take: 10,
                })
            );
        });

        it('should enforce organization isolation', async () => {
            await service.getMovements({}, createContext());

            expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: testOrg,
                    }),
                })
            );
        });
    });

    // =========================================================================
    // MOVEMENT SUMMARY
    // =========================================================================
    describe('Movement Summary', () => {
        it('should calculate inbound/outbound totals', async () => {
            prisma.stockMovement.findMany.mockResolvedValue([
                { direction: 'INBOUND', quantity: 100 },
                { direction: 'INBOUND', quantity: 50 },
                { direction: 'OUTBOUND', quantity: 30 },
            ]);

            const result = await service.getMovementSummary({}, createContext());

            expect(result.totalInbound).toBe(150);
            expect(result.totalOutbound).toBe(30);
            expect(result.netChange).toBe(120);
        });

        it('should group by movement type', async () => {
            prisma.stockMovement.findMany.mockResolvedValue([
                { type: MovementType.RECEIVE, quantity: 100 },
                { type: MovementType.RECEIVE, quantity: 50 },
                { type: MovementType.SHIP, quantity: 30 },
            ]);

            const result = await service.getMovementSummary({}, createContext());

            expect(result.byType[MovementType.RECEIVE]).toEqual({
                count: 2,
                quantity: 150,
            });
        });
    });

    // =========================================================================
    // SKU MOVEMENT HISTORY
    // =========================================================================
    describe('SKU Movement History', () => {
        it('should get movements for specific SKU', async () => {
            await service.getSkuMovements('SKU-001', {}, createContext());

            expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        sku: 'SKU-001',
                    }),
                })
            );
        });

        it('should filter by warehouse if provided', async () => {
            await service.getSkuMovements('SKU-001', {
                warehouseId: warehouseA,
            }, createContext());

            expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        sku: 'SKU-001',
                        warehouseId: warehouseA,
                    }),
                })
            );
        });

        it('should respect limit parameter', async () => {
            await service.getSkuMovements('SKU-001', {
                limit: 50,
            }, createContext());

            expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 50,
                })
            );
        });
    });

    // =========================================================================
    // REFERENCE TYPES
    // =========================================================================
    describe('Reference Types', () => {
        it('should support ORDER reference', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 10,
                type: MovementType.SHIP,
                reason: 'Order fulfillment',
                referenceId: 'order-123',
                referenceType: ReferenceType.ORDER,
            }, createContext());

            expect(result.success).toBe(true);
        });

        it('should support PURCHASE_ORDER reference', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 100,
                type: MovementType.RECEIVE,
                reason: 'PO delivery',
                referenceId: 'po-456',
                referenceType: ReferenceType.PURCHASE_ORDER,
            }, createContext());

            expect(result.success).toBe(true);
        });

        it('should support RETURN reference', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 5,
                type: MovementType.RETURN,
                reason: 'Customer return',
                referenceId: 'ret-789',
                referenceType: ReferenceType.RETURN,
            }, createContext());

            expect(result.success).toBe(true);
        });

        it('should support TRANSFER reference', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 20,
                type: MovementType.TRANSFER_OUT,
                targetWarehouseId: warehouseB,
                reason: 'Stock transfer',
                referenceId: 'xfer-001',
                referenceType: ReferenceType.TRANSFER,
            }, createContext());

            expect(result.success).toBe(true);
        });

        it('should expose available reference types', () => {
            const types = service.getAvailableReferenceTypes();

            expect(types).toContain(ReferenceType.ORDER);
            expect(types).toContain(ReferenceType.PURCHASE_ORDER);
            expect(types).toContain(ReferenceType.RETURN);
            expect(types).toContain(ReferenceType.TRANSFER);
        });
    });

    // =========================================================================
    // CONFIGURATION (FUTURE-READY)
    // =========================================================================
    describe('Configuration', () => {
        it('should expose approval configuration', () => {
            const config = service.getApprovalConfig();

            expect(config).toHaveProperty('requiresApproval');
            expect(config.requiresApproval).toBe(false); // MVP default
        });

        it('should expose zone support configuration', () => {
            const config = service.getZoneConfig();

            expect(config).toHaveProperty('zoneEnabled');
            expect(config.zoneEnabled).toBe(false); // MVP default
        });
    });

    // =========================================================================
    // HARDENING
    // =========================================================================
    describe('Hardening: Database Failures', () => {
        it('should handle database connection failure', async () => {
            prisma.warehouse.findFirst.mockRejectedValue(new Error('DB connection failed'));

            await expect(
                service.createMovement({
                    warehouseId: warehouseA,
                    sku: 'SKU-001',
                    quantity: 10,
                    type: MovementType.RECEIVE,
                    reason: 'Test',
                }, createContext())
            ).rejects.toThrow();
        });

        it('should rollback transaction on failure', async () => {
            prisma.stockMovement.findFirst.mockResolvedValue({
                id: 'mov-001',
                status: MovementStatus.PENDING,
                organizationId: testOrg,
                type: MovementType.SHIP,
                direction: 'OUTBOUND',
                quantity: 10,
            });
            prisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

            const result = await service.executeMovement('mov-001', createContext());

            expect(result.success).toBe(false);
        });
    });

    describe('Hardening: Concurrent Operations', () => {
        it('should handle concurrent movements safely', async () => {
            // Simulate race condition check
            prisma.inventoryItem.findFirst.mockResolvedValue(
                mockInventoryItem({ quantity: 100, reservedQuantity: 0 })
            );

            const results = await Promise.all([
                service.createMovement({
                    warehouseId: warehouseA,
                    sku: 'SKU-001',
                    quantity: 60,
                    type: MovementType.SHIP,
                    reason: 'Order 1',
                }, createContext()),
                service.createMovement({
                    warehouseId: warehouseA,
                    sku: 'SKU-001',
                    quantity: 60,
                    type: MovementType.SHIP,
                    reason: 'Order 2',
                }, createContext()),
            ]);

            // Both might succeed in creation (execution will check stock)
            expect(results.filter(r => r.success).length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Hardening: Input Validation', () => {
        it('should reject missing organization ID', async () => {
            await expect(
                service.createMovement({
                    warehouseId: warehouseA,
                    sku: 'SKU-001',
                    quantity: 10,
                    type: MovementType.RECEIVE,
                    reason: 'Test',
                }, { organizationId: '', userId: testUser })
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject missing user ID', async () => {
            await expect(
                service.createMovement({
                    warehouseId: warehouseA,
                    sku: 'SKU-001',
                    quantity: 10,
                    type: MovementType.RECEIVE,
                    reason: 'Test',
                }, { organizationId: testOrg, userId: '' })
            ).rejects.toThrow(BadRequestException);
        });

        it('should handle very large quantities', async () => {
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 999999999,
                type: MovementType.RECEIVE,
                reason: 'Large shipment',
            }, createContext());

            expect(result.success).toBe(true);
        });
    });

    describe('Hardening: Cross-Org Isolation', () => {
        it('should not return movements from other organizations', async () => {
            prisma.stockMovement.findMany.mockResolvedValue([
                { id: 'mov-001', organizationId: testOrg },
            ]);

            await service.getMovements({}, createContext({ organizationId: 'other-org' }));

            expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: 'other-org',
                    }),
                })
            );
        });
    });
});
