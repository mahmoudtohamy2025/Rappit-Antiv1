/**
 * Force Release Reservation Integration Tests (INV-05)
 * 
 * NEW WORKFLOW: Step A+D Combined
 * All tests (basic + hardening) written BEFORE implementation
 * 
 * Integration tests verify:
 * - End-to-end release workflow
 * - Cross-service interactions
 * - Cleanup job functionality
 * - Security and permissions
 * - Performance under load
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import {
    ForceReleaseService,
    ReservationStatus,
    ReleaseReasonCode,
} from '../../src/modules/inventory/force-release.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ForceRelease Integration (e2e)', () => {
    let service: ForceReleaseService;
    let prisma: jest.Mocked<PrismaService>;
    let eventEmitter: EventEmitter2;

    // Simulated database
    const reservationDb = new Map<string, any>();
    const inventoryDb = new Map<string, any>();
    const auditLogDb: any[] = [];
    let notificationsSent: any[] = [];

    const org1 = 'org-alpha';
    const org2 = 'org-beta';
    const testWarehouseId = 'wh-main';
    const testUserId = 'user-admin';

    const createContext = (overrides = {}) => ({
        organizationId: org1,
        userId: testUserId,
        userRole: 'ADMIN',
        ...overrides,
    });

    const seedData = () => {
        // Seed reservations
        const now = new Date();

        // Active reservation (recent)
        reservationDb.set('res-active-1', {
            id: 'res-active-1',
            organizationId: org1,
            warehouseId: testWarehouseId,
            sku: 'SKU-001',
            quantity: 10,
            orderId: 'order-001',
            status: ReservationStatus.ACTIVE,
            createdAt: new Date(now.getTime() - 5 * 60 * 1000), // 5 min ago
        });

        // Active reservation (old - expired)
        reservationDb.set('res-expired-1', {
            id: 'res-expired-1',
            organizationId: org1,
            warehouseId: testWarehouseId,
            sku: 'SKU-001',
            quantity: 5,
            orderId: 'order-002',
            status: ReservationStatus.ACTIVE,
            createdAt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
        });

        // Already released
        reservationDb.set('res-released-1', {
            id: 'res-released-1',
            organizationId: org1,
            warehouseId: testWarehouseId,
            sku: 'SKU-001',
            quantity: 3,
            orderId: 'order-003',
            status: ReservationStatus.RELEASED,
            createdAt: new Date(now.getTime() - 120 * 60 * 1000),
            releasedAt: new Date(),
        });

        // Different org
        reservationDb.set('res-org2-1', {
            id: 'res-org2-1',
            organizationId: org2,
            warehouseId: testWarehouseId,
            sku: 'SKU-001',
            quantity: 20,
            orderId: 'order-org2',
            status: ReservationStatus.ACTIVE,
            createdAt: new Date(now.getTime() - 30 * 60 * 1000),
        });

        // Seed inventory
        inventoryDb.set(`${org1}:SKU-001`, {
            id: 'inv-001',
            organizationId: org1,
            warehouseId: testWarehouseId,
            sku: 'SKU-001',
            quantity: 100,
            reservedQuantity: 18, // Sum of active reservations
        });

        inventoryDb.set(`${org2}:SKU-001`, {
            id: 'inv-002',
            organizationId: org2,
            warehouseId: testWarehouseId,
            sku: 'SKU-001',
            quantity: 50,
            reservedQuantity: 20,
        });
    };

    beforeEach(async () => {
        reservationDb.clear();
        inventoryDb.clear();
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
                findMany: jest.fn((args) => {
                    let results = Array.from(reservationDb.values()).filter(r =>
                        r.organizationId === args.where.organizationId &&
                        r.status === ReservationStatus.ACTIVE
                    );
                    if (args.where.sku) {
                        results = results.filter(r => r.sku === args.where.sku);
                    }
                    if (args.where.createdAt?.lt) {
                        results = results.filter(r => r.createdAt < args.where.createdAt.lt);
                    }
                    if (args.take) {
                        results = results.slice(0, args.take);
                    }
                    return Promise.resolve(results);
                }),
                update: jest.fn((args) => {
                    const res = reservationDb.get(args.where.id);
                    if (res) {
                        Object.assign(res, args.data);
                        return Promise.resolve(res);
                    }
                    return Promise.reject(new Error('Not found'));
                }),
                updateMany: jest.fn((args) => {
                    let count = 0;
                    const idsToUpdate = args.where.id?.in || [];
                    reservationDb.forEach((res) => {
                        // Only update if id matches the filter (if provided) and org matches
                        const idMatch = idsToUpdate.length === 0 || idsToUpdate.includes(res.id);
                        if (res.organizationId === args.where.organizationId &&
                            res.status === ReservationStatus.ACTIVE &&
                            idMatch) {
                            res.status = args.data.status;
                            res.releasedAt = args.data.releasedAt;
                            count++;
                        }
                    });
                    return Promise.resolve({ count });
                }),
                count: jest.fn((args) => {
                    const count = Array.from(reservationDb.values()).filter(r =>
                        r.organizationId === args.where.organizationId &&
                        r.status === ReservationStatus.ACTIVE
                    ).length;
                    return Promise.resolve(count);
                }),
            },
            inventoryItem: {
                findFirst: jest.fn((args) => {
                    const key = `${args.where.organizationId}:${args.where.sku}`;
                    return Promise.resolve(inventoryDb.get(key) || null);
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
            inventoryAuditLog: {
                create: jest.fn((args) => {
                    const entry = { id: `audit-${auditLogDb.length + 1}`, ...args.data };
                    auditLogDb.push(entry);
                    return Promise.resolve(entry);
                }),
                createMany: jest.fn((args) => {
                    args.data.forEach((d: any) => {
                        auditLogDb.push({ id: `audit-${auditLogDb.length + 1}`, ...d });
                    });
                    return Promise.resolve({ count: args.data.length });
                }),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
        } as any;

        eventEmitter = new EventEmitter2();

        // Track notifications
        eventEmitter.on('notification.send', (data) => {
            notificationsSent.push(data);
        });
        eventEmitter.on('notification.batch', (data) => {
            notificationsSent.push({ type: 'batch', ...data });
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ForceReleaseService,
                { provide: PrismaService, useValue: prisma },
                { provide: EventEmitter2, useValue: eventEmitter },
            ],
        }).compile();

        service = module.get<ForceReleaseService>(ForceReleaseService);
    });

    // =========================================================================
    // E2E WORKFLOW
    // =========================================================================
    describe('E2E Release Workflow', () => {
        it('should complete full single release workflow', async () => {
            const result = await service.forceReleaseReservation('res-active-1', {
                reason: 'Order stuck in processing',
                reasonCode: ReleaseReasonCode.STUCK_ORDER,
                notifyOrderOwner: true,
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.quantityReleased).toBe(10);

            // Verify reservation updated
            const res = reservationDb.get('res-active-1');
            expect(res.status).toBe(ReservationStatus.FORCE_RELEASED);

            // Verify audit log created
            expect(auditLogDb.length).toBe(1);
            expect(auditLogDb[0].action).toBe('FORCE_RELEASE');
        });

        it('should complete full batch release workflow', async () => {
            const result = await service.forceReleaseAllForSku('SKU-001', {
                reason: 'SKU discontinued',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.releasedCount).toBeGreaterThan(0);
        });

        it('should complete full cleanup workflow', async () => {
            const result = await service.forceReleaseExpired({
                expiryMinutes: 30, // Configurable
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.releasedCount).toBeGreaterThan(0);
        });

        it('should update inventory reserved quantity correctly', async () => {
            const beforeItem = inventoryDb.get(`${org1}:SKU-001`);
            const beforeReserved = beforeItem.reservedQuantity;

            await service.forceReleaseReservation('res-active-1', {
                reason: 'Stock test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            // Reserved should decrease by released quantity
            expect(beforeItem.reservedQuantity).toBeLessThan(beforeReserved);
        });

        it('should handle rerelease of same reservation gracefully', async () => {
            // First release
            const result1 = await service.forceReleaseReservation('res-active-1', {
                reason: 'First release',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());
            expect(result1.success).toBe(true);

            // Second release attempt
            const result2 = await service.forceReleaseReservation('res-active-1', {
                reason: 'Second release attempt',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());
            expect(result2.success).toBe(false);
            expect(result2.error).toContain('already');
        });
    });

    // =========================================================================
    // CROSS-SERVICE INTEGRATION
    // =========================================================================
    describe('Cross-Service Integration', () => {
        it('should emit events for downstream services', async () => {
            const events: any[] = [];
            eventEmitter.on('reservation.force_released', (data) => events.push(data));

            await service.forceReleaseReservation('res-active-1', {
                reason: 'Event test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(events.length).toBe(1);
            expect(events[0].sku).toBe('SKU-001');
            expect(events[0].quantityReleased).toBe(10);
        });

        it('should send notification to order owner', async () => {
            await service.forceReleaseReservation('res-active-1', {
                reason: 'Notification test',
                reasonCode: ReleaseReasonCode.STUCK_ORDER,
                notifyOrderOwner: true,
            }, createContext());

            expect(notificationsSent.length).toBeGreaterThan(0);
        });

        it('should update audit trail correctly', async () => {
            await service.forceReleaseReservation('res-active-1', {
                reason: 'Audit integration test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(auditLogDb.length).toBe(1);
            expect(auditLogDb[0].sku).toBe('SKU-001');
            expect(auditLogDb[0].userId).toBe(testUserId);
        });

        it('should maintain data consistency across operations', async () => {
            const initialInventory = inventoryDb.get(`${org1}:SKU-001`);
            const initialReserved = initialInventory.reservedQuantity;

            await service.forceReleaseReservation('res-active-1', {
                reason: 'Consistency test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            // Reservation marked as released
            expect(reservationDb.get('res-active-1').status).toBe(ReservationStatus.FORCE_RELEASED);

            // Reserved quantity decreased
            expect(initialInventory.reservedQuantity).toBe(initialReserved - 10);

            // Audit log created
            expect(auditLogDb.length).toBe(1);
        });
    });

    // =========================================================================
    // CLEANUP JOB SCENARIOS
    // =========================================================================
    describe('Cleanup Job Scenarios', () => {
        it('should release only expired reservations', async () => {
            const result = await service.forceReleaseExpired({
                expiryMinutes: 30,
            }, createContext());

            // Only the 1-hour old reservation should be released
            expect(result.releasedCount).toBe(1);
            expect(reservationDb.get('res-expired-1').status).toBe(ReservationStatus.FORCE_RELEASED);
            expect(reservationDb.get('res-active-1').status).toBe(ReservationStatus.ACTIVE);
        });

        it('should preview with dry run', async () => {
            const result = await service.forceReleaseExpired({
                expiryMinutes: 30,
                dryRun: true,
            }, createContext());

            expect(result.dryRun).toBe(true);
            expect(result.wouldRelease).toBeGreaterThan(0);

            // Nothing actually released
            expect(reservationDb.get('res-expired-1').status).toBe(ReservationStatus.ACTIVE);
        });

        it('should respect batch limit', async () => {
            // Add more expired reservations
            for (let i = 0; i < 10; i++) {
                reservationDb.set(`res-expired-${i + 10}`, {
                    id: `res-expired-${i + 10}`,
                    organizationId: org1,
                    warehouseId: testWarehouseId,
                    sku: 'SKU-002',
                    quantity: 1,
                    status: ReservationStatus.ACTIVE,
                    createdAt: new Date(Date.now() - 120 * 60 * 1000),
                });
            }

            const result = await service.forceReleaseExpired({
                expiryMinutes: 30,
                maxToRelease: 5, // Limit to 5
            }, createContext());

            expect(result.releasedCount).toBeLessThanOrEqual(5);
        });

        it('should use configurable expiry threshold', async () => {
            // Create reservation that's 45 minutes old
            reservationDb.set('res-45min', {
                id: 'res-45min',
                organizationId: org1,
                warehouseId: testWarehouseId,
                sku: 'SKU-001',
                quantity: 2,
                status: ReservationStatus.ACTIVE,
                createdAt: new Date(Date.now() - 45 * 60 * 1000),
            });

            // With 30 min threshold, should be released
            const result30 = await service.forceReleaseExpired({
                expiryMinutes: 30,
            }, createContext());

            expect(result30.releasedCount).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // SECURITY
    // =========================================================================
    describe('Security', () => {
        it('should enforce ADMIN permission', async () => {
            const result = await service.forceReleaseReservation('res-active-1', {
                reason: 'Admin test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext({ userRole: 'ADMIN' }));

            expect(result.success).toBe(true);
        });

        it('should enforce INVENTORY_MANAGER permission', async () => {
            const result = await service.forceReleaseReservation('res-active-1', {
                reason: 'Manager test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext({ userRole: 'INVENTORY_MANAGER' }));

            expect(result.success).toBe(true);
        });

        it('should reject unauthorized role', async () => {
            await expect(
                service.forceReleaseReservation('res-active-1', {
                    reason: 'Unauthorized test',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext({ userRole: 'USER' }))
            ).rejects.toThrow(ForbiddenException);
        });

        it('should isolate organizations', async () => {
            // Try to release org2's reservation from org1 context
            const result = await service.forceReleaseReservation('res-org2-1', {
                reason: 'Cross-org attempt',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext({ organizationId: org1 }));

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should not leak cross-org data in batch operations', async () => {
            const result = await service.forceReleaseAllForSku('SKU-001', {
                reason: 'Batch isolation test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext({ organizationId: org1 }));

            // Should only release org1 reservations
            expect(reservationDb.get('res-org2-1').status).toBe(ReservationStatus.ACTIVE);
        });
    });

    // =========================================================================
    // HARDENING - CONCURRENT OPERATIONS
    // =========================================================================
    describe('Hardening: Concurrent Operations', () => {
        it('should handle concurrent releases safely', async () => {
            const results = await Promise.all([
                service.forceReleaseReservation('res-active-1', {
                    reason: 'Concurrent 1',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext()),
                service.forceReleaseReservation('res-expired-1', {
                    reason: 'Concurrent 2',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext()),
            ]);

            // Both should complete
            expect(results.every(r => r !== undefined)).toBe(true);
        });

        it('should handle concurrent cleanup jobs', async () => {
            const results = await Promise.all([
                service.forceReleaseExpired({ expiryMinutes: 30 }, createContext()),
                service.forceReleaseExpired({ expiryMinutes: 60 }, createContext()),
            ]);

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
                service.forceReleaseReservation('res-active-1', {
                    reason: 'DB failure test',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext())
            ).rejects.toThrow();
        });

        it('should handle update failure with rollback', async () => {
            prisma.reservation.update.mockRejectedValue(new Error('Update failed'));
            prisma.$transaction.mockRejectedValue(new Error('Transaction rolled back'));

            await expect(
                service.forceReleaseReservation('res-active-1', {
                    reason: 'Rollback test',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext())
            ).rejects.toThrow();
        });
    });

    // =========================================================================
    // HARDENING - PERFORMANCE
    // =========================================================================
    describe('Hardening: Performance', () => {
        it('should handle large number of reservations efficiently', async () => {
            // Add 200 expired reservations
            for (let i = 0; i < 200; i++) {
                reservationDb.set(`res-perf-${i}`, {
                    id: `res-perf-${i}`,
                    organizationId: org1,
                    warehouseId: testWarehouseId,
                    sku: 'SKU-PERF',
                    quantity: 1,
                    status: ReservationStatus.ACTIVE,
                    createdAt: new Date(Date.now() - 120 * 60 * 1000),
                });
            }

            const start = Date.now();
            await service.forceReleaseExpired({
                expiryMinutes: 30,
                maxToRelease: 500, // Configurable batch limit
            }, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(5000);
        });

        it('should complete single release within SLA', async () => {
            const start = Date.now();
            await service.forceReleaseReservation('res-active-1', {
                reason: 'SLA test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(500);
        });
    });
});
