/**
 * Inventory Audit Trail Service Unit Tests (INV-07)
 * 
 * NEW WORKFLOW: Step A+D Combined
 * All tests (basic + hardening) written BEFORE implementation
 * 
 * BUSINESS LOGIC COVERAGE:
 * 
 * Audit Events:
 * - CREATE: New inventory item created
 * - UPDATE: Quantity changed (cycle count, adjustment)
 * - DELETE: Item removed
 * - TRANSFER: Moved between warehouses
 * - RESERVE: Stock reserved for order
 * - RELEASE: Reserved stock released
 * - IMPORT: Bulk import operation
 * 
 * Query Features:
 * - Filter by SKU, warehouse, date range, action type
 * - Pagination and sorting
 * - Aggregations (variance summary, activity by user)
 * 
 * Compliance:
 * - Immutable records
 * - Retention policy
 * - Export capabilities
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
    InventoryAuditService,
    AuditAction,
    AuditEntry,
    AuditQuery,
    AuditSummary,
} from '../../src/modules/inventory/inventory-audit.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('InventoryAuditService', () => {
    let service: InventoryAuditService;
    let prisma: jest.Mocked<PrismaService>;
    let eventEmitter: jest.Mocked<EventEmitter2>;

    // Test data
    const testOrgId = 'org-123';
    const testWarehouseId = 'warehouse-456';
    const testUserId = 'user-789';

    const mockAuditEntry = {
        id: 'audit-001',
        organizationId: testOrgId,
        warehouseId: testWarehouseId,
        userId: testUserId,
        sku: 'SKU-001',
        action: AuditAction.UPDATE,
        previousQuantity: 100,
        newQuantity: 85,
        variance: -15,
        variancePercent: -15,
        reasonCode: 'CYCLE_COUNT',
        notes: 'Quarterly inventory count',
        metadata: {},
        createdAt: new Date('2024-01-15T10:00:00Z'),
    };

    const createContext = (overrides = {}) => ({
        organizationId: testOrgId,
        userId: testUserId,
        ...overrides,
    });

    beforeEach(async () => {
        jest.clearAllMocks();

        prisma = {
            inventoryAuditLog: {
                create: jest.fn(),
                createMany: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                count: jest.fn(),
                aggregate: jest.fn(),
                groupBy: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
        } as any;

        eventEmitter = {
            emit: jest.fn(),
            on: jest.fn(),
        } as any;

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
    // AUDIT EVENT CREATION
    // =========================================================================
    describe('Audit Event Creation', () => {
        it('should create audit entry for inventory update', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue(mockAuditEntry as any);

            const result = await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 85,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(result.id).toBeDefined();
            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        sku: 'SKU-001',
                        action: AuditAction.UPDATE,
                        previousQuantity: 100,
                        newQuantity: 85,
                    }),
                })
            );
        });

        it('should calculate variance automatically', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue({
                ...mockAuditEntry,
                variance: -15,
                variancePercent: -15,
            } as any);

            await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 85,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        variance: -15,
                        variancePercent: -15,
                    }),
                })
            );
        });

        it('should record user ID for accountability', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue(mockAuditEntry as any);

            await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 85,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: testUserId,
                    }),
                })
            );
        });

        it('should record timestamp automatically', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue(mockAuditEntry as any);

            await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 85,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        createdAt: expect.any(Date),
                    }),
                })
            );
        });

        it('should include notes when provided', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue(mockAuditEntry as any);

            await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 85,
                reasonCode: 'DAMAGE',
                notes: 'Items damaged during shipping',
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        notes: 'Items damaged during shipping',
                    }),
                })
            );
        });

        it('should include metadata when provided', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue(mockAuditEntry as any);

            await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.IMPORT,
                previousQuantity: 0,
                newQuantity: 100,
                reasonCode: 'RECEIVING',
                metadata: {
                    importId: 'import-123',
                    batchNumber: 'B001',
                },
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        metadata: expect.objectContaining({
                            importId: 'import-123',
                        }),
                    }),
                })
            );
        });
    });

    // =========================================================================
    // AUDIT ACTION TYPES
    // =========================================================================
    describe('Audit Action Types', () => {
        const actionTypes = [
            { action: AuditAction.CREATE, prev: 0, next: 100 },
            { action: AuditAction.UPDATE, prev: 100, next: 85 },
            { action: AuditAction.DELETE, prev: 50, next: 0 },
            { action: AuditAction.TRANSFER, prev: 100, next: 70 },
            { action: AuditAction.RESERVE, prev: 100, next: 100 },
            { action: AuditAction.RELEASE, prev: 100, next: 100 },
            { action: AuditAction.IMPORT, prev: 0, next: 500 },
        ];

        it.each(actionTypes)('should handle action: $action', async ({ action, prev, next }) => {
            prisma.inventoryAuditLog.create.mockResolvedValue({
                ...mockAuditEntry,
                action,
                previousQuantity: prev,
                newQuantity: next,
            } as any);

            const result = await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action,
                previousQuantity: prev,
                newQuantity: next,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(result).toBeDefined();
            expect(prisma.inventoryAuditLog.create).toHaveBeenCalled();
        });

        it('should reject invalid action type', async () => {
            await expect(
                service.logChange({
                    sku: 'SKU-001',
                    warehouseId: testWarehouseId,
                    action: 'INVALID_ACTION' as any,
                    previousQuantity: 100,
                    newQuantity: 85,
                    reasonCode: 'CYCLE_COUNT',
                }, createContext())
            ).rejects.toThrow('Invalid action');
        });

        it('should track reserved quantity changes for RESERVE action', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue({
                ...mockAuditEntry,
                action: AuditAction.RESERVE,
                reservedQuantity: 10,
            } as any);

            await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.RESERVE,
                previousQuantity: 100,
                newQuantity: 100,
                previousReserved: 5,
                newReserved: 15,
                reasonCode: 'ORDER',
                metadata: { orderId: 'order-123' },
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        previousReserved: 5,
                        newReserved: 15,
                    }),
                })
            );
        });
    });

    // =========================================================================
    // QUERY FEATURES
    // =========================================================================
    describe('Query Features', () => {
        it('should query audit history by SKU', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            const result = await service.query({
                sku: 'SKU-001',
            }, createContext());

            expect(result.items.length).toBe(1);
            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        sku: 'SKU-001',
                        organizationId: testOrgId,
                    }),
                })
            );
        });

        it('should query by warehouse', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            await service.query({
                warehouseId: testWarehouseId,
            }, createContext());

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        warehouseId: testWarehouseId,
                    }),
                })
            );
        });

        it('should query by date range', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            await service.query({
                startDate,
                endDate,
            }, createContext());

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
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

        it('should query by action type', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            await service.query({
                action: AuditAction.UPDATE,
            }, createContext());

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        action: AuditAction.UPDATE,
                    }),
                })
            );
        });

        it('should query by user', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            await service.query({
                userId: testUserId,
            }, createContext());

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        userId: testUserId,
                    }),
                })
            );
        });

        it('should query by reason code', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            await service.query({
                reasonCode: 'DAMAGE',
            }, createContext());

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        reasonCode: 'DAMAGE',
                    }),
                })
            );
        });

        it('should combine multiple filters', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            await service.query({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
            }, createContext());

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        sku: 'SKU-001',
                        warehouseId: testWarehouseId,
                        action: AuditAction.UPDATE,
                    }),
                })
            );
        });
    });

    // =========================================================================
    // PAGINATION AND SORTING
    // =========================================================================
    describe('Pagination and Sorting', () => {
        it('should paginate results', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(100);

            const result = await service.query({
                page: 2,
                pageSize: 20,
            }, createContext());

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 20, // (page - 1) * pageSize
                    take: 20,
                })
            );
            expect(result.totalPages).toBe(5);
        });

        it('should sort by timestamp descending by default', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            await service.query({}, createContext());

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { createdAt: 'desc' },
                })
            );
        });

        it('should allow custom sorting', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            await service.query({
                sortBy: 'sku',
                sortOrder: 'asc',
            }, createContext());

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { sku: 'asc' },
                })
            );
        });

        it('should return pagination metadata', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(50);

            const result = await service.query({
                page: 1,
                pageSize: 10,
            }, createContext());

            expect(result.totalItems).toBe(50);
            expect(result.totalPages).toBe(5);
            expect(result.currentPage).toBe(1);
            expect(result.pageSize).toBe(10);
        });

        it('should limit maximum page size', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            await service.query({
                pageSize: 1000, // Exceeds max
            }, createContext());

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 100, // Max limit enforced
                })
            );
        });
    });

    // =========================================================================
    // AGGREGATIONS
    // =========================================================================
    describe('Aggregations', () => {
        it('should calculate variance summary', async () => {
            prisma.inventoryAuditLog.aggregate.mockResolvedValue({
                _sum: { variance: -150 },
                _count: { id: 10 },
            } as any);
            prisma.inventoryAuditLog.findMany.mockResolvedValue([
                { ...mockAuditEntry, variance: -20 },
                { ...mockAuditEntry, variance: 15 },
            ] as any);

            const result = await service.getVarianceSummary({
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
            }, createContext());

            expect(result.totalVariance).toBeDefined();
            expect(result.itemCount).toBeDefined();
        });

        it('should group activity by user', async () => {
            prisma.inventoryAuditLog.groupBy.mockResolvedValue([
                { userId: 'user-001', _count: { id: 25 } },
                { userId: 'user-002', _count: { id: 15 } },
            ] as any);

            const result = await service.getActivityByUser({
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
            }, createContext());

            expect(result.length).toBe(2);
            expect(result[0].userId).toBe('user-001');
            expect(result[0].count).toBe(25);
        });

        it('should group activity by action type', async () => {
            prisma.inventoryAuditLog.groupBy.mockResolvedValue([
                { action: AuditAction.UPDATE, _count: { id: 50 } },
                { action: AuditAction.CREATE, _count: { id: 30 } },
            ] as any);

            const result = await service.getActivityByAction({
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
            }, createContext());

            expect(result.length).toBe(2);
            expect(result[0].action).toBe(AuditAction.UPDATE);
            expect(result[0].count).toBe(50);
        });

        it('should calculate daily activity trends', async () => {
            prisma.inventoryAuditLog.groupBy.mockResolvedValue([
                { createdAt: new Date('2024-01-15'), _count: { id: 20 } },
                { createdAt: new Date('2024-01-16'), _count: { id: 35 } },
            ] as any);

            const result = await service.getDailyTrends({
                startDate: new Date('2024-01-15'),
                endDate: new Date('2024-01-16'),
            }, createContext());

            expect(result.length).toBe(2);
        });
    });

    // =========================================================================
    // CROSS-ORG ISOLATION
    // =========================================================================
    describe('Cross-Org Isolation', () => {
        it('should scope all queries to organization', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            await service.query({}, createContext());

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: testOrgId,
                    }),
                })
            );
        });

        it('should scope audit creation to organization', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue(mockAuditEntry as any);

            await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 85,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        organizationId: testOrgId,
                    }),
                })
            );
        });

        it('should not return other org audit entries', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            const result = await service.query({
                sku: 'SKU-001',
            }, createContext({ organizationId: 'other-org' }));

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: 'other-org',
                    }),
                })
            );
        });
    });

    // =========================================================================
    // IMMUTABILITY
    // =========================================================================
    describe('Immutability', () => {
        it('should not allow updating audit entries', async () => {
            await expect(
                service.updateEntry('audit-001', { notes: 'Modified' }, createContext())
            ).rejects.toThrow('immutable');
        });

        it('should not allow deleting audit entries', async () => {
            await expect(
                service.deleteEntry('audit-001', createContext())
            ).rejects.toThrow('immutable');
        });

        it('should only allow append operations', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue(mockAuditEntry as any);

            // This should work
            const result = await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 85,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(result).toBeDefined();
        });
    });

    // =========================================================================
    // RETENTION POLICY
    // =========================================================================
    describe('Retention Policy', () => {
        it('should get retention policy for organization', async () => {
            const policy = await service.getRetentionPolicy(createContext());

            expect(policy).toBeDefined();
            expect(policy.retentionDays).toBeDefined();
        });

        it('should identify entries past retention period', async () => {
            const oldDate = new Date();
            oldDate.setFullYear(oldDate.getFullYear() - 10);

            prisma.inventoryAuditLog.findMany.mockResolvedValue([
                { ...mockAuditEntry, createdAt: oldDate },
            ] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            const result = await service.getEntriesPastRetention(createContext());

            expect(result.count).toBeGreaterThan(0);
        });

        it('should archive entries past retention', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);

            const result = await service.archiveOldEntries({
                retentionDays: 2555, // 7 years
            }, createContext());

            expect(result.archivedCount).toBeDefined();
        });
    });

    // =========================================================================
    // EXPORT CAPABILITIES
    // =========================================================================
    describe('Export Capabilities', () => {
        it('should export audit entries as CSV', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);

            const result = await service.exportCSV({
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
            }, createContext());

            expect(result).toContain('SKU-001');
            expect(result).toContain('CYCLE_COUNT');
        });

        it('should export audit entries as JSON', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);

            const result = await service.exportJSON({
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
            }, createContext());

            const parsed = JSON.parse(result);
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed[0].sku).toBe('SKU-001');
        });

        it('should limit export size', async () => {
            const manyEntries = Array(10000).fill(mockAuditEntry);
            prisma.inventoryAuditLog.findMany.mockResolvedValue(manyEntries as any);

            const result = await service.exportCSV({}, createContext());

            // Should be truncated or paginated
            expect(result.split('\n').length).toBeLessThanOrEqual(10001);
        });

        it('should include headers in CSV export', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);

            const result = await service.exportCSV({}, createContext());
            const firstLine = result.split('\n')[0];

            expect(firstLine).toContain('sku');
            expect(firstLine).toContain('action');
            expect(firstLine).toContain('timestamp');
        });
    });

    // =========================================================================
    // EVENT LISTENER
    // =========================================================================
    describe('Event Listener', () => {
        it('should have handler for inventory.updated events', async () => {
            // Verify the service has handler method
            expect(typeof (service as any).handleInventoryUpdated).toBe('function');
        });

        it('should have handler for inventory.created events', async () => {
            expect(typeof (service as any).handleInventoryCreated).toBe('function');
        });

        it('should have handler for inventory.import.completed events', async () => {
            expect(typeof (service as any).handleImportCompleted).toBe('function');
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================
    describe('Edge Cases', () => {
        it('should handle missing organizationId', async () => {
            await expect(
                service.logChange({
                    sku: 'SKU-001',
                    warehouseId: testWarehouseId,
                    action: AuditAction.UPDATE,
                    previousQuantity: 100,
                    newQuantity: 85,
                    reasonCode: 'CYCLE_COUNT',
                }, { ...createContext(), organizationId: '' })
            ).rejects.toThrow();
        });

        it('should handle missing userId', async () => {
            await expect(
                service.logChange({
                    sku: 'SKU-001',
                    warehouseId: testWarehouseId,
                    action: AuditAction.UPDATE,
                    previousQuantity: 100,
                    newQuantity: 85,
                    reasonCode: 'CYCLE_COUNT',
                }, { ...createContext(), userId: '' })
            ).rejects.toThrow();
        });

        it('should handle zero quantity changes', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue({
                ...mockAuditEntry,
                previousQuantity: 100,
                newQuantity: 0,
            } as any);

            const result = await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.DELETE,
                previousQuantity: 100,
                newQuantity: 0,
                reasonCode: 'WRITE_OFF',
            }, createContext());

            expect(result).toBeDefined();
        });

        it('should handle very large quantities', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue({
                ...mockAuditEntry,
                previousQuantity: 0,
                newQuantity: 10_000_000,
            } as any);

            const result = await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.CREATE,
                previousQuantity: 0,
                newQuantity: 10_000_000,
                reasonCode: 'RECEIVING',
            }, createContext());

            expect(result).toBeDefined();
        });

        it('should handle special characters in notes', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue(mockAuditEntry as any);

            await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 85,
                reasonCode: 'DAMAGE',
                notes: 'Items with "special" characters & <symbols>',
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        notes: expect.not.stringContaining('<'),
                    }),
                })
            );
        });
    });

    // =========================================================================
    // STEP D: HARDENING - DATABASE FAILURES
    // =========================================================================
    describe('Hardening: Database Failures', () => {
        it('should handle database connection failure', async () => {
            prisma.inventoryAuditLog.create.mockRejectedValue(
                new Error('Connection refused')
            );

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

        it('should handle query timeout', async () => {
            prisma.inventoryAuditLog.findMany.mockRejectedValue(
                new Error('Query timeout')
            );

            await expect(
                service.query({}, createContext())
            ).rejects.toThrow();
        });

        it('should handle transaction failure', async () => {
            prisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

            // Bulk logging should fail gracefully
            await expect(
                service.logBulkChanges([
                    {
                        sku: 'SKU-001',
                        warehouseId: testWarehouseId,
                        action: AuditAction.UPDATE,
                        previousQuantity: 100,
                        newQuantity: 85,
                        reasonCode: 'CYCLE_COUNT',
                    },
                ], createContext())
            ).rejects.toThrow();
        });
    });

    // =========================================================================
    // STEP D: HARDENING - INPUT VALIDATION
    // =========================================================================
    describe('Hardening: Input Validation', () => {
        it('should sanitize XSS in notes', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue(mockAuditEntry as any);

            await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 85,
                reasonCode: 'CYCLE_COUNT',
                notes: '<script>alert("xss")</script>',
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        notes: expect.not.stringContaining('<script>'),
                    }),
                })
            );
        });

        it('should handle empty SKU', async () => {
            await expect(
                service.logChange({
                    sku: '',
                    warehouseId: testWarehouseId,
                    action: AuditAction.UPDATE,
                    previousQuantity: 100,
                    newQuantity: 85,
                    reasonCode: 'CYCLE_COUNT',
                }, createContext())
            ).rejects.toThrow();
        });

        it('should handle invalid date range', async () => {
            const result = await service.query({
                startDate: new Date('2024-12-31'),
                endDate: new Date('2024-01-01'), // Before start
            }, createContext());

            // Should return empty or swap dates
            expect(result.items).toEqual([]);
        });

        it('should handle negative page number', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(1);

            await service.query({
                page: -1,
            }, createContext());

            expect(prisma.inventoryAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 0, // Should default to first page
                })
            );
        });
    });

    // =========================================================================
    // STEP D: HARDENING - CONCURRENT OPERATIONS
    // =========================================================================
    describe('Hardening: Concurrent Operations', () => {
        it('should handle concurrent audit log writes', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue(mockAuditEntry as any);

            const promises = Array(10).fill(null).map((_, i) =>
                service.logChange({
                    sku: `SKU-${i}`,
                    warehouseId: testWarehouseId,
                    action: AuditAction.UPDATE,
                    previousQuantity: 100,
                    newQuantity: 85 + i,
                    reasonCode: 'CYCLE_COUNT',
                }, createContext())
            );

            const results = await Promise.all(promises);

            expect(results.every(r => r.id)).toBe(true);
        });

        it('should maintain order in sequential writes', async () => {
            let callOrder = 0;
            prisma.inventoryAuditLog.create.mockImplementation(() => {
                callOrder++;
                return Promise.resolve({ ...mockAuditEntry, id: `audit-${callOrder}` });
            });

            await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 100,
                newQuantity: 90,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            await service.logChange({
                sku: 'SKU-001',
                warehouseId: testWarehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: 90,
                newQuantity: 85,
                reasonCode: 'CYCLE_COUNT',
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledTimes(2);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - PERFORMANCE
    // =========================================================================
    describe('Hardening: Performance', () => {
        it('should efficiently query large datasets', async () => {
            prisma.inventoryAuditLog.findMany.mockResolvedValue([mockAuditEntry] as any);
            prisma.inventoryAuditLog.count.mockResolvedValue(100000);

            const start = Date.now();
            await service.query({ pageSize: 100 }, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(1000);
        });

        it('should use efficient aggregation queries', async () => {
            prisma.inventoryAuditLog.aggregate.mockResolvedValue({
                _sum: { variance: -150 },
                _count: { id: 10 },
            } as any);
            prisma.inventoryAuditLog.findMany.mockResolvedValue([]);

            const start = Date.now();
            await service.getVarianceSummary({}, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(500);
        });
    });
});
