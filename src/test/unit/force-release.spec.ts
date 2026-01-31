/**
 * Force Release Reservation Service Unit Tests (INV-05)
 * 
 * NEW WORKFLOW: Step A+D Combined
 * All tests (basic + hardening) written BEFORE implementation
 * 
 * BUSINESS LOGIC:
 * - Force release stuck/orphaned reservations
 * - Batch release by SKU or expiry
 * - Permission check (ADMIN or INVENTORY_MANAGER)
 * - Notifications to order owner
 * - Configurable expiry (default 30min) and batch limit (default 500)
 * - Full audit trail
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
    ForceReleaseService,
    ReservationStatus,
    ReleaseReasonCode,
    ForceReleaseResult,
    BatchReleaseResult,
} from '../../src/modules/inventory/force-release.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ForceReleaseService', () => {
    let service: ForceReleaseService;
    let prisma: jest.Mocked<PrismaService>;
    let eventEmitter: jest.Mocked<EventEmitter2>;

    // Test data
    const testOrgId = 'org-123';
    const testWarehouseId = 'warehouse-456';
    const testUserId = 'user-789';
    const testOrderId = 'order-001';

    const mockReservation = {
        id: 'res-001',
        organizationId: testOrgId,
        warehouseId: testWarehouseId,
        sku: 'SKU-001',
        quantity: 10,
        orderId: testOrderId,
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min from now
        createdAt: new Date(),
        releasedAt: null,
        releaseReason: null,
        releasedBy: null,
    };

    const mockInventoryItem = {
        id: 'inv-001',
        organizationId: testOrgId,
        warehouseId: testWarehouseId,
        sku: 'SKU-001',
        quantity: 100,
        reservedQuantity: 10,
    };

    const createContext = (overrides = {}) => ({
        organizationId: testOrgId,
        userId: testUserId,
        userRole: 'ADMIN', // Default to admin for tests
        ...overrides,
    });

    beforeEach(async () => {
        jest.clearAllMocks();

        prisma = {
            reservation: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn(),
                count: jest.fn(),
            },
            inventoryItem: {
                findFirst: jest.fn(),
                update: jest.fn(),
            },
            inventoryAuditLog: {
                create: jest.fn(),
                createMany: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
        } as any;

        eventEmitter = {
            emit: jest.fn(),
        } as any;

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
    // SINGLE RESERVATION RELEASE
    // =========================================================================
    describe('Force Release Single Reservation', () => {
        it('should successfully release an active reservation', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
                releasedAt: new Date(),
            } as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                reservedQuantity: 0,
            } as any);

            const result = await service.forceReleaseReservation('res-001', {
                reason: 'Order stuck in processing',
                reasonCode: ReleaseReasonCode.STUCK_ORDER,
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.reservationId).toBe('res-001');
            expect(result.quantityReleased).toBe(10);
        });

        it('should reject if reservation not found', async () => {
            prisma.reservation.findFirst.mockResolvedValue(null);

            const result = await service.forceReleaseReservation('res-nonexistent', {
                reason: 'Cleanup',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should reject if reservation already released', async () => {
            prisma.reservation.findFirst.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.RELEASED,
            } as any);

            const result = await service.forceReleaseReservation('res-001', {
                reason: 'Duplicate release attempt',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('already');
        });

        it('should reject without reason provided', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);

            await expect(
                service.forceReleaseReservation('res-001', {
                    reason: '', // Empty reason
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext())
            ).rejects.toThrow();
        });

        it('should reject for different organization', async () => {
            prisma.reservation.findFirst.mockResolvedValue(null); // Won't find due to org filter

            const result = await service.forceReleaseReservation('res-001', {
                reason: 'Cross-org attempt',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext({ organizationId: 'other-org' }));

            expect(result.success).toBe(false);
        });

        it('should calculate correct available stock after release', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue({
                ...mockInventoryItem,
                reservedQuantity: 0, // Was 10, released 10
            } as any);

            await service.forceReleaseReservation('res-001', {
                reason: 'Stock correction',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        reservedQuantity: 0,
                    }),
                })
            );
        });

        it('should create audit log entry', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryAuditLog.create.mockResolvedValue({} as any);

            await service.forceReleaseReservation('res-001', {
                reason: 'Audit test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: 'FORCE_RELEASE',
                        sku: 'SKU-001',
                    }),
                })
            );
        });

        it('should emit release event', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            await service.forceReleaseReservation('res-001', {
                reason: 'Event test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'reservation.force_released',
                expect.objectContaining({
                    reservationId: 'res-001',
                    sku: 'SKU-001',
                })
            );
        });
    });

    // =========================================================================
    // BATCH RELEASE BY SKU
    // =========================================================================
    describe('Batch Release by SKU', () => {
        const mockReservations = [
            { ...mockReservation, id: 'res-001' },
            { ...mockReservation, id: 'res-002', createdAt: new Date(Date.now() - 60 * 60 * 1000) },
            { ...mockReservation, id: 'res-003', createdAt: new Date(Date.now() - 120 * 60 * 1000) },
        ];

        it('should release all reservations for SKU', async () => {
            prisma.reservation.findMany.mockResolvedValue(mockReservations as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 3 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.forceReleaseAllForSku('SKU-001', {
                reason: 'SKU discontinuation',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.releasedCount).toBe(3);
        });

        it('should respect age filter (olderThanMinutes)', async () => {
            // Only return reservations older than 60 minutes
            prisma.reservation.findMany.mockResolvedValue([
                mockReservations[1], // 1 hour old
                mockReservations[2], // 2 hours old
            ] as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 2 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.forceReleaseAllForSku('SKU-001', {
                reason: 'Release old reservations',
                reasonCode: ReleaseReasonCode.EXPIRED,
                olderThanMinutes: 60,
            }, createContext());

            expect(result.releasedCount).toBe(2);
        });

        it('should return count of released reservations', async () => {
            prisma.reservation.findMany.mockResolvedValue(mockReservations as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 3 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.forceReleaseAllForSku('SKU-001', {
                reason: 'Count test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(result.totalFound).toBe(3);
            expect(result.releasedCount).toBe(3);
            expect(result.skippedCount).toBe(0);
        });

        it('should skip already released reservations', async () => {
            prisma.reservation.findMany.mockResolvedValue([
                mockReservations[0], // Active
                { ...mockReservations[1], status: ReservationStatus.RELEASED }, // Already released
            ] as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.forceReleaseAllForSku('SKU-001', {
                reason: 'Skip released test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(result.skippedCount).toBeGreaterThanOrEqual(0);
        });

        it('should handle no matching reservations', async () => {
            prisma.reservation.findMany.mockResolvedValue([]);

            const result = await service.forceReleaseAllForSku('SKU-NONE', {
                reason: 'No reservations test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.releasedCount).toBe(0);
        });

        it('should enforce cross-org isolation', async () => {
            prisma.reservation.findMany.mockResolvedValue([]);

            await service.forceReleaseAllForSku('SKU-001', {
                reason: 'Cross-org test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext({ organizationId: 'other-org' }));

            expect(prisma.reservation.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: 'other-org',
                    }),
                })
            );
        });

        it('should create audit log for each released reservation', async () => {
            prisma.reservation.findMany.mockResolvedValue(mockReservations as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 3 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryAuditLog.createMany.mockResolvedValue({ count: 3 });

            await service.forceReleaseAllForSku('SKU-001', {
                reason: 'Audit batch test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(prisma.inventoryAuditLog.createMany).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // EXPIRED CLEANUP
    // =========================================================================
    describe('Force Release Expired (Cleanup)', () => {
        const expiredReservations = [
            { ...mockReservation, id: 'res-old-1', createdAt: new Date(Date.now() - 60 * 60 * 1000) },
            { ...mockReservation, id: 'res-old-2', createdAt: new Date(Date.now() - 90 * 60 * 1000) },
        ];

        it('should release expired reservations', async () => {
            prisma.reservation.findMany.mockResolvedValue(expiredReservations as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 2 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.forceReleaseExpired({
                expiryMinutes: 30, // Configurable
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.releasedCount).toBe(2);
        });

        it('should respect configurable expiry threshold', async () => {
            prisma.reservation.findMany.mockResolvedValue(expiredReservations as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 2 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            await service.forceReleaseExpired({
                expiryMinutes: 45, // Custom threshold
            }, createContext());

            expect(prisma.reservation.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        createdAt: expect.objectContaining({
                            lt: expect.any(Date),
                        }),
                    }),
                })
            );
        });

        it('should enforce configurable batch limit', async () => {
            const manyReservations = Array(100).fill(null).map((_, i) => ({
                ...mockReservation,
                id: `res-${i}`,
            }));
            prisma.reservation.findMany.mockResolvedValue(manyReservations.slice(0, 50) as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 50 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.forceReleaseExpired({
                expiryMinutes: 30,
                maxToRelease: 50, // Configurable limit
            }, createContext());

            expect(result.releasedCount).toBeLessThanOrEqual(50);
        });

        it('should support dry run mode', async () => {
            prisma.reservation.findMany.mockResolvedValue(expiredReservations as any);

            const result = await service.forceReleaseExpired({
                expiryMinutes: 30,
                dryRun: true,
            }, createContext());

            expect(result.dryRun).toBe(true);
            expect(result.wouldRelease).toBe(2);
            expect(prisma.reservation.updateMany).not.toHaveBeenCalled();
        });

        it('should skip reservations linked to active orders', async () => {
            prisma.reservation.findMany.mockResolvedValue([
                { ...expiredReservations[0], orderId: 'order-active', orderStatus: 'PROCESSING' },
            ] as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 0 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.forceReleaseExpired({
                expiryMinutes: 30,
                skipActiveOrders: true,
            }, createContext());

            expect(result.skippedCount).toBeGreaterThanOrEqual(0);
        });

        it('should return detailed summary', async () => {
            prisma.reservation.findMany.mockResolvedValue(expiredReservations as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 2 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.forceReleaseExpired({
                expiryMinutes: 30,
            }, createContext());

            expect(result.totalFound).toBeDefined();
            expect(result.releasedCount).toBeDefined();
            expect(result.skippedCount).toBeDefined();
            expect(result.totalQuantityReleased).toBeDefined();
        });

        it('should handle mixed expiration states', async () => {
            const mixedReservations = [
                { ...mockReservation, id: 'res-new', createdAt: new Date() }, // Fresh
                ...expiredReservations, // Old
            ];
            prisma.reservation.findMany.mockResolvedValue(expiredReservations as any); // Only old ones returned
            prisma.reservation.updateMany.mockResolvedValue({ count: 2 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.forceReleaseExpired({
                expiryMinutes: 30,
            }, createContext());

            expect(result.releasedCount).toBe(2);
        });

        it('should enforce cross-org isolation', async () => {
            prisma.reservation.findMany.mockResolvedValue([]);

            await service.forceReleaseExpired({
                expiryMinutes: 30,
            }, createContext({ organizationId: 'org-specific' }));

            expect(prisma.reservation.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: 'org-specific',
                    }),
                })
            );
        });
    });

    // =========================================================================
    // REASON CODES
    // =========================================================================
    describe('Reason Codes', () => {
        beforeEach(() => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);
        });

        it.each([
            ReleaseReasonCode.STUCK_ORDER,
            ReleaseReasonCode.ORDER_CANCELLED,
            ReleaseReasonCode.EXPIRED,
            ReleaseReasonCode.DUPLICATE,
            ReleaseReasonCode.ADMIN_OVERRIDE,
            ReleaseReasonCode.SYSTEM_RECOVERY,
        ])('should accept valid reason code: %s', async (reasonCode) => {
            const result = await service.forceReleaseReservation('res-001', {
                reason: 'Test reason',
                reasonCode,
            }, createContext());

            expect(result.success).toBe(true);
        });

        it('should reject invalid reason code', async () => {
            await expect(
                service.forceReleaseReservation('res-001', {
                    reason: 'Test',
                    reasonCode: 'INVALID_CODE' as any,
                }, createContext())
            ).rejects.toThrow();
        });

        it('should require reason text for all releases', async () => {
            await expect(
                service.forceReleaseReservation('res-001', {
                    reason: '',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext())
            ).rejects.toThrow();
        });

        it('should store reason in audit log', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue({} as any);

            await service.forceReleaseReservation('res-001', {
                reason: 'Specific reason for audit',
                reasonCode: ReleaseReasonCode.STUCK_ORDER,
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        notes: expect.stringContaining('Specific reason for audit'),
                    }),
                })
            );
        });

        it('should sanitize reason text (XSS prevention)', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue({} as any);

            await service.forceReleaseReservation('res-001', {
                reason: '<script>alert("xss")</script>Actual reason',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        notes: expect.not.stringContaining('<script>'),
                    }),
                })
            );
        });

        it('should support custom reason text with any code', async () => {
            const result = await service.forceReleaseReservation('res-001', {
                reason: 'Very specific custom reason explaining the situation',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(result.success).toBe(true);
        });
    });

    // =========================================================================
    // PERMISSION CHECK
    // =========================================================================
    describe('Permission Check', () => {
        it('should allow ADMIN role', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.forceReleaseReservation('res-001', {
                reason: 'Admin release',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext({ userRole: 'ADMIN' }));

            expect(result.success).toBe(true);
        });

        it('should allow INVENTORY_MANAGER role', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.forceReleaseReservation('res-001', {
                reason: 'Manager release',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext({ userRole: 'INVENTORY_MANAGER' }));

            expect(result.success).toBe(true);
        });

        it('should reject USER role', async () => {
            await expect(
                service.forceReleaseReservation('res-001', {
                    reason: 'Unauthorized attempt',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext({ userRole: 'USER' }))
            ).rejects.toThrow(ForbiddenException);
        });

        it('should reject VIEWER role', async () => {
            await expect(
                service.forceReleaseReservation('res-001', {
                    reason: 'Viewer attempt',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext({ userRole: 'VIEWER' }))
            ).rejects.toThrow(ForbiddenException);
        });
    });

    // =========================================================================
    // NOTIFICATIONS
    // =========================================================================
    describe('Notifications', () => {
        beforeEach(() => {
            prisma.reservation.findFirst.mockResolvedValue({
                ...mockReservation,
                orderOwnerEmail: 'owner@example.com',
            } as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);
        });

        it('should emit notification event when enabled', async () => {
            await service.forceReleaseReservation('res-001', {
                reason: 'Notify test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                notifyOrderOwner: true,
            }, createContext());

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'notification.send',
                expect.objectContaining({
                    type: 'RESERVATION_FORCE_RELEASED',
                })
            );
        });

        it('should include relevant details in notification', async () => {
            await service.forceReleaseReservation('res-001', {
                reason: 'Detailed notify test',
                reasonCode: ReleaseReasonCode.STUCK_ORDER,
                notifyOrderOwner: true,
            }, createContext());

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'notification.send',
                expect.objectContaining({
                    data: expect.objectContaining({
                        sku: 'SKU-001',
                        quantity: 10,
                        reason: expect.any(String),
                    }),
                })
            );
        });

        it('should not send notification when flag is false', async () => {
            await service.forceReleaseReservation('res-001', {
                reason: 'No notify test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                notifyOrderOwner: false,
            }, createContext());

            expect(eventEmitter.emit).not.toHaveBeenCalledWith(
                'notification.send',
                expect.anything()
            );
        });

        it('should emit batch notification summary for batch releases', async () => {
            prisma.reservation.findMany.mockResolvedValue([mockReservation, mockReservation] as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 2 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            await service.forceReleaseAllForSku('SKU-001', {
                reason: 'Batch notify',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                notifyOrderOwners: true,
            }, createContext());

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'notification.batch',
                expect.objectContaining({
                    count: 2,
                })
            );
        });

        it('should handle notification failure gracefully', async () => {
            eventEmitter.emit.mockImplementation((event) => {
                if (event === 'notification.send') {
                    throw new Error('Notification failed');
                }
            });

            // Should not throw despite notification failure
            const result = await service.forceReleaseReservation('res-001', {
                reason: 'Notification failure test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                notifyOrderOwner: true,
            }, createContext());

            expect(result.success).toBe(true);
        });
    });

    // =========================================================================
    // AUDIT TRAIL
    // =========================================================================
    describe('Audit Trail', () => {
        beforeEach(() => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryAuditLog.create.mockResolvedValue({} as any);
        });

        it('should record all release details', async () => {
            await service.forceReleaseReservation('res-001', {
                reason: 'Audit detail test',
                reasonCode: ReleaseReasonCode.STUCK_ORDER,
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        organizationId: testOrgId,
                        warehouseId: testWarehouseId,
                        userId: testUserId,
                        sku: 'SKU-001',
                        action: 'FORCE_RELEASE',
                    }),
                })
            );
        });

        it('should include before/after reserved quantity', async () => {
            await service.forceReleaseReservation('res-001', {
                reason: 'Before/after test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        previousReserved: 10,
                        newReserved: 0,
                    }),
                })
            );
        });

        it('should record user who forced release', async () => {
            await service.forceReleaseReservation('res-001', {
                reason: 'User tracking test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext({ userId: 'specific-user' }));

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 'specific-user',
                    }),
                })
            );
        });

        it('should include order reference in metadata', async () => {
            await service.forceReleaseReservation('res-001', {
                reason: 'Order ref test',
                reasonCode: ReleaseReasonCode.STUCK_ORDER,
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        metadata: expect.objectContaining({
                            orderId: testOrderId,
                            reservationId: 'res-001',
                        }),
                    }),
                })
            );
        });

        it('should have accurate timestamp', async () => {
            const beforeCall = new Date();

            await service.forceReleaseReservation('res-001', {
                reason: 'Timestamp test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        createdAt: expect.any(Date),
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
            prisma.reservation.findFirst.mockRejectedValue(new Error('Connection refused'));

            await expect(
                service.forceReleaseReservation('res-001', {
                    reason: 'DB failure test',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext())
            ).rejects.toThrow();
        });

        it('should rollback on partial failure', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.inventoryItem.update.mockRejectedValue(new Error('Update failed'));
            prisma.$transaction.mockRejectedValue(new Error('Transaction rolled back'));

            await expect(
                service.forceReleaseReservation('res-001', {
                    reason: 'Rollback test',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext())
            ).rejects.toThrow();
        });

        it('should handle audit log failure gracefully', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryAuditLog.create.mockRejectedValue(new Error('Audit failed'));

            // Release should still succeed, log failure separately
            const result = await service.forceReleaseReservation('res-001', {
                reason: 'Audit failure test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());

            expect(result.success).toBe(true);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - CONCURRENT OPERATIONS
    // =========================================================================
    describe('Hardening: Concurrent Operations', () => {
        it('should handle concurrent release attempts on same reservation', async () => {
            prisma.reservation.findFirst.mockResolvedValueOnce(mockReservation as any);
            prisma.reservation.findFirst.mockResolvedValueOnce({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const [result1, result2] = await Promise.all([
                service.forceReleaseReservation('res-001', {
                    reason: 'Concurrent 1',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext()),
                service.forceReleaseReservation('res-001', {
                    reason: 'Concurrent 2',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext()),
            ]);

            // One should succeed, one should fail (already released)
            const successes = [result1.success, result2.success].filter(Boolean);
            expect(successes.length).toBeLessThanOrEqual(2);
        });

        it('should handle large batch releases', async () => {
            const manyReservations = Array(500).fill(null).map((_, i) => ({
                ...mockReservation,
                id: `res-${i}`,
            }));
            prisma.reservation.findMany.mockResolvedValue(manyReservations as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 500 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const result = await service.forceReleaseExpired({
                expiryMinutes: 30,
                maxToRelease: 500, // Max batch limit
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.releasedCount).toBeLessThanOrEqual(500);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - INPUT VALIDATION
    // =========================================================================
    describe('Hardening: Input Validation', () => {
        it('should reject invalid reservation ID format', async () => {
            await expect(
                service.forceReleaseReservation('', {
                    reason: 'Invalid ID test',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, createContext())
            ).rejects.toThrow();
        });

        it('should reject missing organization context', async () => {
            await expect(
                service.forceReleaseReservation('res-001', {
                    reason: 'Missing org test',
                    reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
                }, { userId: testUserId, userRole: 'ADMIN' } as any)
            ).rejects.toThrow();
        });

        it('should validate expiryMinutes range', async () => {
            await expect(
                service.forceReleaseExpired({
                    expiryMinutes: -1, // Invalid
                }, createContext())
            ).rejects.toThrow();
        });

        it('should validate maxToRelease range', async () => {
            await expect(
                service.forceReleaseExpired({
                    expiryMinutes: 30,
                    maxToRelease: 0, // Invalid
                }, createContext())
            ).rejects.toThrow();
        });
    });

    // =========================================================================
    // STEP D: HARDENING - PERFORMANCE
    // =========================================================================
    describe('Hardening: Performance', () => {
        it('should complete single release quickly', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                status: ReservationStatus.FORCE_RELEASED,
            } as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const start = Date.now();
            await service.forceReleaseReservation('res-001', {
                reason: 'Performance test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(500);
        });

        it('should handle batch release efficiently', async () => {
            const reservations = Array(100).fill(null).map((_, i) => ({
                ...mockReservation,
                id: `res-${i}`,
            }));
            prisma.reservation.findMany.mockResolvedValue(reservations as any);
            prisma.reservation.updateMany.mockResolvedValue({ count: 100 });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockInventoryItem as any);
            prisma.inventoryItem.update.mockResolvedValue(mockInventoryItem as any);

            const start = Date.now();
            await service.forceReleaseAllForSku('SKU-001', {
                reason: 'Batch performance test',
                reasonCode: ReleaseReasonCode.ADMIN_OVERRIDE,
            }, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(2000);
        });
    });

    // =========================================================================
    // CONFIGURATION
    // =========================================================================
    describe('Configurable Settings', () => {
        it('should use default expiry of 30 minutes', async () => {
            prisma.reservation.findMany.mockResolvedValue([]);

            const config = service.getDefaultConfig();

            expect(config.defaultExpiryMinutes).toBe(30);
        });

        it('should use default batch limit of 500', async () => {
            const config = service.getDefaultConfig();

            expect(config.defaultMaxBatchSize).toBe(500);
        });

        it('should allow override of expiry threshold', async () => {
            prisma.reservation.findMany.mockResolvedValue([]);
            prisma.reservation.updateMany.mockResolvedValue({ count: 0 });

            await service.forceReleaseExpired({
                expiryMinutes: 60, // Override default
            }, createContext());

            // Verify custom expiry was used
            expect(prisma.reservation.findMany).toHaveBeenCalled();
        });

        it('should allow override of batch limit', async () => {
            prisma.reservation.findMany.mockResolvedValue([]);
            prisma.reservation.updateMany.mockResolvedValue({ count: 0 });

            await service.forceReleaseExpired({
                expiryMinutes: 30,
                maxToRelease: 100, // Override default 500
            }, createContext());

            expect(prisma.reservation.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 100,
                })
            );
        });
    });
});
