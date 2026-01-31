/**
 * Bulk Inventory Update (Cycle Count) Unit Tests (INV-03)
 * 
 * NEW WORKFLOW: Step A+D Combined
 * All tests (basic + hardening) written BEFORE implementation
 * 
 * BUSINESS LOGIC COVERAGE:
 * 
 * Update Types:
 * - ABSOLUTE: Set quantity to exact value (cycle count)
 * - ADJUSTMENT: Add or subtract from current quantity
 * - TRANSFER: Move inventory between warehouses
 * 
 * Cycle Count Types:
 * - FULL: Complete warehouse recount
 * - PARTIAL: Specific SKUs only
 * - BLIND: Counter doesn't see expected values
 * - GUIDED: Counter sees expected values
 * 
 * Variance Handling:
 * - Calculate variance (expected vs actual)
 * - Variance thresholds (warning/error)
 * - Auto-approve small variances
 * - Require approval for large variances
 * 
 * Audit Trail:
 * - Record all changes with reason codes
 * - Track who, when, what, why
 * - Before/after snapshots
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
    InventoryUpdateService,
    UpdateType,
    CycleCountType,
    UpdateResult,
    UpdateItem,
    CycleCountSession,
    VarianceReport,
} from '../../src/modules/inventory/inventory-update.service';
import { InventoryValidationService } from '../../src/modules/inventory/inventory-validation.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('InventoryUpdateService', () => {
    let service: InventoryUpdateService;
    let prisma: jest.Mocked<PrismaService>;
    let validationService: jest.Mocked<InventoryValidationService>;
    let eventEmitter: jest.Mocked<EventEmitter2>;

    // Test data
    const testOrgId = 'org-123';
    const testWarehouseId = 'warehouse-456';
    const testUserId = 'user-789';

    const mockInventoryItem = {
        id: 'inv-001',
        organizationId: testOrgId,
        warehouseId: testWarehouseId,
        sku: 'SKU-001',
        quantity: 100,
        reservedQuantity: 10,
        availableQuantity: 90,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const createUpdateItem = (overrides = {}): UpdateItem => ({
        sku: 'SKU-001',
        quantity: 50,
        updateType: UpdateType.ABSOLUTE,
        reasonCode: 'CYCLE_COUNT',
        notes: 'Quarterly inventory count',
        ...overrides,
    });

    const createContext = (overrides = {}) => ({
        organizationId: testOrgId,
        warehouseId: testWarehouseId,
        userId: testUserId,
        ...overrides,
    });

    beforeEach(async () => {
        jest.clearAllMocks();

        prisma = {
            inventoryItem: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn(),
            },
            inventoryAuditLog: {
                create: jest.fn(),
                createMany: jest.fn(),
            },
            cycleCountSession: {
                create: jest.fn(),
                update: jest.fn(),
                findFirst: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
        } as any;

        validationService = {
            validate: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
        } as any;

        eventEmitter = {
            emit: jest.fn(),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InventoryUpdateService,
                { provide: PrismaService, useValue: prisma },
                { provide: InventoryValidationService, useValue: validationService },
                { provide: EventEmitter2, useValue: eventEmitter },
            ],
        }).compile();

        service = module.get<InventoryUpdateService>(InventoryUpdateService);
    });

    // =========================================================================
    // UPDATE TYPE: ABSOLUTE (Set exact quantity)
    // =========================================================================
    describe('UpdateType.ABSOLUTE', () => {
        it('should set quantity to exact value', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 50,
            } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 50, updateType: UpdateType.ABSOLUTE }),
                createContext()
            );

            expect(result.success).toBe(true);
            expect(result.newQuantity).toBe(50);
            expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ quantity: 50 }),
                })
            );
        });

        it('should calculate variance for absolute updates', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 80,
            } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 80, updateType: UpdateType.ABSOLUTE }),
                createContext()
            );

            expect(result.variance).toBe(-20); // Expected 100, actual 80
            expect(result.variancePercent).toBeCloseTo(-20);
        });

        it('should handle setting quantity to zero', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 0,
            } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 0, updateType: UpdateType.ABSOLUTE }),
                createContext()
            );

            expect(result.success).toBe(true);
            expect(result.newQuantity).toBe(0);
        });

        it('should reject negative quantity for absolute', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: -10, updateType: UpdateType.ABSOLUTE }),
                createContext()
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('negative');
        });
    });

    // =========================================================================
    // UPDATE TYPE: ADJUSTMENT (Add/subtract from current)
    // =========================================================================
    describe('UpdateType.ADJUSTMENT', () => {
        it('should add to current quantity (positive adjustment)', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 150, // 100 + 50
            } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 50, updateType: UpdateType.ADJUSTMENT }),
                createContext()
            );

            expect(result.success).toBe(true);
            expect(result.newQuantity).toBe(150);
            expect(result.previousQuantity).toBe(100);
            expect(result.adjustmentAmount).toBe(50);
        });

        it('should subtract from current quantity (negative adjustment)', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 80, // 100 - 20
            } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: -20, updateType: UpdateType.ADJUSTMENT }),
                createContext()
            );

            expect(result.success).toBe(true);
            expect(result.newQuantity).toBe(80);
            expect(result.adjustmentAmount).toBe(-20);
        });

        it('should prevent adjustment below zero', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: -150, updateType: UpdateType.ADJUSTMENT }),
                createContext()
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('below zero');
        });

        it('should handle zero adjustment gracefully', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 0, updateType: UpdateType.ADJUSTMENT }),
                createContext()
            );

            expect(result.success).toBe(true);
            expect(result.newQuantity).toBe(100); // No change
        });

        it('should respect reserved quantity constraints', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 100,
                reservedQuantity: 90,
            } as any);

            // Trying to reduce by 50 when only 10 are available (100-90)
            const result = await service.updateSingle(
                createUpdateItem({ quantity: -50, updateType: UpdateType.ADJUSTMENT }),
                createContext()
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('reserved');
        });
    });

    // =========================================================================
    // UPDATE TYPE: TRANSFER (Between warehouses)
    // =========================================================================
    describe('UpdateType.TRANSFER', () => {
        const targetWarehouseId = 'warehouse-789';

        it('should transfer inventory between warehouses', async () => {
            prisma.inventoryItem.findFirst
                .mockResolvedValueOnce(mockInventoryItem as any) // Source
                .mockResolvedValueOnce({
                    ...mockInventoryItem,
                    id: 'inv-002',
                    warehouseId: targetWarehouseId,
                    quantity: 50,
                } as any); // Target

            prisma.inventoryItem.update.mockResolvedValue({} as any);

            const result = await service.transfer({
                sku: 'SKU-001',
                quantity: 30,
                sourceWarehouseId: testWarehouseId,
                targetWarehouseId,
                reasonCode: 'REBALANCE',
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.sourceNewQuantity).toBe(70); // 100 - 30
            expect(result.targetNewQuantity).toBe(80); // 50 + 30
        });

        it('should create target inventory item if not exists', async () => {
            prisma.inventoryItem.findFirst
                .mockResolvedValueOnce(mockInventoryItem as any) // Source
                .mockResolvedValueOnce(null); // Target doesn't exist

            prisma.inventoryItem.create = jest.fn().mockResolvedValue({
                id: 'inv-new',
                quantity: 30,
            } as any);
            prisma.inventoryItem.update.mockResolvedValue({} as any);

            const result = await service.transfer({
                sku: 'SKU-001',
                quantity: 30,
                sourceWarehouseId: testWarehouseId,
                targetWarehouseId,
                reasonCode: 'REBALANCE',
            }, createContext());

            expect(result.success).toBe(true);
            expect(prisma.inventoryItem.create).toHaveBeenCalled();
        });

        it('should reject transfer to same warehouse', async () => {
            const result = await service.transfer({
                sku: 'SKU-001',
                quantity: 30,
                sourceWarehouseId: testWarehouseId,
                targetWarehouseId: testWarehouseId, // Same!
                reasonCode: 'REBALANCE',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('same warehouse');
        });

        it('should reject transfer exceeding available quantity', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 100,
                reservedQuantity: 90,
            } as any);

            const result = await service.transfer({
                sku: 'SKU-001',
                quantity: 50, // Only 10 available
                sourceWarehouseId: testWarehouseId,
                targetWarehouseId,
                reasonCode: 'REBALANCE',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error?.toLowerCase()).toContain('insufficient');
        });

        it('should validate target warehouse belongs to organization', async () => {
            validationService.validate.mockResolvedValue({
                valid: false,
                errors: ['Warehouse not found in organization'],
            });

            const result = await service.transfer({
                sku: 'SKU-001',
                quantity: 30,
                sourceWarehouseId: testWarehouseId,
                targetWarehouseId: 'other-org-warehouse',
                reasonCode: 'REBALANCE',
            }, createContext());

            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // CYCLE COUNT TYPES
    // =========================================================================
    describe('Cycle Count Types', () => {
        describe('FULL cycle count', () => {
            it('should create full cycle count session', async () => {
                prisma.inventoryItem.findMany.mockResolvedValue([
                    mockInventoryItem,
                    { ...mockInventoryItem, id: 'inv-002', sku: 'SKU-002' },
                ] as any);
                prisma.cycleCountSession.create.mockResolvedValue({
                    id: 'session-001',
                    type: CycleCountType.FULL,
                } as any);

                const session = await service.createCycleCountSession({
                    type: CycleCountType.FULL,
                    warehouseId: testWarehouseId,
                }, createContext());

                expect(session.id).toBeDefined();
                expect(session.itemCount).toBe(2);
            });

            it('should lock items during full count', async () => {
                prisma.inventoryItem.findMany.mockResolvedValue([mockInventoryItem] as any);
                prisma.cycleCountSession.create.mockResolvedValue({ id: 'session-001' } as any);
                prisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });

                await service.createCycleCountSession({
                    type: CycleCountType.FULL,
                    warehouseId: testWarehouseId,
                    lockItems: true,
                }, createContext());

                expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith(
                    expect.objectContaining({
                        data: expect.objectContaining({ isLocked: true }),
                    })
                );
            });
        });

        describe('PARTIAL cycle count', () => {
            it('should create partial count for specific SKUs', async () => {
                const skus = ['SKU-001', 'SKU-002'];
                prisma.inventoryItem.findMany.mockResolvedValue([
                    mockInventoryItem,
                    { ...mockInventoryItem, id: 'inv-002', sku: 'SKU-002' },
                ] as any);
                prisma.cycleCountSession.create.mockResolvedValue({
                    id: 'session-001',
                    type: CycleCountType.PARTIAL,
                } as any);

                const session = await service.createCycleCountSession({
                    type: CycleCountType.PARTIAL,
                    warehouseId: testWarehouseId,
                    skus,
                }, createContext());

                expect(session.itemCount).toBe(2);
            });

            it('should reject partial count without SKU list', async () => {
                await expect(
                    service.createCycleCountSession({
                        type: CycleCountType.PARTIAL,
                        warehouseId: testWarehouseId,
                        // skus missing!
                    }, createContext())
                ).rejects.toThrow('SKUs required');
            });
        });

        describe('BLIND vs GUIDED count', () => {
            it('should hide expected quantities in BLIND mode', async () => {
                prisma.inventoryItem.findMany.mockResolvedValue([mockInventoryItem] as any);
                prisma.cycleCountSession.create.mockResolvedValue({ id: 'session-001' } as any);

                const session = await service.createCycleCountSession({
                    type: CycleCountType.FULL,
                    warehouseId: testWarehouseId,
                    isBlind: true,
                }, createContext());

                const items = await service.getSessionItems(session.id, createContext());

                // In blind mode, expected quantity should be hidden
                expect(items[0].expectedQuantity).toBeUndefined();
            });

            it('should show expected quantities in GUIDED mode', async () => {
                prisma.inventoryItem.findMany.mockResolvedValue([mockInventoryItem] as any);
                prisma.cycleCountSession.create.mockResolvedValue({ id: 'session-001' } as any);

                const session = await service.createCycleCountSession({
                    type: CycleCountType.FULL,
                    warehouseId: testWarehouseId,
                    isBlind: false,
                }, createContext());

                const items = await service.getSessionItems(session.id, createContext());

                expect(items[0].expectedQuantity).toBe(100);
            });
        });
    });

    // =========================================================================
    // VARIANCE HANDLING
    // =========================================================================
    describe('Variance Handling', () => {
        it('should calculate variance correctly', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 85,
            } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 85, updateType: UpdateType.ABSOLUTE }),
                createContext()
            );

            expect(result.variance).toBe(-15);
            expect(result.variancePercent).toBeCloseTo(-15);
        });

        it('should flag variance above warning threshold', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 90,
            } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 90, updateType: UpdateType.ABSOLUTE }),
                { ...createContext(), varianceWarningThreshold: 5 }
            );

            expect(result.varianceLevel).toBe('WARNING');
        });

        it('should flag variance above error threshold', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 50,
            } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 50, updateType: UpdateType.ABSOLUTE }),
                { ...createContext(), varianceErrorThreshold: 20 }
            );

            expect(result.varianceLevel).toBe('ERROR');
        });

        it('should auto-approve small variances', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 98,
            } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 98, updateType: UpdateType.ABSOLUTE }),
                { ...createContext(), autoApproveThreshold: 5 }
            );

            expect(result.requiresApproval).toBe(false);
            // Auto-approved is true when variance is within warning/error thresholds but outside auto-approve
            // With 2% variance and 5% auto-approve threshold, it's auto-approved
            expect(result.success).toBe(true);
        });

        it('should require approval for large variances', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 50, updateType: UpdateType.ABSOLUTE }),
                { ...createContext(), autoApproveThreshold: 5 }
            );

            expect(result.requiresApproval).toBe(true);
            expect(result.status).toBe('PENDING_APPROVAL');
        });

        it('should generate variance report for cycle count', async () => {
            prisma.inventoryItem.findMany.mockResolvedValue([
                { ...mockInventoryItem, sku: 'SKU-001', quantity: 100 },
                { ...mockInventoryItem, id: 'inv-002', sku: 'SKU-002', quantity: 50 },
            ] as any);
            prisma.cycleCountSession.create.mockResolvedValue({
                id: 'session-test',
                type: CycleCountType.FULL,
            } as any);

            // Create session and submit counts
            const session = await service.createCycleCountSession({
                type: CycleCountType.FULL,
                warehouseId: testWarehouseId,
            }, createContext());

            await service.submitCycleCount(session.id, [
                { sku: 'SKU-001', countedQuantity: 95 },
                { sku: 'SKU-002', countedQuantity: 55 },
            ], createContext());

            const report = await service.generateVarianceReport(session.id, createContext());

            expect(report.totalItems).toBe(2);
            expect(report.itemsWithVariance).toBe(2);
            expect(report.totalVariance).toBe(0); // -5 + 5 = 0
            expect(report.absoluteVariance).toBe(10); // |5| + |5| = 10
        });
    });

    // =========================================================================
    // BULK UPDATES
    // =========================================================================
    describe('Bulk Updates', () => {
        it('should process multiple updates in batch', async () => {
            prisma.inventoryItem.findFirst
                .mockResolvedValueOnce(mockInventoryItem as any)
                .mockResolvedValueOnce({ ...mockInventoryItem, id: 'inv-002', sku: 'SKU-002' } as any);
            prisma.inventoryItem.update.mockResolvedValue({} as any);

            const items = [
                createUpdateItem({ sku: 'SKU-001', quantity: 50 }),
                createUpdateItem({ sku: 'SKU-002', quantity: 75 }),
            ];

            const result = await service.updateBulk(items, createContext());

            expect(result.successCount).toBe(2);
            expect(result.errorCount).toBe(0);
        });

        it('should continue processing after individual item error', async () => {
            prisma.inventoryItem.findFirst
                .mockResolvedValueOnce(mockInventoryItem as any)
                .mockResolvedValueOnce(null) // Not found
                .mockResolvedValueOnce({ ...mockInventoryItem, id: 'inv-003', sku: 'SKU-003' } as any);
            prisma.inventoryItem.update.mockResolvedValue({} as any);

            const items = [
                createUpdateItem({ sku: 'SKU-001', quantity: 50 }),
                createUpdateItem({ sku: 'SKU-002', quantity: 75 }), // Will fail
                createUpdateItem({ sku: 'SKU-003', quantity: 25 }),
            ];

            const result = await service.updateBulk(items, createContext());

            expect(result.successCount).toBe(2);
            expect(result.errorCount).toBe(1);
            expect(result.errors[0].sku).toBe('SKU-002');
        });

        it('should rollback all on atomic=true with error', async () => {
            prisma.inventoryItem.findFirst
                .mockResolvedValueOnce(mockInventoryItem as any)
                .mockRejectedValueOnce(new Error('DB error'));

            const items = [
                createUpdateItem({ sku: 'SKU-001', quantity: 50 }),
                createUpdateItem({ sku: 'SKU-002', quantity: 75 }),
            ];

            const result = await service.updateBulk(items, { ...createContext(), atomic: true });

            expect(result.success).toBe(false);
            expect(result.successCount).toBe(0);
        });
    });

    // =========================================================================
    // REASON CODES
    // =========================================================================
    describe('Reason Codes', () => {
        const validReasonCodes = [
            'CYCLE_COUNT',
            'DAMAGE',
            'THEFT',
            'EXPIRED',
            'FOUND',
            'ADJUSTMENT',
            'RECEIVING',
            'RECOUNT',
            'TRANSFER',
            'RETURN',
            'WRITE_OFF',
            'OTHER',
        ];

        it.each(validReasonCodes)('should accept valid reason code: %s', async (reasonCode) => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({ ...mockInventoryItem, quantity: 50 } as any);

            const result = await service.updateSingle(
                createUpdateItem({ reasonCode }),
                createContext()
            );

            expect(result.success).toBe(true);
        });

        it('should reject invalid reason code', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);

            const result = await service.updateSingle(
                createUpdateItem({ reasonCode: 'INVALID_CODE' }),
                createContext()
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('reason code');
        });

        it('should require reason code for adjustments', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);

            const result = await service.updateSingle(
                { ...createUpdateItem(), reasonCode: undefined },
                createContext()
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('reason');
        });
    });

    // =========================================================================
    // AUDIT TRAIL
    // =========================================================================
    describe('Audit Trail', () => {
        it('should create audit log entry for updates', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({ ...mockInventoryItem, quantity: 50 } as any);
            prisma.inventoryAuditLog.create.mockResolvedValue({ id: 'audit-001' } as any);

            await service.updateSingle(createUpdateItem(), createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        organizationId: testOrgId,
                        warehouseId: testWarehouseId,
                        userId: testUserId,
                        action: 'UPDATE',
                        sku: 'SKU-001',
                        previousQuantity: 100,
                        newQuantity: 50,
                        reasonCode: 'CYCLE_COUNT',
                    }),
                })
            );
        });

        it('should include notes in audit log', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({ ...mockInventoryItem, quantity: 50 } as any);
            prisma.inventoryAuditLog.create.mockResolvedValue({ id: 'audit-001' } as any);

            await service.updateSingle(
                createUpdateItem({ notes: 'Found extra items in back room' }),
                createContext()
            );

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        notes: 'Found extra items in back room',
                    }),
                })
            );
        });

        it('should record variance in audit log', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({ ...mockInventoryItem, quantity: 85 } as any);
            prisma.inventoryAuditLog.create.mockResolvedValue({ id: 'audit-001' } as any);

            await service.updateSingle(createUpdateItem({ quantity: 85 }), createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        variance: -15,
                        variancePercent: -15,
                    }),
                })
            );
        });

        it('should emit audit event', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({ ...mockInventoryItem, quantity: 50 } as any);

            await service.updateSingle(createUpdateItem(), createContext());

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'inventory.updated',
                expect.objectContaining({
                    sku: 'SKU-001',
                    previousQuantity: 100,
                    newQuantity: 50,
                })
            );
        });
    });

    // =========================================================================
    // CROSS-ORG ISOLATION
    // =========================================================================
    describe('Cross-Org Isolation', () => {
        it('should scope all queries to organization', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({ ...mockInventoryItem, quantity: 50 } as any);

            await service.updateSingle(createUpdateItem(), createContext());

            expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: testOrgId,
                    }),
                })
            );
        });

        it('should reject update for item from different org', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);

            const result = await service.updateSingle(createUpdateItem(), createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should not leak data across organizations', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue({
                ...mockInventoryItem,
                organizationId: 'other-org',
            } as any);

            const result = await service.updateSingle(createUpdateItem(), createContext());

            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================
    describe('Edge Cases', () => {
        it('should handle item not found', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(null);

            const result = await service.updateSingle(createUpdateItem(), createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should handle missing organizationId', async () => {
            await expect(
                service.updateSingle(createUpdateItem(), { ...createContext(), organizationId: '' })
            ).rejects.toThrow(/organization|required|invalid/i);
        });

        it('should handle missing userId', async () => {
            await expect(
                service.updateSingle(createUpdateItem(), { ...createContext(), userId: '' })
            ).rejects.toThrow(/user|required|invalid/i);
        });

        it('should handle very large quantities', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 10_000_000,
            } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 10_000_000, updateType: UpdateType.ABSOLUTE }),
                createContext()
            );

            expect(result.success).toBe(true);
        });

        it('should handle decimal quantities', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 10.5, updateType: UpdateType.ABSOLUTE }),
                createContext()
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('integer');
        });

        it('should handle concurrent updates safely', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({ ...mockInventoryItem, quantity: 50 } as any);

            const promises = Array(5).fill(null).map(() =>
                service.updateSingle(createUpdateItem(), createContext())
            );

            const results = await Promise.all(promises);

            results.forEach(result => {
                expect(result).toBeDefined();
            });
        });
    });

    // =========================================================================
    // STEP D: HARDENING - DATABASE FAILURES
    // =========================================================================
    describe('Hardening: Database Failures', () => {
        it('should handle database connection failure', async () => {
            prisma.inventoryItem.findFirst.mockRejectedValue(
                new Error('Connection refused')
            );

            const result = await service.updateSingle(createUpdateItem(), createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('Connection');
        });

        it('should handle update failure after read success', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockRejectedValue(new Error('Update failed'));

            const result = await service.updateSingle(createUpdateItem(), createContext());

            expect(result.success).toBe(false);
        });

        it('should handle transaction deadlock', async () => {
            prisma.$transaction.mockRejectedValue(new Error('Deadlock detected'));

            const result = await service.updateBulk(
                [createUpdateItem()],
                { ...createContext(), atomic: true }
            );

            expect(result.success).toBe(false);
        });

        it('should handle audit log creation failure', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({ ...mockInventoryItem, quantity: 50 } as any);
            prisma.inventoryAuditLog.create.mockRejectedValue(new Error('Audit failed'));

            // Should still succeed but log error
            const result = await service.updateSingle(createUpdateItem(), createContext());

            // Update should succeed even if audit fails
            expect(result.success).toBe(true);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - CONCURRENT OPERATIONS
    // =========================================================================
    describe('Hardening: Concurrent Operations', () => {
        it('should handle optimistic locking conflicts', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue({
                ...mockInventoryItem,
                version: 1,
            } as any);
            prisma.inventoryItem.update.mockRejectedValue({
                code: 'P2025',
                message: 'Record not found or version mismatch',
            });

            const result = await service.updateSingle(
                createUpdateItem(),
                { ...createContext(), useOptimisticLocking: true }
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('modified');
        });

        it('should retry on conflict', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update
                .mockRejectedValueOnce({ code: 'P2025' })
                .mockResolvedValueOnce({ ...mockInventoryItem, quantity: 50 } as any);

            const result = await service.updateSingle(
                createUpdateItem(),
                { ...createContext(), useOptimisticLocking: true, retryOnConflict: true }
            );

            expect(result.success).toBe(true);
        });

        it('should isolate concurrent bulk updates for different orgs', async () => {
            prisma.inventoryItem.findFirst.mockImplementation(async (args: any) => {
                if (args.where.organizationId === testOrgId) {
                    return mockInventoryItem;
                }
                return null;
            });
            prisma.inventoryItem.update.mockResolvedValue({ ...mockInventoryItem, quantity: 50 } as any);

            const [result1, result2] = await Promise.all([
                service.updateSingle(createUpdateItem(), createContext()),
                service.updateSingle(createUpdateItem(), { ...createContext(), organizationId: 'other-org' }),
            ]);

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(false);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - INPUT VALIDATION
    // =========================================================================
    describe('Hardening: Input Validation', () => {
        it('should reject NaN quantity', async () => {
            const result = await service.updateSingle(
                createUpdateItem({ quantity: NaN }),
                createContext()
            );

            expect(result.success).toBe(false);
        });

        it('should reject Infinity quantity', async () => {
            const result = await service.updateSingle(
                createUpdateItem({ quantity: Infinity }),
                createContext()
            );

            expect(result.success).toBe(false);
        });

        it('should reject null quantity', async () => {
            const result = await service.updateSingle(
                createUpdateItem({ quantity: null as any }),
                createContext()
            );

            expect(result.success).toBe(false);
        });

        it('should sanitize notes field', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({ ...mockInventoryItem, quantity: 50 } as any);
            prisma.inventoryAuditLog.create.mockResolvedValue({ id: 'audit-001' } as any);

            await service.updateSingle(
                createUpdateItem({ notes: '<script>alert("xss")</script>' }),
                createContext()
            );

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        notes: expect.not.stringContaining('<script>'),
                    }),
                })
            );
        });

        it('should handle empty SKU', async () => {
            const result = await service.updateSingle(
                createUpdateItem({ sku: '' }),
                createContext()
            );

            expect(result.success).toBe(false);
        });

        it('should handle whitespace-only SKU', async () => {
            const result = await service.updateSingle(
                createUpdateItem({ sku: '   ' }),
                createContext()
            );

            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - BOUNDARY CONDITIONS
    // =========================================================================
    describe('Hardening: Boundary Conditions', () => {
        it('should handle exactly zero quantity', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({ ...mockInventoryItem, quantity: 0 } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 0, updateType: UpdateType.ABSOLUTE }),
                createContext()
            );

            expect(result.success).toBe(true);
        });

        it('should handle max quantity', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                quantity: 10_000_000,
            } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: 10_000_000, updateType: UpdateType.ABSOLUTE }),
                createContext()
            );

            expect(result.success).toBe(true);
        });

        it('should reject quantity above max', async () => {
            const result = await service.updateSingle(
                createUpdateItem({ quantity: 10_000_001, updateType: UpdateType.ABSOLUTE }),
                createContext()
            );

            expect(result.success).toBe(false);
        });

        it('should handle adjustment to exactly zero', async () => {
            // Use item with no reserved quantity to allow full reduction
            prisma.inventoryItem.findFirst.mockResolvedValue({
                ...mockInventoryItem,
                reservedQuantity: 0,
            } as any);
            prisma.inventoryItem.update.mockResolvedValue({ ...mockInventoryItem, quantity: 0 } as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: -100, updateType: UpdateType.ADJUSTMENT }),
                createContext()
            );

            expect(result.success).toBe(true);
            expect(result.newQuantity).toBe(0);
        });

        it('should prevent adjustment one below zero', async () => {
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);

            const result = await service.updateSingle(
                createUpdateItem({ quantity: -101, updateType: UpdateType.ADJUSTMENT }),
                createContext()
            );

            expect(result.success).toBe(false);
        });
    });
});
