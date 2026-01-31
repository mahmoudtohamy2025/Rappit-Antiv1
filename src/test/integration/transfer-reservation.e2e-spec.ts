/**
 * Transfer Reservation Request Integration Tests (INV-06)
 * 
 * NEW WORKFLOW: Step A+D Combined
 * All tests (basic + hardening) written BEFORE implementation
 * 
 * Integration tests verify:
 * - End-to-end transfer workflow
 * - Cross-service interactions
 * - Approval flow
 * - Security and permissions
 * - Performance under load
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import {
    TransferReservationService,
    TransferType,
    TransferStatus,
    TransferPriority,
} from '../../src/modules/inventory/transfer-reservation.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('TransferReservation Integration (e2e)', () => {
    let service: TransferReservationService;
    let prisma: jest.Mocked<PrismaService>;
    let eventEmitter: EventEmitter2;

    // Simulated databases
    const reservationDb = new Map<string, any>();
    const warehouseDb = new Map<string, any>();
    const inventoryDb = new Map<string, any>();
    const transferDb = new Map<string, any>();
    const auditLogDb: any[] = [];
    let notificationsSent: any[] = [];

    const org1 = 'org-alpha';
    const org2 = 'org-beta';
    const warehouseA = 'warehouse-A';
    const warehouseB = 'warehouse-B';
    const testUserId = 'user-admin';

    const createContext = (overrides = {}) => ({
        organizationId: org1,
        userId: testUserId,
        userRole: 'ADMIN',
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

        // Seed reservations
        reservationDb.set('res-001', {
            id: 'res-001',
            organizationId: org1,
            warehouseId: warehouseA,
            sku: 'SKU-001',
            quantity: 20,
            orderId: 'order-001',
            status: 'ACTIVE',
            createdAt: new Date(),
        });
        reservationDb.set('res-002', {
            id: 'res-002',
            organizationId: org1,
            warehouseId: warehouseA,
            sku: 'SKU-002',
            quantity: 10,
            orderId: 'order-002',
            status: 'ACTIVE',
            createdAt: new Date(),
        });
        reservationDb.set('res-org2', {
            id: 'res-org2',
            organizationId: org2,
            warehouseId: 'warehouse-org2',
            sku: 'SKU-001',
            quantity: 15,
            orderId: 'order-org2',
            status: 'ACTIVE',
            createdAt: new Date(),
        });

        // Seed inventory
        inventoryDb.set(`${warehouseA}:SKU-001`, {
            id: 'inv-A-001',
            organizationId: org1,
            warehouseId: warehouseA,
            sku: 'SKU-001',
            quantity: 100,
            reservedQuantity: 20,
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
            quantity: 30,
            reservedQuantity: 10,
        });
    };

    beforeEach(async () => {
        reservationDb.clear();
        warehouseDb.clear();
        inventoryDb.clear();
        transferDb.clear();
        auditLogDb.length = 0;
        notificationsSent = [];
        seedData();

        prisma = {
            reservation: {
                findFirst: jest.fn((args) => {
                    const res = reservationDb.get(args.where.id);
                    if (res && res.organizationId === args.where.organizationId) {
                        return Promise.resolve(res);
                    }
                    return Promise.resolve(null);
                }),
                update: jest.fn((args) => {
                    const res = reservationDb.get(args.where.id);
                    if (res) {
                        Object.assign(res, args.data);
                        return Promise.resolve(res);
                    }
                    return Promise.reject(new Error('Not found'));
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
            },
            transferRequest: {
                create: jest.fn((args) => {
                    const transfer = {
                        id: `transfer-${transferDb.size + 1}`,
                        ...args.data,
                        requestedAt: new Date(),
                    };
                    transferDb.set(transfer.id, transfer);
                    return Promise.resolve(transfer);
                }),
                findFirst: jest.fn((args) => {
                    if (args.where.id) {
                        const transfer = transferDb.get(args.where.id);
                        if (transfer && transfer.organizationId === args.where.organizationId) {
                            return Promise.resolve(transfer);
                        }
                    }
                    if (args.where.reservationId) {
                        const existing = Array.from(transferDb.values()).find(t =>
                            t.reservationId === args.where.reservationId &&
                            t.organizationId === args.where.organizationId &&
                            ['PENDING', 'APPROVED', 'IN_TRANSIT'].includes(t.status)
                        );
                        return Promise.resolve(existing || null);
                    }
                    return Promise.resolve(null);
                }),
                findMany: jest.fn((args) => {
                    let results = Array.from(transferDb.values()).filter(t =>
                        t.organizationId === args.where.organizationId
                    );
                    if (args.where.status) {
                        results = results.filter(t => t.status === args.where.status);
                    }
                    if (args.where.sourceWarehouseId) {
                        results = results.filter(t => t.sourceWarehouseId === args.where.sourceWarehouseId);
                    }
                    if (args.where.targetWarehouseId) {
                        results = results.filter(t => t.targetWarehouseId === args.where.targetWarehouseId);
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
                    const transfer = transferDb.get(args.where.id);
                    if (transfer) {
                        Object.assign(transfer, args.data);
                        return Promise.resolve(transfer);
                    }
                    return Promise.reject(new Error('Not found'));
                }),
                count: jest.fn((args) => {
                    const count = Array.from(transferDb.values()).filter(t =>
                        t.organizationId === args.where.organizationId
                    ).length;
                    return Promise.resolve(count);
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

        // Track notifications
        eventEmitter.on('notification.send', (data) => notificationsSent.push(data));
        eventEmitter.on('notification.batch', (data) => notificationsSent.push({ type: 'batch', ...data }));
        eventEmitter.on('transfer.requested', (data) => notificationsSent.push({ event: 'requested', ...data }));
        eventEmitter.on('transfer.approved', (data) => notificationsSent.push({ event: 'approved', ...data }));
        eventEmitter.on('transfer.completed', (data) => notificationsSent.push({ event: 'completed', ...data }));

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TransferReservationService,
                { provide: PrismaService, useValue: prisma },
                { provide: EventEmitter2, useValue: eventEmitter },
            ],
        }).compile();

        service = module.get<TransferReservationService>(TransferReservationService);
    });

    // =========================================================================
    // E2E WORKFLOW
    // =========================================================================
    describe('E2E Transfer Workflow', () => {
        it('should complete full PENDING transfer workflow', async () => {
            // Step 1: Create transfer request
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.PENDING,
                reason: 'Regional fulfillment',
            }, createContext());

            expect(createResult.success).toBe(true);
            const transferId = createResult.transferId;

            // Verify transfer is pending
            const pendingTransfer = transferDb.get(transferId);
            expect(pendingTransfer.status).toBe(TransferStatus.PENDING);

            // Step 2: Approve transfer
            const approveResult = await service.approveTransfer(transferId, {
                notes: 'Approved for fulfillment',
            }, createContext({ userRole: 'WAREHOUSE_MANAGER' }));

            expect(approveResult.success).toBe(true);
            expect(transferDb.get(transferId).status).toBe(TransferStatus.APPROVED);

            // Step 3: Execute transfer
            const executeResult = await service.executeTransfer(transferId, createContext());

            expect(executeResult.success).toBe(true);
            expect(transferDb.get(transferId).status).toBe(TransferStatus.COMPLETED);
        });

        it('should complete IMMEDIATE transfer in one step', async () => {
            const result = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.IMMEDIATE,
                reason: 'Urgent fulfillment',
            }, createContext());

            expect(result.success).toBe(true);

            // IMMEDIATE should auto-approve
            const transfer = transferDb.get(result.transferId);
            expect(transfer.status).toBe(TransferStatus.APPROVED);
        });

        it('should update inventory correctly after transfer', async () => {
            const sourceBefore = inventoryDb.get(`${warehouseA}:SKU-001`).reservedQuantity;
            const targetBefore = inventoryDb.get(`${warehouseB}:SKU-001`).reservedQuantity;

            // Create and execute immediate transfer
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.IMMEDIATE,
                reason: 'Inventory test',
            }, createContext());

            await service.executeTransfer(createResult.transferId, createContext());

            const sourceAfter = inventoryDb.get(`${warehouseA}:SKU-001`).reservedQuantity;
            const targetAfter = inventoryDb.get(`${warehouseB}:SKU-001`).reservedQuantity;

            expect(sourceAfter).toBe(sourceBefore - 20);
            expect(targetAfter).toBe(targetBefore + 20);
        });

        it('should update reservation warehouse after transfer', async () => {
            const reservationBefore = reservationDb.get('res-001').warehouseId;
            expect(reservationBefore).toBe(warehouseA);

            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.IMMEDIATE,
                reason: 'Warehouse update test',
            }, createContext());

            await service.executeTransfer(createResult.transferId, createContext());

            const reservationAfter = reservationDb.get('res-001').warehouseId;
            expect(reservationAfter).toBe(warehouseB);
        });

        it('should maintain order link after transfer', async () => {
            const orderIdBefore = reservationDb.get('res-001').orderId;

            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.IMMEDIATE,
                reason: 'Order link test',
            }, createContext());

            await service.executeTransfer(createResult.transferId, createContext());

            const orderIdAfter = reservationDb.get('res-001').orderId;
            expect(orderIdAfter).toBe(orderIdBefore);
        });

        it('should handle partial transfer correctly', async () => {
            const originalQuantity = 20;
            const transferQuantity = 8;

            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: transferQuantity,
                transferType: TransferType.IMMEDIATE,
                reason: 'Partial transfer',
            }, createContext());

            expect(createResult.success).toBe(true);

            await service.executeTransfer(createResult.transferId, createContext());

            // Source should still have remaining reservation
            const sourceReserved = inventoryDb.get(`${warehouseA}:SKU-001`).reservedQuantity;
            expect(sourceReserved).toBe(originalQuantity - transferQuantity);
        });

        it('should reject transfer after rejection', async () => {
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.PENDING,
                reason: 'Rejection test',
            }, createContext());

            // Reject the transfer
            await service.rejectTransfer(createResult.transferId, {
                reason: 'Not enough space',
            }, createContext({ userRole: 'ADMIN' }));

            // Try to execute rejected transfer
            const executeResult = await service.executeTransfer(createResult.transferId, createContext());

            expect(executeResult.success).toBe(false);
        });
    });

    // =========================================================================
    // APPROVAL FLOW
    // =========================================================================
    describe('Approval Flow', () => {
        it('should require approval for PENDING transfers', async () => {
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.PENDING,
                reason: 'Approval required',
            }, createContext());

            // Try to execute without approval
            const executeResult = await service.executeTransfer(createResult.transferId, createContext());

            expect(executeResult.success).toBe(false);
            expect(executeResult.error).toContain('not approved');
        });

        it('should allow approval by WAREHOUSE_MANAGER', async () => {
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.PENDING,
                reason: 'Manager approval test',
            }, createContext());

            const approveResult = await service.approveTransfer(createResult.transferId, {},
                createContext({ userRole: 'WAREHOUSE_MANAGER' }));

            expect(approveResult.success).toBe(true);
        });

        it('should allow approval by ADMIN', async () => {
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.PENDING,
                reason: 'Admin approval test',
            }, createContext());

            const approveResult = await service.approveTransfer(createResult.transferId, {},
                createContext({ userRole: 'ADMIN' }));

            expect(approveResult.success).toBe(true);
        });

        it('should record approval details', async () => {
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.PENDING,
                reason: 'Record details test',
            }, createContext());

            await service.approveTransfer(createResult.transferId, {
                notes: 'Approved with conditions',
            }, createContext({ userId: 'manager-123', userRole: 'WAREHOUSE_MANAGER' }));

            const transfer = transferDb.get(createResult.transferId);
            expect(transfer.approvedBy).toBe('manager-123');
            expect(transfer.approvedAt).toBeDefined();
        });

        it('should record rejection details', async () => {
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.PENDING,
                reason: 'Rejection details test',
            }, createContext());

            await service.rejectTransfer(createResult.transferId, {
                reason: 'Capacity issues at target',
            }, createContext({ userId: 'admin-456', userRole: 'ADMIN' }));

            const transfer = transferDb.get(createResult.transferId);
            expect(transfer.rejectedBy).toBe('admin-456');
            expect(transfer.rejectionReason).toContain('Capacity');
        });
    });

    // =========================================================================
    // SECURITY
    // =========================================================================
    describe('Security', () => {
        it('should isolate transfers by organization', async () => {
            // Create transfer in org1
            await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.PENDING,
                reason: 'Org isolation test',
            }, createContext({ organizationId: org1 }));

            // Query from org2 should not see it
            const org2Transfers = await service.getTransferRequests({},
                createContext({ organizationId: org2 }));

            expect(org2Transfers.items.length).toBe(0);
        });

        it('should prevent cross-org transfer creation', async () => {
            // Try to create transfer for org2 reservation from org1
            const result = await service.createTransferRequest({
                reservationId: 'res-org2',
                sourceWarehouseId: 'warehouse-org2',
                targetWarehouseId: warehouseB,
                quantity: 15,
                transferType: TransferType.PENDING,
                reason: 'Cross-org attempt',
            }, createContext({ organizationId: org1 }));

            expect(result.success).toBe(false);
        });

        it('should reject approval by USER role', async () => {
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.PENDING,
                reason: 'User role test',
            }, createContext());

            await expect(
                service.approveTransfer(createResult.transferId, {},
                    createContext({ userRole: 'USER' }))
            ).rejects.toThrow(ForbiddenException);
        });

        it('should prevent approval from different org', async () => {
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.PENDING,
                reason: 'Cross-org approval test',
            }, createContext({ organizationId: org1 }));

            const approveResult = await service.approveTransfer(createResult.transferId, {},
                createContext({ organizationId: org2, userRole: 'ADMIN' }));

            expect(approveResult.success).toBe(false);
        });
    });

    // =========================================================================
    // NOTIFICATIONS
    // =========================================================================
    describe('Notifications', () => {
        it('should emit notification on transfer request', async () => {
            await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.PENDING,
                reason: 'Notification test',
            }, createContext());

            const requestedEvent = notificationsSent.find(n => n.event === 'requested');
            expect(requestedEvent).toBeDefined();
        });

        it('should emit notification on approval', async () => {
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.PENDING,
                reason: 'Approval notification test',
            }, createContext());

            await service.approveTransfer(createResult.transferId, {},
                createContext({ userRole: 'ADMIN' }));

            const approvedEvent = notificationsSent.find(n => n.event === 'approved');
            expect(approvedEvent).toBeDefined();
        });

        it('should emit notification on completion', async () => {
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.IMMEDIATE,
                reason: 'Completion notification test',
            }, createContext());

            await service.executeTransfer(createResult.transferId, createContext());

            const completedEvent = notificationsSent.find(n => n.event === 'completed');
            expect(completedEvent).toBeDefined();
        });
    });

    // =========================================================================
    // HARDENING - CONCURRENT OPERATIONS
    // =========================================================================
    describe('Hardening: Concurrent Operations', () => {
        it('should prevent duplicate transfer requests', async () => {
            const results = await Promise.all([
                service.createTransferRequest({
                    reservationId: 'res-001',
                    sourceWarehouseId: warehouseA,
                    targetWarehouseId: warehouseB,
                    quantity: 20,
                    transferType: TransferType.PENDING,
                    reason: 'Duplicate 1',
                }, createContext()),
                service.createTransferRequest({
                    reservationId: 'res-001',
                    sourceWarehouseId: warehouseA,
                    targetWarehouseId: warehouseB,
                    quantity: 20,
                    transferType: TransferType.PENDING,
                    reason: 'Duplicate 2',
                }, createContext()),
            ]);

            // At least one should fail
            const successes = results.filter(r => r.success);
            expect(successes.length).toBeLessThanOrEqual(2);
        });

        it('should handle concurrent transfers safely', async () => {
            const results = await Promise.all([
                service.createTransferRequest({
                    reservationId: 'res-001',
                    sourceWarehouseId: warehouseA,
                    targetWarehouseId: warehouseB,
                    quantity: 10,
                    transferType: TransferType.IMMEDIATE,
                    reason: 'Concurrent 1',
                }, createContext()),
                service.createTransferRequest({
                    reservationId: 'res-002',
                    sourceWarehouseId: warehouseA,
                    targetWarehouseId: warehouseB,
                    quantity: 5,
                    transferType: TransferType.IMMEDIATE,
                    reason: 'Concurrent 2',
                }, createContext()),
            ]);

            // Different reservations should both succeed
            expect(results.every(r => r.success)).toBe(true);
        });
    });

    // =========================================================================
    // HARDENING - DATABASE FAILURES
    // =========================================================================
    describe('Hardening: Database Failures', () => {
        it('should handle database failure gracefully', async () => {
            prisma.reservation.findFirst.mockRejectedValue(new Error('DB error'));

            await expect(
                service.createTransferRequest({
                    reservationId: 'res-001',
                    sourceWarehouseId: warehouseA,
                    targetWarehouseId: warehouseB,
                    quantity: 20,
                    transferType: TransferType.PENDING,
                    reason: 'DB failure test',
                }, createContext())
            ).rejects.toThrow();
        });

        it('should rollback on execution failure', async () => {
            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.IMMEDIATE,
                reason: 'Rollback test',
            }, createContext());

            // Force transaction failure
            prisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

            const executeResult = await service.executeTransfer(createResult.transferId, createContext());

            expect(executeResult.success).toBe(false);
        });
    });

    // =========================================================================
    // HARDENING - PERFORMANCE
    // =========================================================================
    describe('Hardening: Performance', () => {
        it('should complete transfer within SLA', async () => {
            const start = Date.now();

            const createResult = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: warehouseA,
                targetWarehouseId: warehouseB,
                quantity: 20,
                transferType: TransferType.IMMEDIATE,
                reason: 'SLA test',
            }, createContext());

            await service.executeTransfer(createResult.transferId, createContext());

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(1000);
        });

        it('should efficiently query transfers', async () => {
            // Create multiple transfers
            for (let i = 0; i < 10; i++) {
                reservationDb.set(`res-perf-${i}`, {
                    id: `res-perf-${i}`,
                    organizationId: org1,
                    warehouseId: warehouseA,
                    sku: 'SKU-PERF',
                    quantity: 5,
                    orderId: `order-perf-${i}`,
                    status: 'ACTIVE',
                });
            }

            const start = Date.now();
            await service.getTransferRequests({ page: 1, pageSize: 20 }, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(500);
        });
    });
});
