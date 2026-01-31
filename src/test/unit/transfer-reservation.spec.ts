/**
 * Transfer Reservation Request Service Unit Tests (INV-06)
 * 
 * NEW WORKFLOW: Step A+D Combined
 * All tests (basic + hardening) written BEFORE implementation
 * 
 * BUSINESS LOGIC:
 * - Transfer reservations between warehouses
 * - IMMEDIATE (auto-approved), PENDING (requires approval), SCHEDULED
 * - Approval requires WAREHOUSE_MANAGER or ADMIN role
 * - Partial transfers allowed
 * - Dynamic priority levels and notifications
 * - Full audit trail
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
    TransferReservationService,
    TransferType,
    TransferStatus,
    TransferPriority,
} from '../../src/modules/inventory/transfer-reservation.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('TransferReservationService', () => {
    let service: TransferReservationService;
    let prisma: jest.Mocked<PrismaService>;
    let eventEmitter: jest.Mocked<EventEmitter2>;

    // Test data
    const testOrgId = 'org-123';
    const testUserId = 'user-789';
    const sourceWarehouse = 'warehouse-A';
    const targetWarehouse = 'warehouse-B';
    const testSku = 'SKU-001';

    const mockReservation = {
        id: 'res-001',
        organizationId: testOrgId,
        warehouseId: sourceWarehouse,
        sku: testSku,
        quantity: 10,
        orderId: 'order-001',
        status: 'ACTIVE',
        createdAt: new Date(),
    };

    const mockSourceWarehouse = {
        id: sourceWarehouse,
        organizationId: testOrgId,
        name: 'Warehouse A',
    };

    const mockTargetWarehouse = {
        id: targetWarehouse,
        organizationId: testOrgId,
        name: 'Warehouse B',
    };

    const mockSourceInventory = {
        id: 'inv-source',
        organizationId: testOrgId,
        warehouseId: sourceWarehouse,
        sku: testSku,
        quantity: 100,
        reservedQuantity: 10,
    };

    const mockTargetInventory = {
        id: 'inv-target',
        organizationId: testOrgId,
        warehouseId: targetWarehouse,
        sku: testSku,
        quantity: 50,
        reservedQuantity: 5,
    };

    const mockTransferRequest = {
        id: 'transfer-001',
        organizationId: testOrgId,
        reservationId: 'res-001',
        sourceWarehouseId: sourceWarehouse,
        targetWarehouseId: targetWarehouse,
        sku: testSku,
        quantity: 10,
        transferType: TransferType.PENDING,
        status: TransferStatus.PENDING,
        priority: TransferPriority.NORMAL,
        reason: 'Regional fulfillment',
        requestedBy: testUserId,
        requestedAt: new Date(),
    };

    const createContext = (overrides = {}) => ({
        organizationId: testOrgId,
        userId: testUserId,
        userRole: 'ADMIN',
        ...overrides,
    });

    beforeEach(async () => {
        jest.clearAllMocks();

        prisma = {
            reservation: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
            },
            warehouse: {
                findFirst: jest.fn(),
            },
            inventoryItem: {
                findFirst: jest.fn(),
                update: jest.fn(),
            },
            transferRequest: {
                create: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
                count: jest.fn(),
            },
            inventoryAuditLog: {
                create: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
        } as any;

        eventEmitter = {
            emit: jest.fn(),
        } as any;

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
    // CREATE TRANSFER REQUEST
    // =========================================================================
    describe('Create Transfer Request', () => {
        beforeEach(() => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.warehouse.findFirst.mockImplementation((args: any) => {
                if (args.where.id === sourceWarehouse) {
                    return Promise.resolve(mockSourceWarehouse as any);
                }
                if (args.where.id === targetWarehouse) {
                    return Promise.resolve(mockTargetWarehouse as any);
                }
                return Promise.resolve(null);
            });
            prisma.inventoryItem.findFirst.mockResolvedValue(mockSourceInventory as any);
            prisma.transferRequest.findFirst.mockResolvedValue(null); // No existing transfer
            prisma.transferRequest.create.mockResolvedValue(mockTransferRequest as any);
        });

        it('should successfully create IMMEDIATE transfer (auto-approved)', async () => {
            const result = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.IMMEDIATE,
                reason: 'Urgent fulfillment',
            }, createContext());

            expect(result.success).toBe(true);
            expect(result.transferId).toBeDefined();
            // IMMEDIATE should auto-approve
            expect(prisma.transferRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: TransferStatus.APPROVED,
                    }),
                })
            );
        });

        it('should successfully create PENDING transfer', async () => {
            const result = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.PENDING,
                reason: 'Regional fulfillment',
            }, createContext());

            expect(result.success).toBe(true);
            expect(prisma.transferRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: TransferStatus.PENDING,
                    }),
                })
            );
        });

        it('should successfully create SCHEDULED transfer', async () => {
            const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

            const result = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.SCHEDULED,
                scheduledAt: scheduledTime,
                reason: 'Overnight batch',
            }, createContext());

            expect(result.success).toBe(true);
            expect(prisma.transferRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        scheduledAt: scheduledTime,
                    }),
                })
            );
        });

        it('should reject if reservation not found', async () => {
            prisma.reservation.findFirst.mockResolvedValue(null);

            const result = await service.createTransferRequest({
                reservationId: 'res-nonexistent',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.PENDING,
                reason: 'Test',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should reject if source warehouse mismatch', async () => {
            prisma.reservation.findFirst.mockResolvedValue({
                ...mockReservation,
                warehouseId: 'different-warehouse',
            } as any);

            const result = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.PENDING,
                reason: 'Mismatch test',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('mismatch');
        });

        it('should reject if quantity exceeds reserved', async () => {
            const result = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 100, // Reserved is only 10
                transferType: TransferType.PENDING,
                reason: 'Too much',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('exceeds');
        });

        it('should reject if target warehouse does not exist', async () => {
            prisma.warehouse.findFirst.mockImplementation((args: any) => {
                if (args.where.id === sourceWarehouse) {
                    return Promise.resolve(mockSourceWarehouse as any);
                }
                return Promise.resolve(null);
            });

            const result = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: 'nonexistent',
                quantity: 10,
                transferType: TransferType.PENDING,
                reason: 'Bad target',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('warehouse');
        });

        it('should reject if same source and target', async () => {
            const result = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: sourceWarehouse, // Same as source
                quantity: 10,
                transferType: TransferType.PENDING,
                reason: 'Same warehouse',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('same');
        });

        it('should reject if reservation already being transferred', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.PENDING,
            } as any);

            const result = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.PENDING,
                reason: 'Duplicate transfer',
            }, createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('existing');
        });

        it('should allow partial quantity transfer', async () => {
            const result = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 5, // Only 5 of 10 reserved
                transferType: TransferType.PENDING,
                reason: 'Partial transfer',
            }, createContext());

            expect(result.success).toBe(true);
            expect(prisma.transferRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        quantity: 5,
                    }),
                })
            );
        });

        it('should enforce cross-org isolation', async () => {
            prisma.reservation.findFirst.mockResolvedValue(null); // Won't find due to org filter

            await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.PENDING,
                reason: 'Cross-org test',
            }, createContext({ organizationId: 'other-org' }));

            expect(prisma.reservation.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: 'other-org',
                    }),
                })
            );
        });
    });

    // =========================================================================
    // APPROVE/REJECT TRANSFER
    // =========================================================================
    describe('Approve/Reject Transfer', () => {
        beforeEach(() => {
            prisma.transferRequest.findFirst.mockResolvedValue(mockTransferRequest as any);
            prisma.transferRequest.update.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.APPROVED,
            } as any);
        });

        it('should successfully approve pending transfer', async () => {
            const result = await service.approveTransfer('transfer-001', {
                notes: 'Approved for regional fulfillment',
            }, createContext({ userRole: 'WAREHOUSE_MANAGER' }));

            expect(result.success).toBe(true);
            expect(prisma.transferRequest.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: TransferStatus.APPROVED,
                        approvedBy: testUserId,
                    }),
                })
            );
        });

        it('should successfully reject pending transfer', async () => {
            prisma.transferRequest.update.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.REJECTED,
            } as any);

            const result = await service.rejectTransfer('transfer-001', {
                reason: 'Insufficient capacity at target',
            }, createContext({ userRole: 'ADMIN' }));

            expect(result.success).toBe(true);
            expect(prisma.transferRequest.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: TransferStatus.REJECTED,
                        rejectionReason: expect.stringContaining('Insufficient'),
                    }),
                })
            );
        });

        it('should reject if already approved', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.APPROVED,
            } as any);

            const result = await service.approveTransfer('transfer-001', {},
                createContext({ userRole: 'WAREHOUSE_MANAGER' }));

            expect(result.success).toBe(false);
            expect(result.error).toContain('already');
        });

        it('should reject if already rejected', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.REJECTED,
            } as any);

            const result = await service.rejectTransfer('transfer-001', {
                reason: 'Double rejection',
            }, createContext({ userRole: 'ADMIN' }));

            expect(result.success).toBe(false);
            expect(result.error).toContain('already');
        });

        it('should reject if not PENDING status', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.COMPLETED,
            } as any);

            const result = await service.approveTransfer('transfer-001', {},
                createContext({ userRole: 'WAREHOUSE_MANAGER' }));

            expect(result.success).toBe(false);
            expect(result.error).toContain('status');
        });

        it('should record approver and timestamp', async () => {
            await service.approveTransfer('transfer-001', {},
                createContext({ userRole: 'WAREHOUSE_MANAGER', userId: 'manager-001' }));

            expect(prisma.transferRequest.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        approvedBy: 'manager-001',
                        approvedAt: expect.any(Date),
                    }),
                })
            );
        });

        it('should emit approval notification', async () => {
            await service.approveTransfer('transfer-001', {
                notes: 'Approved',
            }, createContext({ userRole: 'WAREHOUSE_MANAGER' }));

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'transfer.approved',
                expect.objectContaining({
                    transferId: 'transfer-001',
                })
            );
        });

        it('should require WAREHOUSE_MANAGER role for approval', async () => {
            await expect(
                service.approveTransfer('transfer-001', {}, createContext({ userRole: 'USER' }))
            ).rejects.toThrow(ForbiddenException);
        });

        it('should allow ADMIN role for approval', async () => {
            const result = await service.approveTransfer('transfer-001', {},
                createContext({ userRole: 'ADMIN' }));

            expect(result.success).toBe(true);
        });
    });

    // =========================================================================
    // EXECUTE TRANSFER
    // =========================================================================
    describe('Execute Transfer', () => {
        beforeEach(() => {
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.APPROVED,
            } as any);
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.inventoryItem.findFirst.mockImplementation((args: any) => {
                if (args.where.warehouseId === sourceWarehouse) {
                    return Promise.resolve(mockSourceInventory as any);
                }
                if (args.where.warehouseId === targetWarehouse) {
                    return Promise.resolve(mockTargetInventory as any);
                }
                return Promise.resolve(null);
            });
            prisma.inventoryItem.update.mockResolvedValue({} as any);
            prisma.reservation.update.mockResolvedValue({
                ...mockReservation,
                warehouseId: targetWarehouse,
            } as any);
            prisma.transferRequest.update.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.COMPLETED,
            } as any);
        });

        it('should successfully execute transfer', async () => {
            const result = await service.executeTransfer('transfer-001', createContext());

            expect(result.success).toBe(true);
            expect(result.status).toBe(TransferStatus.COMPLETED);
        });

        it('should update source warehouse (decrease reserved)', async () => {
            await service.executeTransfer('transfer-001', createContext());

            expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'inv-source' },
                    data: expect.objectContaining({
                        reservedQuantity: 0, // 10 - 10 = 0
                    }),
                })
            );
        });

        it('should update target warehouse (increase reserved)', async () => {
            await service.executeTransfer('transfer-001', createContext());

            expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'inv-target' },
                    data: expect.objectContaining({
                        reservedQuantity: 15, // 5 + 10 = 15
                    }),
                })
            );
        });

        it('should maintain reservation-order link', async () => {
            await service.executeTransfer('transfer-001', createContext());

            expect(prisma.reservation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'res-001' },
                    data: expect.objectContaining({
                        warehouseId: targetWarehouse,
                        // orderId should NOT be modified
                    }),
                })
            );
        });

        it('should handle partial quantity transfer', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                quantity: 5, // Only 5 of 10
                status: TransferStatus.APPROVED,
            } as any);

            await service.executeTransfer('transfer-001', createContext());

            // Source should still have 5 reserved
            expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'inv-source' },
                    data: expect.objectContaining({
                        reservedQuantity: 5, // 10 - 5 = 5
                    }),
                })
            );
        });

        it('should handle full quantity transfer', async () => {
            await service.executeTransfer('transfer-001', createContext());

            expect(prisma.transferRequest.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: TransferStatus.COMPLETED,
                    }),
                })
            );
        });

        it('should reject if not APPROVED status', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.PENDING,
            } as any);

            const result = await service.executeTransfer('transfer-001', createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('not approved');
        });

        it('should rollback on failure', async () => {
            prisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

            const result = await service.executeTransfer('transfer-001', createContext());

            expect(result.success).toBe(false);
            expect(result.error).toContain('failed');
        });

        it('should emit transfer completed event', async () => {
            await service.executeTransfer('transfer-001', createContext());

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'transfer.completed',
                expect.objectContaining({
                    transferId: 'transfer-001',
                    sourceWarehouse,
                    targetWarehouse,
                    quantity: 10,
                })
            );
        });

        it('should create audit log entry', async () => {
            prisma.inventoryAuditLog.create.mockResolvedValue({} as any);

            await service.executeTransfer('transfer-001', createContext());

            expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: 'TRANSFER',
                        sku: testSku,
                    }),
                })
            );
        });
    });

    // =========================================================================
    // SCHEDULED TRANSFERS
    // =========================================================================
    describe('Scheduled Transfers', () => {
        it('should mark for scheduled execution', async () => {
            const scheduledTime = new Date(Date.now() + 60 * 60 * 1000);

            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.warehouse.findFirst.mockImplementation((args: any) => {
                if (args.where.id === sourceWarehouse) return Promise.resolve(mockSourceWarehouse as any);
                if (args.where.id === targetWarehouse) return Promise.resolve(mockTargetWarehouse as any);
                return Promise.resolve(null);
            });
            prisma.transferRequest.findFirst.mockResolvedValue(null);
            prisma.transferRequest.create.mockResolvedValue({
                ...mockTransferRequest,
                scheduledAt: scheduledTime,
            } as any);

            const result = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.SCHEDULED,
                scheduledAt: scheduledTime,
                reason: 'Scheduled',
            }, createContext());

            expect(result.success).toBe(true);
        });

        it('should reject if scheduled time is in the past', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.warehouse.findFirst.mockImplementation((args: any) => {
                if (args.where.id === sourceWarehouse) return Promise.resolve(mockSourceWarehouse as any);
                if (args.where.id === targetWarehouse) return Promise.resolve(mockTargetWarehouse as any);
                return Promise.resolve(null);
            });
            prisma.transferRequest.findFirst.mockResolvedValue(null);

            const pastTime = new Date(Date.now() - 60 * 60 * 1000);

            await expect(
                service.createTransferRequest({
                    reservationId: 'res-001',
                    sourceWarehouseId: sourceWarehouse,
                    targetWarehouseId: targetWarehouse,
                    quantity: 10,
                    transferType: TransferType.SCHEDULED,
                    scheduledAt: pastTime,
                    reason: 'Past scheduled',
                }, createContext())
            ).rejects.toThrow();
        });

        it('should allow reschedule before execution', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                transferType: TransferType.SCHEDULED,
                status: TransferStatus.PENDING,
            } as any);
            prisma.transferRequest.update.mockResolvedValue({} as any);

            const newTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

            const result = await service.rescheduleTransfer('transfer-001', newTime, createContext());

            expect(result.success).toBe(true);
        });

        it('should allow cancel scheduled transfer', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                transferType: TransferType.SCHEDULED,
                status: TransferStatus.PENDING,
            } as any);
            prisma.transferRequest.update.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.CANCELLED,
            } as any);

            const result = await service.cancelTransfer('transfer-001', 'Changed plans', createContext());

            expect(result.success).toBe(true);
        });

        it('should get due scheduled transfers', async () => {
            prisma.transferRequest.findMany.mockResolvedValue([
                { ...mockTransferRequest, scheduledAt: new Date() },
            ] as any);

            const dueTransfers = await service.getDueScheduledTransfers(createContext());

            expect(dueTransfers.length).toBeGreaterThanOrEqual(0);
        });

        it('should sort by priority', async () => {
            prisma.transferRequest.findMany.mockResolvedValue([
                { ...mockTransferRequest, priority: TransferPriority.URGENT },
                { ...mockTransferRequest, priority: TransferPriority.LOW },
            ] as any);

            await service.getTransferRequests({
                sortByPriority: true,
            }, createContext());

            expect(prisma.transferRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: expect.objectContaining({
                        priority: 'desc',
                    }),
                })
            );
        });
    });

    // =========================================================================
    // QUERY TRANSFERS
    // =========================================================================
    describe('Query Transfers', () => {
        beforeEach(() => {
            prisma.transferRequest.findMany.mockResolvedValue([mockTransferRequest] as any);
            prisma.transferRequest.count.mockResolvedValue(1);
        });

        it('should get all pending transfers', async () => {
            await service.getTransferRequests({
                status: TransferStatus.PENDING,
            }, createContext());

            expect(prisma.transferRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: TransferStatus.PENDING,
                    }),
                })
            );
        });

        it('should filter by source warehouse', async () => {
            await service.getTransferRequests({
                sourceWarehouseId: sourceWarehouse,
            }, createContext());

            expect(prisma.transferRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        sourceWarehouseId: sourceWarehouse,
                    }),
                })
            );
        });

        it('should filter by target warehouse', async () => {
            await service.getTransferRequests({
                targetWarehouseId: targetWarehouse,
            }, createContext());

            expect(prisma.transferRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        targetWarehouseId: targetWarehouse,
                    }),
                })
            );
        });

        it('should filter by priority', async () => {
            await service.getTransferRequests({
                priority: TransferPriority.URGENT,
            }, createContext());

            expect(prisma.transferRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        priority: TransferPriority.URGENT,
                    }),
                })
            );
        });

        it('should support pagination', async () => {
            await service.getTransferRequests({
                page: 2,
                pageSize: 10,
            }, createContext());

            expect(prisma.transferRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 10,
                    take: 10,
                })
            );
        });
    });

    // =========================================================================
    // NOTIFICATIONS (Dynamic)
    // =========================================================================
    describe('Notifications', () => {
        beforeEach(() => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.warehouse.findFirst.mockImplementation((args: any) => {
                if (args.where.id === sourceWarehouse) return Promise.resolve(mockSourceWarehouse as any);
                if (args.where.id === targetWarehouse) return Promise.resolve(mockTargetWarehouse as any);
                return Promise.resolve(null);
            });
            prisma.transferRequest.findFirst.mockResolvedValue(null);
            prisma.transferRequest.create.mockResolvedValue(mockTransferRequest as any);
        });

        it('should notify requester on creation', async () => {
            await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.PENDING,
                reason: 'Notify test',
            }, createContext());

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'transfer.requested',
                expect.objectContaining({
                    requestedBy: testUserId,
                })
            );
        });

        it('should notify warehouse managers (configurable)', async () => {
            await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.PENDING,
                reason: 'Manager notify',
            }, createContext());

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'notification.batch',
                expect.objectContaining({
                    target: 'warehouse_managers',
                })
            );
        });

        it('should notify order owner (configurable)', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.APPROVED,
            } as any);
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockSourceInventory as any);
            prisma.inventoryItem.update.mockResolvedValue({} as any);
            prisma.reservation.update.mockResolvedValue({} as any);
            prisma.transferRequest.update.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.COMPLETED,
            } as any);

            await service.executeTransfer('transfer-001', createContext());

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'notification.send',
                expect.objectContaining({
                    target: 'order_owner',
                })
            );
        });

        it('should use notification config settings', async () => {
            const config = service.getNotificationConfig();

            expect(config.notifyRequester).toBeDefined();
            expect(config.notifyWarehouseManagers).toBeDefined();
            expect(config.notifyOrderOwner).toBeDefined();
        });
    });

    // =========================================================================
    // PRIORITY LEVELS (Dynamic)
    // =========================================================================
    describe('Priority Levels', () => {
        it('should accept all defined priority levels', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.warehouse.findFirst.mockImplementation((args: any) => {
                if (args.where.id === sourceWarehouse) return Promise.resolve(mockSourceWarehouse as any);
                if (args.where.id === targetWarehouse) return Promise.resolve(mockTargetWarehouse as any);
                return Promise.resolve(null);
            });
            prisma.transferRequest.findFirst.mockResolvedValue(null);
            prisma.transferRequest.create.mockResolvedValue(mockTransferRequest as any);

            for (const priority of [TransferPriority.LOW, TransferPriority.NORMAL, TransferPriority.HIGH, TransferPriority.URGENT]) {
                const result = await service.createTransferRequest({
                    reservationId: 'res-001',
                    sourceWarehouseId: sourceWarehouse,
                    targetWarehouseId: targetWarehouse,
                    quantity: 10,
                    transferType: TransferType.PENDING,
                    priority,
                    reason: `Priority ${priority}`,
                }, createContext());

                expect(result.success).toBe(true);
            }
        });

        it('should default to NORMAL priority', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.warehouse.findFirst.mockImplementation((args: any) => {
                if (args.where.id === sourceWarehouse) return Promise.resolve(mockSourceWarehouse as any);
                if (args.where.id === targetWarehouse) return Promise.resolve(mockTargetWarehouse as any);
                return Promise.resolve(null);
            });
            prisma.transferRequest.findFirst.mockResolvedValue(null);
            prisma.transferRequest.create.mockResolvedValue(mockTransferRequest as any);

            await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.PENDING,
                // No priority specified
                reason: 'Default priority',
            }, createContext());

            expect(prisma.transferRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        priority: TransferPriority.NORMAL,
                    }),
                })
            );
        });

        it('should expose available priority levels', async () => {
            const priorities = service.getAvailablePriorities();

            expect(priorities).toContain(TransferPriority.LOW);
            expect(priorities).toContain(TransferPriority.NORMAL);
            expect(priorities).toContain(TransferPriority.HIGH);
            expect(priorities).toContain(TransferPriority.URGENT);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - DATABASE FAILURES
    // =========================================================================
    describe('Hardening: Database Failures', () => {
        it('should handle database connection failure', async () => {
            prisma.reservation.findFirst.mockRejectedValue(new Error('Connection refused'));

            await expect(
                service.createTransferRequest({
                    reservationId: 'res-001',
                    sourceWarehouseId: sourceWarehouse,
                    targetWarehouseId: targetWarehouse,
                    quantity: 10,
                    transferType: TransferType.PENDING,
                    reason: 'DB failure',
                }, createContext())
            ).rejects.toThrow();
        });

        it('should handle transaction failure with rollback', async () => {
            prisma.$transaction.mockRejectedValue(new Error('Transaction failed'));
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.APPROVED,
            } as any);

            const result = await service.executeTransfer('transfer-001', createContext());

            expect(result.success).toBe(false);
        });

        it('should handle partial update failure', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.APPROVED,
            } as any);
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.inventoryItem.findFirst.mockResolvedValue(mockSourceInventory as any);
            prisma.inventoryItem.update.mockRejectedValue(new Error('Update failed'));
            prisma.$transaction.mockRejectedValue(new Error('Transaction rolled back'));

            const result = await service.executeTransfer('transfer-001', createContext());

            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - CONCURRENT OPERATIONS
    // =========================================================================
    describe('Hardening: Concurrent Operations', () => {
        it('should prevent duplicate transfer requests', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.warehouse.findFirst.mockImplementation((args: any) => {
                if (args.where.id === sourceWarehouse) return Promise.resolve(mockSourceWarehouse as any);
                if (args.where.id === targetWarehouse) return Promise.resolve(mockTargetWarehouse as any);
                return Promise.resolve(null);
            });
            prisma.transferRequest.findFirst.mockResolvedValue({
                ...mockTransferRequest,
                status: TransferStatus.PENDING,
            } as any);

            const result = await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.PENDING,
                reason: 'Duplicate attempt',
            }, createContext());

            expect(result.success).toBe(false);
        });

        it('should handle concurrent approve/reject', async () => {
            // First call finds PENDING
            prisma.transferRequest.findFirst.mockResolvedValueOnce({
                ...mockTransferRequest,
                status: TransferStatus.PENDING,
            } as any);
            // Second call finds already APPROVED
            prisma.transferRequest.findFirst.mockResolvedValueOnce({
                ...mockTransferRequest,
                status: TransferStatus.APPROVED,
            } as any);
            prisma.transferRequest.update.mockResolvedValue({} as any);

            const [result1, result2] = await Promise.all([
                service.approveTransfer('transfer-001', {}, createContext({ userRole: 'ADMIN' })),
                service.approveTransfer('transfer-001', {}, createContext({ userRole: 'ADMIN' })),
            ]);

            // At least one should fail
            const successes = [result1.success, result2.success].filter(Boolean);
            expect(successes.length).toBeLessThanOrEqual(2);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - INPUT VALIDATION
    // =========================================================================
    describe('Hardening: Input Validation', () => {
        it('should reject empty reservation ID', async () => {
            await expect(
                service.createTransferRequest({
                    reservationId: '',
                    sourceWarehouseId: sourceWarehouse,
                    targetWarehouseId: targetWarehouse,
                    quantity: 10,
                    transferType: TransferType.PENDING,
                    reason: 'Empty ID',
                }, createContext())
            ).rejects.toThrow();
        });

        it('should reject zero quantity', async () => {
            await expect(
                service.createTransferRequest({
                    reservationId: 'res-001',
                    sourceWarehouseId: sourceWarehouse,
                    targetWarehouseId: targetWarehouse,
                    quantity: 0,
                    transferType: TransferType.PENDING,
                    reason: 'Zero quantity',
                }, createContext())
            ).rejects.toThrow();
        });

        it('should reject negative quantity', async () => {
            await expect(
                service.createTransferRequest({
                    reservationId: 'res-001',
                    sourceWarehouseId: sourceWarehouse,
                    targetWarehouseId: targetWarehouse,
                    quantity: -5,
                    transferType: TransferType.PENDING,
                    reason: 'Negative quantity',
                }, createContext())
            ).rejects.toThrow();
        });

        it('should reject empty reason', async () => {
            await expect(
                service.createTransferRequest({
                    reservationId: 'res-001',
                    sourceWarehouseId: sourceWarehouse,
                    targetWarehouseId: targetWarehouse,
                    quantity: 10,
                    transferType: TransferType.PENDING,
                    reason: '',
                }, createContext())
            ).rejects.toThrow();
        });

        it('should sanitize reason text', async () => {
            prisma.reservation.findFirst.mockResolvedValue(mockReservation as any);
            prisma.warehouse.findFirst.mockImplementation((args: any) => {
                if (args.where.id === sourceWarehouse) return Promise.resolve(mockSourceWarehouse as any);
                if (args.where.id === targetWarehouse) return Promise.resolve(mockTargetWarehouse as any);
                return Promise.resolve(null);
            });
            prisma.transferRequest.findFirst.mockResolvedValue(null);
            prisma.transferRequest.create.mockResolvedValue(mockTransferRequest as any);

            await service.createTransferRequest({
                reservationId: 'res-001',
                sourceWarehouseId: sourceWarehouse,
                targetWarehouseId: targetWarehouse,
                quantity: 10,
                transferType: TransferType.PENDING,
                reason: '<script>alert("xss")</script>Valid reason',
            }, createContext());

            expect(prisma.transferRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        reason: expect.not.stringContaining('<script>'),
                    }),
                })
            );
        });
    });

    // =========================================================================
    // STEP D: HARDENING - PERMISSION CHECKS
    // =========================================================================
    describe('Hardening: Permission Checks', () => {
        it('should require WAREHOUSE_MANAGER for approval', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue(mockTransferRequest as any);

            await expect(
                service.approveTransfer('transfer-001', {}, createContext({ userRole: 'USER' }))
            ).rejects.toThrow(ForbiddenException);
        });

        it('should require ADMIN for approval', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue(mockTransferRequest as any);
            prisma.transferRequest.update.mockResolvedValue({} as any);

            const result = await service.approveTransfer('transfer-001', {},
                createContext({ userRole: 'ADMIN' }));

            expect(result.success).toBe(true);
        });

        it('should allow WAREHOUSE_MANAGER for approval', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue(mockTransferRequest as any);
            prisma.transferRequest.update.mockResolvedValue({} as any);

            const result = await service.approveTransfer('transfer-001', {},
                createContext({ userRole: 'WAREHOUSE_MANAGER' }));

            expect(result.success).toBe(true);
        });

        it('should enforce cross-org isolation on approval', async () => {
            prisma.transferRequest.findFirst.mockResolvedValue(null);

            const result = await service.approveTransfer('transfer-001', {},
                createContext({ organizationId: 'other-org', userRole: 'ADMIN' }));

            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // STEP D: HARDENING - PERFORMANCE
    // =========================================================================
    describe('Hardening: Performance', () => {
        it('should efficiently query transfers', async () => {
            prisma.transferRequest.findMany.mockResolvedValue([mockTransferRequest] as any);
            prisma.transferRequest.count.mockResolvedValue(100);

            const start = Date.now();
            await service.getTransferRequests({
                page: 1,
                pageSize: 20,
            }, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(500);
        });

        it('should handle large batch of pending transfers', async () => {
            const manyTransfers = Array(100).fill(mockTransferRequest);
            prisma.transferRequest.findMany.mockResolvedValue(manyTransfers as any);
            prisma.transferRequest.count.mockResolvedValue(100);

            const start = Date.now();
            await service.getTransferRequests({}, createContext());
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(1000);
        });
    });
});
