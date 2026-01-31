/**
 * Bulk Inventory Update (Cycle Count) Integration Tests (INV-03)
 * 
 * NEW WORKFLOW: Step A+D Combined
 * All tests (basic + hardening) written BEFORE implementation
 * 
 * Integration tests verify:
 * - Full update workflow end-to-end
 * - Cycle count sessions
 * - Cross-org security
 * - Variance reporting
 * - Audit trail integrity
 * - Database integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import {
    InventoryUpdateService,
    UpdateType,
    CycleCountType,
} from '../../src/modules/inventory/inventory-update.service';
import { InventoryValidationService } from '../../src/modules/inventory/inventory-validation.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('InventoryUpdate Integration (e2e)', () => {
    let service: InventoryUpdateService;
    let prisma: jest.Mocked<PrismaService>;
    let validationService: jest.Mocked<InventoryValidationService>;
    let eventEmitter: jest.Mocked<EventEmitter2>;

    // Simulated database
    const inventoryDb = new Map<string, any>();
    const auditLogDb: any[] = [];
    const cycleCountSessions = new Map<string, any>();

    const org1 = 'org-alpha';
    const org2 = 'org-beta';
    const testWarehouseId = 'wh-main';
    const testUserId = 'user-001';

    const createContext = (overrides = {}) => ({
        organizationId: org1,
        warehouseId: testWarehouseId,
        userId: testUserId,
        ...overrides,
    });

    const seedInventory = () => {
        inventoryDb.set(`${org1}:SKU-001`, {
            id: 'inv-001',
            organizationId: org1,
            warehouseId: testWarehouseId,
            sku: 'SKU-001',
            quantity: 100,
            reservedQuantity: 10,
            version: 1,
        });
        inventoryDb.set(`${org1}:SKU-002`, {
            id: 'inv-002',
            organizationId: org1,
            warehouseId: testWarehouseId,
            sku: 'SKU-002',
            quantity: 50,
            reservedQuantity: 0,
            version: 1,
        });
        inventoryDb.set(`${org1}:SKU-003`, {
            id: 'inv-003',
            organizationId: org1,
            warehouseId: testWarehouseId,
            sku: 'SKU-003',
            quantity: 200,
            reservedQuantity: 50,
            version: 1,
        });
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        inventoryDb.clear();
        auditLogDb.length = 0;
        cycleCountSessions.clear();

        seedInventory();

        let auditIdCounter = 0;
        let sessionIdCounter = 0;

        prisma = {
            inventoryItem: {
                findFirst: jest.fn((args) => {
                    const key = `${args.where.organizationId}:${args.where.sku}`;
                    return Promise.resolve(inventoryDb.get(key) || null);
                }),
                findMany: jest.fn((args) => {
                    const items = Array.from(inventoryDb.values()).filter(
                        i => i.organizationId === args.where.organizationId &&
                            i.warehouseId === args.where.warehouseId
                    );
                    return Promise.resolve(items);
                }),
                update: jest.fn((args) => {
                    const item = Array.from(inventoryDb.values()).find(i => i.id === args.where.id);
                    if (item) {
                        Object.assign(item, args.data, { version: item.version + 1 });
                        return Promise.resolve(item);
                    }
                    return Promise.reject(new Error('Not found'));
                }),
                updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
                create: jest.fn((args) => {
                    const item = { id: `inv-new-${Date.now()}`, ...args.data, version: 1 };
                    inventoryDb.set(`${args.data.organizationId}:${args.data.sku}`, item);
                    return Promise.resolve(item);
                }),
            },
            inventoryAuditLog: {
                create: jest.fn((args) => {
                    auditIdCounter++;
                    const log = { id: `audit-${auditIdCounter}`, ...args.data, createdAt: new Date() };
                    auditLogDb.push(log);
                    return Promise.resolve(log);
                }),
                createMany: jest.fn((args) => {
                    args.data.forEach((d: any) => {
                        auditIdCounter++;
                        auditLogDb.push({ id: `audit-${auditIdCounter}`, ...d });
                    });
                    return Promise.resolve({ count: args.data.length });
                }),
                findMany: jest.fn(() => Promise.resolve(auditLogDb)),
            },
            cycleCountSession: {
                create: jest.fn((args) => {
                    sessionIdCounter++;
                    const session = { id: `session-${sessionIdCounter}`, ...args.data };
                    cycleCountSessions.set(session.id, session);
                    return Promise.resolve(session);
                }),
                update: jest.fn((args) => {
                    const session = cycleCountSessions.get(args.where.id);
                    if (session) {
                        Object.assign(session, args.data);
                        return Promise.resolve(session);
                    }
                    return Promise.reject(new Error('Session not found'));
                }),
                findFirst: jest.fn((args) => {
                    return Promise.resolve(cycleCountSessions.get(args.where.id) || null);
                }),
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
    // FULL UPDATE WORKFLOW
    // =========================================================================
    describe('Full Update Workflow', () => {
        it('should complete single item update successfully', async () => {
            const result = await service.updateSingle({
                sku: 'SKU-001',
                quantity: 85,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.previousQuantity).toBe(100);
            expect(result.newQuantity).toBe(85);
            expect(result.variance).toBe(-15);
        });

        it('should persist update to database', async () => {
            await service.updateSingle({
                sku: 'SKU-001',
                quantity: 75,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            const item = inventoryDb.get(`${org1}:SKU-001`);
            expect(item.quantity).toBe(75);
        });

        it('should create audit log entry', async () => {
            await service.updateSingle({
                sku: 'SKU-001',
                quantity: 90,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(auditLogDb.length).toBe(1);
            expect(auditLogDb[0]).toMatchObject({
                sku: 'SKU-001',
                previousQuantity: 100,
                newQuantity: 90,
                reasonCode: 'CYCLE_COUNT',
            });
        });

        it('should emit update events', async () => {
            await service.updateSingle({
                sku: 'SKU-001',
                quantity: 80,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'inventory.updated',
                expect.objectContaining({ sku: 'SKU-001' })
            );
        });
    });

    // =========================================================================
    // CYCLE COUNT SESSION WORKFLOW
    // =========================================================================
    describe('Cycle Count Session Workflow', () => {
        it('should create and complete full cycle count session', async () => {
            // Create session
            const session = await service.createCycleCountSession({
                type: CycleCountType.FULL,
                warehouseId: testWarehouseId,
            }, createContext());

            expect(session.id).toBeDefined();
            expect(session.status).toBe('IN_PROGRESS');

            // Submit counts
            await service.submitCycleCount(session.id, [
                { sku: 'SKU-001', countedQuantity: 95 },
                { sku: 'SKU-002', countedQuantity: 48 },
                { sku: 'SKU-003', countedQuantity: 205 },
            ], createContext());

            // Complete session
            const completedSession = await service.completeCycleCountSession(
                session.id,
                createContext()
            );

            expect(completedSession.status).toBe('COMPLETED');
        });

        it('should track variance throughout session', async () => {
            const session = await service.createCycleCountSession({
                type: CycleCountType.FULL,
                warehouseId: testWarehouseId,
            }, createContext());

            await service.submitCycleCount(session.id, [
                { sku: 'SKU-001', countedQuantity: 80 }, // -20 variance
            ], createContext());

            const report = await service.generateVarianceReport(session.id, createContext());

            expect(report.items).toContainEqual(
                expect.objectContaining({
                    sku: 'SKU-001',
                    expectedQuantity: 100,
                    countedQuantity: 80,
                    variance: -20,
                })
            );
        });

        it('should allow partial count with specific SKUs', async () => {
            const session = await service.createCycleCountSession({
                type: CycleCountType.PARTIAL,
                warehouseId: testWarehouseId,
                skus: ['SKU-001', 'SKU-002'],
            }, createContext());

            const items = await service.getSessionItems(session.id, createContext());

            // Should include the requested SKUs
            expect(items.length).toBeGreaterThanOrEqual(2);
            expect(items.some(i => i.sku === 'SKU-001')).toBe(true);
            expect(items.some(i => i.sku === 'SKU-002')).toBe(true);
        });

        it('should support blind count mode', async () => {
            const session = await service.createCycleCountSession({
                type: CycleCountType.FULL,
                warehouseId: testWarehouseId,
                isBlind: true,
            }, createContext());

            const items = await service.getSessionItems(session.id, createContext());

            // Expected quantities should be hidden in blind mode
            items.forEach(item => {
                expect(item.expectedQuantity).toBeUndefined();
            });
        });
    });

    // =========================================================================
    // BULK UPDATES E2E
    // =========================================================================
    describe('Bulk Updates E2E', () => {
        it('should process bulk adjustments', async () => {
            const result = await service.updateBulk([
                { sku: 'SKU-001', quantity: 90, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
                { sku: 'SKU-002', quantity: 55, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
                { sku: 'SKU-003', quantity: 180, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
            ], createContext());

            expect(result.successCount).toBe(3);
            expect(result.errorCount).toBe(0);
            expect(auditLogDb.length).toBe(3);
        });

        it('should handle mixed success and failure', async () => {
            const result = await service.updateBulk([
                { sku: 'SKU-001', quantity: 90, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
                { sku: 'SKU-INVALID', quantity: 50, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
                { sku: 'SKU-002', quantity: 55, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
            ], createContext());

            expect(result.successCount).toBe(2);
            expect(result.errorCount).toBe(1);
            expect(result.errors[0].sku).toBe('SKU-INVALID');
        });

        it('should create single audit entry per item', async () => {
            await service.updateBulk([
                { sku: 'SKU-001', quantity: 90, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
                { sku: 'SKU-002', quantity: 55, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
            ], createContext());

            expect(auditLogDb.length).toBe(2);
        });
    });

    // =========================================================================
    // CROSS-ORG SECURITY
    // =========================================================================
    describe('Cross-Org Security', () => {
        it('should reject update for item from different org', async () => {
            const result = await service.updateSingle({
                sku: 'SKU-001', // Belongs to org1
                quantity: 50,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'CYCLE_COUNT',
            }, createContext({ organizationId: org2 }));

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should isolate cycle count sessions per org', async () => {
            const session1 = await service.createCycleCountSession({
                type: CycleCountType.FULL,
                warehouseId: testWarehouseId,
            }, createContext({ organizationId: org1 }));

            // Org2 trying to access org1's session
            await expect(
                service.getSessionItems(session1.id, createContext({ organizationId: org2 }))
            ).rejects.toThrow();
        });

        it('should only include org items in variance report', async () => {
            // Add item for org2
            inventoryDb.set(`${org2}:SKU-ORG2`, {
                id: 'inv-org2',
                organizationId: org2,
                warehouseId: testWarehouseId,
                sku: 'SKU-ORG2',
                quantity: 100,
            });

            const session = await service.createCycleCountSession({
                type: CycleCountType.FULL,
                warehouseId: testWarehouseId,
            }, createContext({ organizationId: org1 }));

            const items = await service.getSessionItems(session.id, createContext());

            // Should not include org2 items
            expect(items.find(i => i.sku === 'SKU-ORG2')).toBeUndefined();
        });
    });

    // =========================================================================
    // VARIANCE REPORTING
    // =========================================================================
    describe('Variance Reporting', () => {
        it('should generate accurate variance report', async () => {
            const session = await service.createCycleCountSession({
                type: CycleCountType.FULL,
                warehouseId: testWarehouseId,
            }, createContext());

            await service.submitCycleCount(session.id, [
                { sku: 'SKU-001', countedQuantity: 95 },  // -5
                { sku: 'SKU-002', countedQuantity: 55 },  // +5
                { sku: 'SKU-003', countedQuantity: 200 }, // 0
            ], createContext());

            const report = await service.generateVarianceReport(session.id, createContext());

            expect(report.totalItems).toBe(3);
            expect(report.itemsWithVariance).toBe(2);
            expect(report.totalVariance).toBe(0); // -5 + 5 = 0
            expect(report.absoluteVariance).toBe(10); // |5| + |5| = 10
        });

        it('should calculate variance percentages', async () => {
            const session = await service.createCycleCountSession({
                type: CycleCountType.FULL,
                warehouseId: testWarehouseId,
            }, createContext());

            await service.submitCycleCount(session.id, [
                { sku: 'SKU-001', countedQuantity: 80 }, // -20%
            ], createContext());

            const report = await service.generateVarianceReport(session.id, createContext());

            expect(report.items[0].variancePercent).toBeCloseTo(-20);
        });

        it('should flag high variance items', async () => {
            const session = await service.createCycleCountSession({
                type: CycleCountType.FULL,
                warehouseId: testWarehouseId,
            }, createContext());

            await service.submitCycleCount(session.id, [
                { sku: 'SKU-001', countedQuantity: 50 }, // -50%
            ], createContext());

            const report = await service.generateVarianceReport(session.id, {
                ...createContext(),
                varianceErrorThreshold: 25,
            });

            expect(report.items[0].varianceLevel).toBe('ERROR');
        });
    });

    // =========================================================================
    // AUDIT TRAIL INTEGRITY
    // =========================================================================
    describe('Audit Trail Integrity', () => {
        it('should record complete before/after state', async () => {
            await service.updateSingle({
                sku: 'SKU-001',
                quantity: 75,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'DAMAGE',
                notes: '25 units damaged in shipping',
            }, createContext());

            expect(auditLogDb[0]).toMatchObject({
                organizationId: org1,
                warehouseId: testWarehouseId,
                userId: testUserId,
                sku: 'SKU-001',
                previousQuantity: 100,
                newQuantity: 75,
                variance: -25,
                reasonCode: 'DAMAGE',
                notes: '25 units damaged in shipping',
            });
        });

        it('should record timestamp for all changes', async () => {
            await service.updateSingle({
                sku: 'SKU-001',
                quantity: 90,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(auditLogDb[0].createdAt).toBeDefined();
            expect(auditLogDb[0].createdAt).toBeInstanceOf(Date);
        });

        it('should maintain audit log even on partial failure', async () => {
            await service.updateBulk([
                { sku: 'SKU-001', quantity: 90, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
                { sku: 'SKU-INVALID', quantity: 50, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
            ], createContext());

            // First item should have audit log even though second failed
            expect(auditLogDb.length).toBe(1);
            expect(auditLogDb[0].sku).toBe('SKU-001');
        });
    });

    // =========================================================================
    // STEP D: HARDENING - CONCURRENT OPERATIONS
    // =========================================================================
    describe('Hardening: Concurrent Operations', () => {
        it('should handle concurrent updates to same item', async () => {
            const promises = Array(5).fill(null).map((_, i) =>
                service.updateSingle({
                    sku: 'SKU-001',
                    quantity: 90 + i,
                    updateType: UpdateType.ABSOLUTE,
                    reasonCode: 'CYCLE_COUNT',
                }, createContext())
            );

            const results = await Promise.all(promises);

            // All should complete (implementation handles concurrency)
            expect(results.every(r => r !== undefined)).toBe(true);
        });

        it('should handle concurrent cycle count sessions', async () => {
            const [session1, session2] = await Promise.all([
                service.createCycleCountSession({
                    type: CycleCountType.PARTIAL,
                    warehouseId: testWarehouseId,
                    skus: ['SKU-001'],
                }, createContext()),
                service.createCycleCountSession({
                    type: CycleCountType.PARTIAL,
                    warehouseId: testWarehouseId,
                    skus: ['SKU-002'],
                }, createContext()),
            ]);

            expect(session1.id).not.toBe(session2.id);
        });

        it('should isolate bulk updates between orgs', async () => {
            inventoryDb.set(`${org2}:SKU-ORG2`, {
                id: 'inv-org2',
                organizationId: org2,
                warehouseId: testWarehouseId,
                sku: 'SKU-ORG2',
                quantity: 100,
            });

            const [result1, result2] = await Promise.all([
                service.updateBulk([
                    { sku: 'SKU-001', quantity: 90, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
                ], createContext({ organizationId: org1 })),
                service.updateBulk([
                    { sku: 'SKU-ORG2', quantity: 80, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
                ], createContext({ organizationId: org2 })),
            ]);

            expect(result1.successCount).toBe(1);
            expect(result2.successCount).toBe(1);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - DATABASE FAILURES
    // =========================================================================
    describe('Hardening: Database Failures', () => {
        it('should handle database connection failure', async () => {
            prisma.inventoryItem.findFirst.mockRejectedValue(new Error('Connection refused'));

            const result = await service.updateSingle({
                sku: 'SKU-001',
                quantity: 90,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('Connection');
        });

        it('should handle transaction deadlock in bulk update', async () => {
            prisma.$transaction.mockRejectedValue(new Error('Deadlock detected'));

            const result = await service.updateBulk([
                { sku: 'SKU-001', quantity: 90, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
            ], { ...createContext(), atomic: true });

            expect(result.success).toBe(false);
        });

        it('should handle update failure after successful read', async () => {
            prisma.inventoryItem.update.mockRejectedValue(new Error('Update failed'));

            const result = await service.updateSingle({
                sku: 'SKU-001',
                quantity: 90,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - INPUT VALIDATION
    // =========================================================================
    describe('Hardening: Input Validation', () => {
        it.each([NaN, Infinity, -Infinity, null, undefined])(
            'should reject invalid quantity: %s',
            async (quantity) => {
                const result = await service.updateSingle({
                    sku: 'SKU-001',
                    quantity: quantity as any,
                    updateType: UpdateType.ABSOLUTE,
                    reasonCode: 'CYCLE_COUNT',
                }, createContext());

                expect(result.success).toBe(false);
            }
        );

        it('should sanitize XSS in notes field', async () => {
            await service.updateSingle({
                sku: 'SKU-001',
                quantity: 90,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'CYCLE_COUNT',
                notes: '<script>alert("xss")</script>',
            }, createContext());

            expect(auditLogDb[0].notes).not.toContain('<script>');
        });

        it('should reject empty reason code', async () => {
            const result = await service.updateSingle({
                sku: 'SKU-001',
                quantity: 90,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: '',
            }, createContext());

            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - BOUNDARY CONDITIONS
    // =========================================================================
    describe('Hardening: Boundary Conditions', () => {
        it('should handle zero quantity update', async () => {
            const result = await service.updateSingle({
                sku: 'SKU-001',
                quantity: 0,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'WRITE_OFF',
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.newQuantity).toBe(0);
        });

        it('should handle max quantity', async () => {
            const result = await service.updateSingle({
                sku: 'SKU-001',
                quantity: 10_000_000,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'RECEIVING',
            }, createContext());

            expect(result.success).toBe(true);
        });

        it('should reject quantity above max', async () => {
            const result = await service.updateSingle({
                sku: 'SKU-001',
                quantity: 10_000_001,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'RECEIVING',
            }, createContext());

            expect(result.success).toBe(false);
        });

        it('should handle adjustment to exactly reserved quantity', async () => {
            // SKU-001 has quantity=100, reservedQuantity=10
            // Adjusting -90 leaves exactly 10 (the reserved amount)
            const result = await service.updateSingle({
                sku: 'SKU-001',
                quantity: -90,
                updateType: UpdateType.ADJUSTMENT,
                reasonCode: 'DAMAGE',
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.newQuantity).toBe(10);
        });

        it('should reject adjustment below reserved quantity', async () => {
            // Trying to reduce below reserved (10)
            const result = await service.updateSingle({
                sku: 'SKU-001',
                quantity: -95, // Would leave 5, but 10 are reserved
                updateType: UpdateType.ADJUSTMENT,
                reasonCode: 'DAMAGE',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('reserved');
        });
    });

    // =========================================================================
    // STEP D: HARDENING - PERFORMANCE
    // =========================================================================
    describe('Hardening: Performance', () => {
        it('should handle large bulk update', async () => {
            // Add 100 items
            for (let i = 0; i < 100; i++) {
                inventoryDb.set(`${org1}:SKU-BULK-${i}`, {
                    id: `inv-bulk-${i}`,
                    organizationId: org1,
                    warehouseId: testWarehouseId,
                    sku: `SKU-BULK-${i}`,
                    quantity: 100 + i,
                    reservedQuantity: 0,
                });
            }

            const items = Array(100).fill(null).map((_, i) => ({
                sku: `SKU-BULK-${i}`,
                quantity: 50 + i,
                updateType: UpdateType.ABSOLUTE,
                reasonCode: 'CYCLE_COUNT',
            }));

            const result = await service.updateBulk(items, createContext());

            expect(result.successCount).toBe(100);
        });

        it('should complete within reasonable time', async () => {
            const start = Date.now();

            await service.updateBulk([
                { sku: 'SKU-001', quantity: 90, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
                { sku: 'SKU-002', quantity: 55, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
                { sku: 'SKU-003', quantity: 180, updateType: UpdateType.ABSOLUTE, reasonCode: 'CYCLE_COUNT' },
            ], createContext());

            const duration = Date.now() - start;

            // Should complete in under 1 second for 3 items
            expect(duration).toBeLessThan(1000);
        });
    });
});
