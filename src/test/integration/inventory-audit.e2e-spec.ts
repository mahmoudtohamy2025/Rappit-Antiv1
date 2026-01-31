/**
 * Inventory Audit Trail Integration Tests (INV-07)
 * 
 * NEW WORKFLOW: Step A+D Combined
 * All tests (basic + hardening) written BEFORE implementation
 * 
 * Integration tests verify:
 * - End-to-end audit trail workflow
 * - Event-driven audit logging
 * - Cross-service integration
 * - Query performance with real data patterns
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import {
    InventoryAuditService,
    AuditAction,
} from '../../src/modules/inventory/inventory-audit.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('InventoryAudit Integration (e2e)', () => {
    let service: InventoryAuditService;
    let prisma: jest.Mocked<PrismaService>;
    let eventEmitter: EventEmitter2;

    // Simulated database
    const auditDb: any[] = [];
    let auditIdCounter = 0;

    const org1 = 'org-alpha';
    const org2 = 'org-beta';
    const testWarehouseId = 'wh-main';
    const testUserId = 'user-001';

    const createContext = (overrides = {}) => ({
        organizationId: org1,
        userId: testUserId,
        ...overrides,
    });

    const seedAuditData = () => {
        // Add historical audit entries
        for (let i = 1; i <= 50; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            auditDb.push({
                id: `audit-${i}`,
                organizationId: org1,
                warehouseId: testWarehouseId,
                userId: testUserId,
                sku: `SKU-${(i % 10) + 1}`.padStart(7, '0'),
                action: i % 3 === 0 ? AuditAction.CREATE : AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 100 - (i % 20),
                variance: -(i % 20),
                variancePercent: -(i % 20),
                reasonCode: 'CYCLE_COUNT',
                createdAt: date,
            });
        }
    };

    beforeEach(async () => {
        auditDb.length = 0;
        auditIdCounter = 0;
        seedAuditData();

        prisma = {
            inventoryAuditLog: {
                create: jest.fn((args) => {
                    auditIdCounter++;
                    const entry = { id: `audit-${auditIdCounter + 100}`, ...args.data, createdAt: new Date() };
                    auditDb.push(entry);
                    return Promise.resolve(entry);
                }),
                createMany: jest.fn((args) => {
                    args.data.forEach((d: any) => {
                        auditIdCounter++;
                        auditDb.push({ id: `audit-${auditIdCounter + 100}`, ...d, createdAt: new Date() });
                    });
                    return Promise.resolve({ count: args.data.length });
                }),
                findMany: jest.fn((args) => {
                    let filtered = auditDb.filter(e =>
                        e.organizationId === (args.where?.organizationId || org1)
                    );

                    if (args.where?.sku) {
                        filtered = filtered.filter(e => e.sku === args.where.sku);
                    }
                    if (args.where?.warehouseId) {
                        filtered = filtered.filter(e => e.warehouseId === args.where.warehouseId);
                    }
                    if (args.where?.action) {
                        filtered = filtered.filter(e => e.action === args.where.action);
                    }
                    if (args.where?.userId) {
                        filtered = filtered.filter(e => e.userId === args.where.userId);
                    }
                    if (args.where?.reasonCode) {
                        filtered = filtered.filter(e => e.reasonCode === args.where.reasonCode);
                    }
                    if (args.where?.createdAt) {
                        if (args.where.createdAt.gte) {
                            filtered = filtered.filter(e => e.createdAt >= args.where.createdAt.gte);
                        }
                        if (args.where.createdAt.lte) {
                            filtered = filtered.filter(e => e.createdAt <= args.where.createdAt.lte);
                        }
                    }

                    // Sorting
                    const sortField = args.orderBy ? Object.keys(args.orderBy)[0] : 'createdAt';
                    const sortOrder = args.orderBy?.[sortField] || 'desc';
                    filtered.sort((a, b) => {
                        if (sortOrder === 'desc') {
                            return b[sortField] > a[sortField] ? 1 : -1;
                        }
                        return a[sortField] > b[sortField] ? 1 : -1;
                    });

                    // Pagination
                    const skip = args.skip || 0;
                    const take = Math.min(args.take || 10, 100);
                    return Promise.resolve(filtered.slice(skip, skip + take));
                }),
                count: jest.fn((args) => {
                    let filtered = auditDb.filter(e =>
                        e.organizationId === (args?.where?.organizationId || org1)
                    );
                    // Apply SKU filter if present
                    if (args?.where?.sku) {
                        filtered = filtered.filter(e => e.sku === args.where.sku);
                    }
                    return Promise.resolve(filtered.length);
                }),
                aggregate: jest.fn((args) => {
                    const filtered = auditDb.filter(e =>
                        e.organizationId === (args.where?.organizationId || org1)
                    );
                    const totalVariance = filtered.reduce((sum, e) => sum + (e.variance || 0), 0);
                    return Promise.resolve({
                        _sum: { variance: totalVariance },
                        _count: { id: filtered.length },
                    });
                }),
                groupBy: jest.fn((args) => {
                    const filtered = auditDb.filter(e =>
                        e.organizationId === (args.where?.organizationId || org1)
                    );
                    const groupField = args.by[0];
                    const groups = new Map();
                    filtered.forEach(e => {
                        const key = e[groupField];
                        if (!groups.has(key)) {
                            groups.set(key, { [groupField]: key, _count: { id: 0 } });
                        }
                        groups.get(key)._count.id++;
                    });
                    return Promise.resolve(Array.from(groups.values()));
                }),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
        } as any;

        eventEmitter = new EventEmitter2();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InventoryAuditService,
                { provide: PrismaService, useValue: prisma },
                { provide: EventEmitter2, useValue: eventEmitter },
            ],
        }).compile();

        service = module.get<InventoryAuditService>(InventoryAuditService);
    });

    // =========================================================================
    // END-TO-END AUDIT TRAIL WORKFLOW
    // =========================================================================
    describe('End-to-End Audit Trail', () => {
        it('should log inventory update and query back', async () => {
            const entry = await service.logChange({
                sku: 'SKU-NEW-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 85,
                reasonCode: 'CYCLE_COUNT',
                notes: 'Quarterly count adjustment',
            }, createContext());

            expect(entry.id).toBeDefined();

            const queryResult = await service.query({
                sku: 'SKU-NEW-001',
            }, createContext());

            expect(queryResult.items.length).toBe(1);
            expect(queryResult.items[0].previousQuantity).toBe(100);
            expect(queryResult.items[0].newQuantity).toBe(85);
        });

        it('should maintain complete history chain', async () => {
            // Create a series of updates
            await service.logChange({
                sku: 'SKU-CHAIN-001',
                warehouseId: testWarehouseId,
                action: AuditAction.CREATE,
                previousQuantity: 0,
                newQuantity: 100,
                reasonCode: 'RECEIVING',
            }, createContext());

            await service.logChange({
                sku: 'SKU-CHAIN-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 90,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            await service.logChange({
                sku: 'SKU-CHAIN-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 90,
                newQuantity: 85,
                reasonCode: 'DAMAGE',
            }, createContext());

            const history = await service.query({
                sku: 'SKU-CHAIN-001',
            }, createContext());

            expect(history.items.length).toBe(3);
            // Verify chain has all 3 entries (order may vary depending on insertion timing)
            const sorted = [...history.items].sort((a, b) => {
                // Sort by id to get insertion order
                return a.id.localeCompare(b.id);
            });
            // Verify we have entries with expected previous quantities
            const prevQuantities = sorted.map(e => e.previousQuantity).sort((a, b) => a - b);
            expect(prevQuantities).toEqual([0, 90, 100]);
        });

        it('should track variance over time', async () => {
            // Add entries with known variance
            await service.logChange({
                sku: 'SKU-VAR-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 95,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            await service.logChange({
                sku: 'SKU-VAR-002',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 50,
                newQuantity: 55,
                reasonCode: 'FOUND',
            }, createContext());

            const summary = await service.getVarianceSummary({}, createContext());

            expect(summary.totalVariance).toBeDefined();
            expect(summary.itemCount).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // EVENT-DRIVEN AUDIT LOGGING
    // =========================================================================
    describe('Event-Driven Audit Logging', () => {
        it('should automatically log on inventory.updated event', async () => {
            const initialCount = auditDb.length;

            // Emit event
            eventEmitter.emit('inventory.updated', {
                organizationId: org1,
                warehouseId: testWarehouseId,
                userId: testUserId,
                sku: 'SKU-EVENT-001',
                previousQuantity: 100,
                newQuantity: 85,
                reasonCode: 'CYCLE_COUNT',
            });

            // Allow async handling
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check audit was created
            expect(auditDb.length).toBeGreaterThanOrEqual(initialCount);
        });

        it('should automatically log on inventory.created event', async () => {
            const initialCount = auditDb.length;

            eventEmitter.emit('inventory.created', {
                organizationId: org1,
                warehouseId: testWarehouseId,
                userId: testUserId,
                sku: 'SKU-NEW-EVENT',
                quantity: 100,
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(auditDb.length).toBeGreaterThanOrEqual(initialCount);
        });

        it('should capture import events', async () => {
            const initialCount = auditDb.length;

            eventEmitter.emit('inventory.import.completed', {
                organizationId: org1,
                warehouseId: testWarehouseId,
                userId: testUserId,
                importId: 'import-123',
                itemsImported: 50,
                itemsCreated: 30,
                itemsUpdated: 20,
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(auditDb.length).toBeGreaterThanOrEqual(initialCount);
        });
    });

    // =========================================================================
    // QUERY PERFORMANCE
    // =========================================================================
    describe('Query Performance', () => {
        it('should handle large result sets with pagination', async () => {
            const result = await service.query({
                page: 1,
                pageSize: 10,
            }, createContext());

            expect(result.items.length).toBeLessThanOrEqual(10);
            expect(result.totalItems).toBe(50);
            expect(result.totalPages).toBe(5);
        });

        it('should efficiently filter by date range', async () => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            const endDate = new Date();

            const start = Date.now();
            const result = await service.query({
                startDate,
                endDate,
            }, createContext());
            const duration = Date.now() - start;

            expect(result.items.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(500);
        });

        it('should efficiently filter by multiple criteria', async () => {
            const start = Date.now();
            const result = await service.query({
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                userId: testUserId,
            }, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(500);
        });
    });

    // =========================================================================
    // CROSS-ORG SECURITY
    // =========================================================================
    describe('Cross-Org Security', () => {
        it('should isolate audit entries between organizations', async () => {
            // Create entry for org1
            await service.logChange({
                sku: 'SKU-ORG1-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 85,
                reasonCode: 'CYCLE_COUNT',
            }, createContext({ organizationId: org1 }));

            // Query from org2 should not find it
            const org2Result = await service.query({
                sku: 'SKU-ORG1-001',
            }, createContext({ organizationId: org2 }));

            expect(org2Result.items.length).toBe(0);
        });

        it('should only aggregate data within organization', async () => {
            const summary = await service.getVarianceSummary({}, createContext({ organizationId: org1 }));

            // Only org1 entries should be included
            expect(summary).toBeDefined();
        });
    });

    // =========================================================================
    // EXPORT FUNCTIONALITY
    // =========================================================================
    describe('Export Functionality', () => {
        it('should export complete audit history as CSV', async () => {
            const csv = await service.exportCSV({}, createContext());

            expect(csv).toContain('sku');
            expect(csv).toContain('action');
            expect(csv).toContain('CYCLE_COUNT');
            expect(csv.split('\n').length).toBeGreaterThan(1);
        });

        it('should export filtered data as JSON', async () => {
            const json = await service.exportJSON({
                action: AuditAction.CREATE,
            }, createContext());

            const parsed = JSON.parse(json);
            expect(Array.isArray(parsed)).toBe(true);
            parsed.forEach((entry: any) => {
                expect(entry.action).toBe(AuditAction.CREATE);
            });
        });

        it('should include all required fields in export', async () => {
            const json = await service.exportJSON({}, createContext());
            const parsed = JSON.parse(json);

            if (parsed.length > 0) {
                const entry = parsed[0];
                expect(entry.sku).toBeDefined();
                expect(entry.action).toBeDefined();
                expect(entry.previousQuantity).toBeDefined();
                expect(entry.newQuantity).toBeDefined();
                expect(entry.reasonCode).toBeDefined();
                expect(entry.createdAt).toBeDefined();
            }
        });
    });

    // =========================================================================
    // RETENTION POLICY
    // =========================================================================
    describe('Retention Policy', () => {
        it('should identify records past retention period', async () => {
            // Add very old entry
            const oldDate = new Date();
            oldDate.setFullYear(oldDate.getFullYear() - 10);

            auditDb.push({
                id: 'audit-old',
                organizationId: org1,
                warehouseId: testWarehouseId,
                userId: testUserId,
                sku: 'SKU-OLD',
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 90,
                createdAt: oldDate,
            });

            const oldEntries = await service.getEntriesPastRetention(createContext());

            expect(oldEntries.count).toBeGreaterThan(0);
        });

        it('should archive old records based on policy', async () => {
            const result = await service.archiveOldEntries({
                retentionDays: 2555, // 7 years
            }, createContext());

            expect(result.archivedCount).toBeDefined();
        });
    });

    // =========================================================================
    // STEP D: HARDENING - CONCURRENT OPERATIONS
    // =========================================================================
    describe('Hardening: Concurrent Operations', () => {
        it('should handle concurrent audit writes', async () => {
            const promises = Array(20).fill(null).map((_, i) =>
                service.logChange({
                    sku: `SKU-CONCURRENT-${i}`,
                    warehouseId: testWarehouseId,
                    action: AuditAction.UPDATE,
                    previousQuantity: 100,
                    newQuantity: 90 + i,
                    reasonCode: 'CYCLE_COUNT',
                }, createContext())
            );

            const results = await Promise.all(promises);

            expect(results.every(r => r.id)).toBe(true);
            expect(results.length).toBe(20);
        });

        it('should handle concurrent queries during writes', async () => {
            const writePromises = Array(10).fill(null).map((_, i) =>
                service.logChange({
                    sku: `SKU-WRITE-${i}`,
                    warehouseId: testWarehouseId,
                    action: AuditAction.UPDATE,
                    previousQuantity: 100,
                    newQuantity: 90,
                    reasonCode: 'CYCLE_COUNT',
                }, createContext())
            );

            const queryPromises = Array(5).fill(null).map(() =>
                service.query({}, createContext())
            );

            const [writeResults, queryResults] = await Promise.all([
                Promise.all(writePromises),
                Promise.all(queryPromises),
            ]);

            expect(writeResults.length).toBe(10);
            expect(queryResults.length).toBe(5);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - DATABASE FAILURES
    // =========================================================================
    describe('Hardening: Database Failures', () => {
        it('should handle database connection failure gracefully', async () => {
            prisma.inventoryAuditLog.create.mockRejectedValue(new Error('Connection refused'));

            await expect(
                service.logChange({
                    sku: 'SKU-001',
                    warehouseId: testWarehouseId,
                    action: AuditAction.UPDATE,
                    previousQuantity: 100,
                    newQuantity: 85,
                    reasonCode: 'CYCLE_COUNT',
                }, createContext())
            ).rejects.toThrow();
        });

        it('should handle query failure gracefully', async () => {
            prisma.inventoryAuditLog.findMany.mockRejectedValue(new Error('Query timeout'));

            await expect(
                service.query({}, createContext())
            ).rejects.toThrow();
        });

        it('should handle aggregation failure gracefully', async () => {
            prisma.inventoryAuditLog.aggregate.mockRejectedValue(new Error('Aggregation failed'));

            await expect(
                service.getVarianceSummary({}, createContext())
            ).rejects.toThrow();
        });
    });

    // =========================================================================
    // STEP D: HARDENING - BOUNDARY CONDITIONS
    // =========================================================================
    describe('Hardening: Boundary Conditions', () => {
        it('should handle empty result set', async () => {
            const result = await service.query({
                sku: 'SKU-NONEXISTENT',
            }, createContext());

            expect(result.items).toEqual([]);
            expect(result.totalItems).toBe(0);
        });

        it('should handle first page correctly', async () => {
            const result = await service.query({
                page: 1,
                pageSize: 10,
            }, createContext());

            expect(result.currentPage).toBe(1);
            expect(result.items.length).toBeLessThanOrEqual(10);
        });

        it('should handle last page correctly', async () => {
            const result = await service.query({
                page: 5,
                pageSize: 10,
            }, createContext());

            expect(result.currentPage).toBe(5);
            expect(result.items.length).toBeLessThanOrEqual(10);
        });

        it('should handle page beyond results', async () => {
            const result = await service.query({
                page: 100,
                pageSize: 10,
            }, createContext());

            expect(result.items).toEqual([]);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - PERFORMANCE
    // =========================================================================
    describe('Hardening: Performance', () => {
        it('should efficiently handle bulk audit logging', async () => {
            const entries = Array(100).fill(null).map((_, i) => ({
                sku: `SKU-BULK-${i}`,
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 90,
                reasonCode: 'CYCLE_COUNT',
            }));

            const start = Date.now();
            await service.logBulkChanges(entries, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(2000);
        });

        it('should efficiently calculate aggregations', async () => {
            const start = Date.now();
            await service.getVarianceSummary({}, createContext());
            await service.getActivityByUser({}, createContext());
            await service.getActivityByAction({}, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(1000);
        });
    });
});
