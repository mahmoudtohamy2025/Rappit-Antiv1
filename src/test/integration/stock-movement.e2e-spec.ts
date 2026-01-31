/**
 * Stock Movement Service Integration Tests (INV-02)
 * 
 * NEW WORKFLOW: Step A+D Combined
 * All tests (basic + hardening) written BEFORE implementation
 * 
 * Integration tests verify:
 * - End-to-end movement workflow
 * - Cross-service interactions (inventory, reservations, audit)
 * - Transfer workflow
 * - Security and permissions
 * - Performance under load
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
    StockMovementService,
    MovementType,
    MovementStatus,
    ReferenceType,
} from '../../src/modules/inventory/stock-movement.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('StockMovement Integration (e2e)', () => {
    let service: StockMovementService;
    let prisma: jest.Mocked<PrismaService>;
    let eventEmitter: EventEmitter2;

    // Simulated databases
    const inventoryDb = new Map<string, any>();
    const movementDb = new Map<string, any>();
    const warehouseDb = new Map<string, any>();
    const reservationDb = new Map<string, any>();
    const auditLogDb: any[] = [];
    let eventLog: any[] = [];

    const org1 = 'org-alpha';
    const org2 = 'org-beta';
    const warehouseA = 'warehouse-A';
    const warehouseB = 'warehouse-B';
    const testUserId = 'user-admin';

    const createContext = (overrides = {}) => ({
        organizationId: org1,
        userId: testUserId,
        ...overrides,
    });

    const seedData = () => {
        // Seed warehouses
        warehouseDb.set(warehouseA, {
            id: warehouseA,
            organizationId: org1,
            name: 'Warehouse Cairo',
        });
        warehouseDb.set(warehouseB, {
            id: warehouseB,
            organizationId: org1,
            name: 'Warehouse Alexandria',
        });
        warehouseDb.set('warehouse-org2', {
            id: 'warehouse-org2',
            organizationId: org2,
            name: 'Warehouse Other Org',
        });

        // Seed inventory
        inventoryDb.set(`${warehouseA}:SKU-001`, {
            id: 'inv-A-001',
            organizationId: org1,
            warehouseId: warehouseA,
            sku: 'SKU-001',
            quantity: 100,
            reservedQuantity: 10,
        });
        inventoryDb.set(`${warehouseB}:SKU-001`, {
            id: 'inv-B-001',
            organizationId: org1,
            warehouseId: warehouseB,
            sku: 'SKU-001',
            quantity: 50,
            reservedQuantity: 0,
        });
        inventoryDb.set(`${warehouseA}:SKU-002`, {
            id: 'inv-A-002',
            organizationId: org1,
            warehouseId: warehouseA,
            sku: 'SKU-002',
            quantity: 200,
            reservedQuantity: 0,
        });

        // Seed reservations
        reservationDb.set('res-001', {
            id: 'res-001',
            organizationId: org1,
            warehouseId: warehouseA,
            sku: 'SKU-001',
            quantity: 10,
            orderId: 'order-001',
            status: 'ACTIVE',
        });
    };

    beforeEach(async () => {
        inventoryDb.clear();
        movementDb.clear();
        warehouseDb.clear();
        reservationDb.clear();
        auditLogDb.length = 0;
        eventLog = [];
        seedData();

        let movementIdCounter = 0;

        prisma = {
            inventoryItem: {
                findFirst: jest.fn((args) => {
                    const key = `${args.where.warehouseId}:${args.where.sku}`;
                    const item = inventoryDb.get(key);
                    if (item && item.organizationId === args.where.organizationId) {
                        return Promise.resolve(item);
                    }
                    return Promise.resolve(null);
                }),
                update: jest.fn((args) => {
                    const item = Array.from(inventoryDb.values()).find(i => i.id === args.where.id);
                    if (item) {
                        Object.assign(item, args.data);
                        return Promise.resolve(item);
                    }
                    return Promise.reject(new Error('Not found'));
                }),
                upsert: jest.fn((args) => {
                    const key = `${args.where.warehouseId_sku.warehouseId}:${args.where.warehouseId_sku.sku}`;
                    let item = inventoryDb.get(key);
                    if (item) {
                        Object.assign(item, args.update);
                    } else {
                        item = { id: `inv-new-${inventoryDb.size}`, ...args.create };
                        inventoryDb.set(key, item);
                    }
                    return Promise.resolve(item);
                }),
            },
            warehouse: {
                findFirst: jest.fn((args) => {
                    const wh = warehouseDb.get(args.where.id);
                    if (wh && wh.organizationId === args.where.organizationId) {
                        return Promise.resolve(wh);
                    }
                    return Promise.resolve(null);
                }),
            },
            stockMovement: {
                create: jest.fn((args) => {
                    const movement = {
                        id: `mov-${++movementIdCounter}`,
                        ...args.data,
                        createdAt: new Date(),
                    };
                    movementDb.set(movement.id, movement);
                    return Promise.resolve(movement);
                }),
                findFirst: jest.fn((args) => {
                    if (args.where.id) {
                        const mov = movementDb.get(args.where.id);
                        if (mov && mov.organizationId === args.where.organizationId) {
                            return Promise.resolve(mov);
                        }
                    }
                    return Promise.resolve(null);
                }),
                findMany: jest.fn((args) => {
                    let results = Array.from(movementDb.values()).filter(m =>
                        m.organizationId === args.where.organizationId
                    );
                    if (args.where.warehouseId) {
                        results = results.filter(m => m.warehouseId === args.where.warehouseId);
                    }
                    if (args.where.type) {
                        results = results.filter(m => m.type === args.where.type);
                    }
                    if (args.where.status) {
                        results = results.filter(m => m.status === args.where.status);
                    }
                    if (args.where.sku) {
                        results = results.filter(m => m.sku === args.where.sku);
                    }
                    if (args.skip) {
                        results = results.slice(args.skip);
                    }
                    if (args.take) {
                        results = results.slice(0, args.take);
                    }
                    return Promise.resolve(results);
                }),
                update: jest.fn((args) => {
                    const mov = movementDb.get(args.where.id);
                    if (mov) {
                        Object.assign(mov, args.data);
                        return Promise.resolve(mov);
                    }
                    return Promise.reject(new Error('Not found'));
                }),
                count: jest.fn((args) => {
                    const count = Array.from(movementDb.values()).filter(m =>
                        m.organizationId === args.where.organizationId
                    ).length;
                    return Promise.resolve(count);
                }),
            },
            reservation: {
                findMany: jest.fn((args) => {
                    return Promise.resolve(
                        Array.from(reservationDb.values()).filter(r =>
                            r.organizationId === args.where.organizationId
                        )
                    );
                }),
            },
            inventoryAuditLog: {
                create: jest.fn((args) => {
                    const entry = { id: `audit-${auditLogDb.length + 1}`, ...args.data };
                    auditLogDb.push(entry);
                    return Promise.resolve(entry);
                }),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
        } as any;

        eventEmitter = new EventEmitter2();

        // Track events
        eventEmitter.on('movement.created', (data) => eventLog.push({ event: 'created', ...data }));
        eventEmitter.on('movement.completed', (data) => eventLog.push({ event: 'completed', ...data }));
        eventEmitter.on('movement.cancelled', (data) => eventLog.push({ event: 'cancelled', ...data }));
        eventEmitter.on('inventory.updated', (data) => eventLog.push({ event: 'inventory_updated', ...data }));

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
    // E2E WORKFLOW
    // =========================================================================
    describe('E2E Movement Workflow', () => {
        it('should complete full receive → execute workflow', async () => {
            // Step 1: Create RECEIVE movement
            const createResult = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 50,
                type: MovementType.RECEIVE,
                reason: 'Supplier delivery',
                referenceId: 'po-001',
                referenceType: ReferenceType.PURCHASE_ORDER,
            }, createContext());

            expect(createResult.success).toBe(true);
            expect(createResult.status).toBe(MovementStatus.PENDING);

            // Step 2: Execute movement
            const executeResult = await service.executeMovement(createResult.movementId, createContext());

            expect(executeResult.success).toBe(true);
            expect(executeResult.status).toBe(MovementStatus.COMPLETED);

            // Verify inventory updated
            const invKey = `${warehouseA}:SKU-001`;
            expect(inventoryDb.get(invKey).quantity).toBe(150); // 100 + 50
        });

        it('should complete full ship → execute workflow', async () => {
            const originalQty = inventoryDb.get(`${warehouseA}:SKU-001`).quantity;

            // Step 1: Create SHIP movement
            const createResult = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 30,
                type: MovementType.SHIP,
                reason: 'Customer order',
                referenceId: 'order-123',
                referenceType: ReferenceType.ORDER,
            }, createContext());

            expect(createResult.success).toBe(true);

            // Step 2: Execute movement
            const executeResult = await service.executeMovement(createResult.movementId, createContext());

            expect(executeResult.success).toBe(true);

            // Verify inventory decreased
            const invKey = `${warehouseA}:SKU-001`;
            expect(inventoryDb.get(invKey).quantity).toBe(originalQty - 30);
        });

        it('should create audit log entries', async () => {
            const createResult = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 25,
                type: MovementType.RECEIVE,
                reason: 'Audit test',
            }, createContext());

            await service.executeMovement(createResult.movementId, createContext());

            expect(auditLogDb.length).toBeGreaterThan(0);
            expect(auditLogDb[0].action).toBeDefined();
        });

        it('should emit events on completion', async () => {
            const createResult = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 20,
                type: MovementType.RECEIVE,
                reason: 'Event test',
            }, createContext());

            await service.executeMovement(createResult.movementId, createContext());

            const completedEvents = eventLog.filter(e => e.event === 'completed');
            expect(completedEvents.length).toBeGreaterThan(0);
        });

        it('should handle adjustment add correctly', async () => {
            const originalQty = inventoryDb.get(`${warehouseA}:SKU-001`).quantity;

            const createResult = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 15,
                type: MovementType.ADJUSTMENT_ADD,
                reason: 'Found extra stock',
            }, createContext());

            await service.executeMovement(createResult.movementId, createContext());

            expect(inventoryDb.get(`${warehouseA}:SKU-001`).quantity).toBe(originalQty + 15);
        });

        it('should handle adjustment remove correctly', async () => {
            const originalQty = inventoryDb.get(`${warehouseA}:SKU-001`).quantity;

            const createResult = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 5,
                type: MovementType.ADJUSTMENT_REMOVE,
                reason: 'Discrepancy found',
            }, createContext());

            await service.executeMovement(createResult.movementId, createContext());

            expect(inventoryDb.get(`${warehouseA}:SKU-001`).quantity).toBe(originalQty - 5);
        });

        it('should handle damage write-off correctly', async () => {
            const originalQty = inventoryDb.get(`${warehouseA}:SKU-001`).quantity;

            const createResult = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 3,
                type: MovementType.DAMAGE,
                reason: 'Water damage',
            }, createContext());

            await service.executeMovement(createResult.movementId, createContext());

            expect(inventoryDb.get(`${warehouseA}:SKU-001`).quantity).toBe(originalQty - 3);
        });
    });

    // =========================================================================
    // TRANSFER WORKFLOW
    // =========================================================================
    describe('Transfer Workflow', () => {
        it('should complete full transfer between warehouses', async () => {
            const sourceQty = inventoryDb.get(`${warehouseA}:SKU-001`).quantity;
            const targetQty = inventoryDb.get(`${warehouseB}:SKU-001`).quantity;

            // Create transfer
            const transferResult = await service.createTransfer({
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                sku: 'SKU-001',
                quantity: 20,
                reason: 'Stock rebalancing',
            }, createContext());

            expect(transferResult.success).toBe(true);
            expect(transferResult.transferOutId).toBeDefined();
            expect(transferResult.transferInId).toBeDefined();

            // Execute outbound
            await service.executeMovement(transferResult.transferOutId, createContext());

            // Execute inbound
            await service.executeMovement(transferResult.transferInId, createContext());

            // Verify stock moved
            expect(inventoryDb.get(`${warehouseA}:SKU-001`).quantity).toBe(sourceQty - 20);
            expect(inventoryDb.get(`${warehouseB}:SKU-001`).quantity).toBe(targetQty + 20);
        });

        it('should create linked movement records', async () => {
            const transferResult = await service.createTransfer({
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                sku: 'SKU-001',
                quantity: 10,
                reason: 'Link test',
            }, createContext());

            const outbound = movementDb.get(transferResult.transferOutId);
            const inbound = movementDb.get(transferResult.transferInId);

            expect(outbound.linkedMovementId).toBe(inbound.id);
            expect(inbound.linkedMovementId).toBe(outbound.id);
        });

        it('should reject transfer if source insufficient', async () => {
            const result = await service.createTransfer({
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                sku: 'SKU-001',
                quantity: 500, // More than available
                reason: 'Too much',
            }, createContext());

            expect(result.success).toBe(false);
        });

        it('should create inventory at target if not exists', async () => {
            // SKU-002 exists in A but not in B
            const transferResult = await service.createTransfer({
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                sku: 'SKU-002',
                quantity: 50,
                reason: 'New SKU transfer',
            }, createContext());

            expect(transferResult.success).toBe(true);
        });
    });

    // =========================================================================
    // NEGATIVE STOCK PREVENTION
    // =========================================================================
    describe('Negative Stock Prevention', () => {
        it('should block ship exceeding available after reservation', async () => {
            // 100 total, 10 reserved = 90 available
            const result = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 95, // > 90 available
                type: MovementType.SHIP,
                reason: 'Too much',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('Insufficient');
        });

        it('should block execution if stock changed since creation', async () => {
            // Create movement
            const createResult = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 80,
                type: MovementType.SHIP,
                reason: 'Large order',
            }, createContext());

            // Simulate stock decrease before execution
            inventoryDb.get(`${warehouseA}:SKU-001`).quantity = 50;

            // Try to execute
            const executeResult = await service.executeMovement(createResult.movementId, createContext());

            expect(executeResult.success).toBe(false);
        });
    });

    // =========================================================================
    // SECURITY
    // =========================================================================
    describe('Security', () => {
        it('should isolate movements by organization', async () => {
            // Create movement in org1
            await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 10,
                type: MovementType.RECEIVE,
                reason: 'Org1 movement',
            }, createContext({ organizationId: org1 }));

            // Query from org2
            const org2Movements = await service.getMovements({}, createContext({ organizationId: org2 }));

            expect(org2Movements.items.length).toBe(0);
        });

        it('should prevent cross-org warehouse access', async () => {
            const result = await service.createMovement({
                warehouseId: 'warehouse-org2',
                sku: 'SKU-001',
                quantity: 10,
                type: MovementType.RECEIVE,
                reason: 'Cross org attempt',
            }, createContext({ organizationId: org1 }));

            expect(result.success).toBe(false);
        });

        it('should prevent cross-org transfer', async () => {
            const result = await service.createTransfer({
                sourceWarehouseId: warehouseA,
                targetWarehouseId: 'warehouse-org2',
                sku: 'SKU-001',
                quantity: 10,
                reason: 'Cross org transfer',
            }, createContext({ organizationId: org1 }));

            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // QUERY PERFORMANCE
    // =========================================================================
    describe('Query Performance', () => {
        it('should efficiently query large movement history', async () => {
            // Create multiple movements
            for (let i = 0; i < 100; i++) {
                movementDb.set(`perf-mov-${i}`, {
                    id: `perf-mov-${i}`,
                    organizationId: org1,
                    warehouseId: warehouseA,
                    sku: 'SKU-001',
                    quantity: 1,
                    type: MovementType.RECEIVE,
                    status: MovementStatus.COMPLETED,
                    createdAt: new Date(),
                });
            }

            const start = Date.now();
            const result = await service.getMovements({
                page: 1,
                pageSize: 20,
            }, createContext());
            const duration = Date.now() - start;

            expect(result.items.length).toBeLessThanOrEqual(20);
            expect(duration).toBeLessThan(500);
        });

        it('should efficiently filter by multiple criteria', async () => {
            const start = Date.now();
            await service.getMovements({
                warehouseId: warehouseA,
                type: MovementType.SHIP,
                status: MovementStatus.COMPLETED,
            }, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(200);
        });
    });

    // =========================================================================
    // HARDENING - DATABASE FAILURES
    // =========================================================================
    describe('Hardening: Database Failures', () => {
        it('should handle database failure on creation', async () => {
            prisma.stockMovement.create.mockRejectedValue(new Error('DB error'));

            await expect(
                service.createMovement({
                    warehouseId: warehouseA,
                    sku: 'SKU-001',
                    quantity: 10,
                    type: MovementType.RECEIVE,
                    reason: 'DB failure test',
                }, createContext())
            ).rejects.toThrow();
        });

        it('should handle database failure on execution', async () => {
            const createResult = await service.createMovement({
                warehouseId: warehouseA,
                sku: 'SKU-001',
                quantity: 10,
                type: MovementType.RECEIVE,
                reason: 'Execution failure test',
            }, createContext());

            prisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

            const executeResult = await service.executeMovement(createResult.movementId, createContext());

            expect(executeResult.success).toBe(false);
        });
    });

    // =========================================================================
    // HARDENING - CONCURRENT OPERATIONS
    // =========================================================================
    describe('Hardening: Concurrent Operations', () => {
        it('should handle concurrent movements to same SKU', async () => {
            const results = await Promise.all([
                service.createMovement({
                    warehouseId: warehouseA,
                    sku: 'SKU-001',
                    quantity: 10,
                    type: MovementType.RECEIVE,
                    reason: 'Concurrent 1',
                }, createContext()),
                service.createMovement({
                    warehouseId: warehouseA,
                    sku: 'SKU-001',
                    quantity: 15,
                    type: MovementType.RECEIVE,
                    reason: 'Concurrent 2',
                }, createContext()),
            ]);

            expect(results.every(r => r.success)).toBe(true);
        });

        it('should handle concurrent transfers', async () => {
            const results = await Promise.all([
                service.createTransfer({
                    sourceWarehouseId: warehouseA,
                    targetWarehouseId: warehouseB,
                    sku: 'SKU-001',
                    quantity: 10,
                    reason: 'Transfer 1',
                }, createContext()),
                service.createTransfer({
                    sourceWarehouseId: warehouseA,
                    targetWarehouseId: warehouseB,
                    sku: 'SKU-002',
                    quantity: 20,
                    reason: 'Transfer 2',
                }, createContext()),
            ]);

            expect(results.every(r => r.success)).toBe(true);
        });
    });
});
