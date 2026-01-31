/**
 * Transfer Reservation Service (INV-06)
 * 
 * Business Logic:
 * - Transfer reservations between warehouses
 * - IMMEDIATE (auto-approved), PENDING (requires approval), SCHEDULED
 * - Approval requires WAREHOUSE_MANAGER or ADMIN role
 * - Partial transfers allowed
 * - Dynamic priority levels and notifications
 * - Full audit trail
 */

import { Injectable, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

// =========================================================================
// ENUMS & TYPES
// =========================================================================

export enum TransferType {
    IMMEDIATE = 'IMMEDIATE',
    PENDING = 'PENDING',
    SCHEDULED = 'SCHEDULED',
}

export enum TransferStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    IN_TRANSIT = 'IN_TRANSIT',
    COMPLETED = 'COMPLETED',
    REJECTED = 'REJECTED',
    CANCELLED = 'CANCELLED',
    FAILED = 'FAILED',
}

export enum TransferPriority {
    LOW = 'LOW',
    NORMAL = 'NORMAL',
    HIGH = 'HIGH',
    URGENT = 'URGENT',
}

const APPROVAL_ROLES = ['ADMIN', 'WAREHOUSE_MANAGER'];
const PRIORITY_ORDER: Record<TransferPriority, number> = {
    [TransferPriority.LOW]: 1,
    [TransferPriority.NORMAL]: 2,
    [TransferPriority.HIGH]: 3,
    [TransferPriority.URGENT]: 4,
};

export interface TransferRequestInput {
    reservationId: string;
    sourceWarehouseId: string;
    targetWarehouseId: string;
    quantity: number;
    transferType: TransferType;
    priority?: TransferPriority;
    scheduledAt?: Date;
    reason: string;
}

export interface TransferRequestResult {
    success: boolean;
    transferId?: string;
    status?: TransferStatus;
    error?: string;
}

export interface TransferResult {
    success: boolean;
    status?: TransferStatus;
    error?: string;
}

export interface TransferQueryFilters {
    status?: TransferStatus;
    sourceWarehouseId?: string;
    targetWarehouseId?: string;
    priority?: TransferPriority;
    sortByPriority?: boolean;
    page?: number;
    pageSize?: number;
}

export interface TransferContext {
    organizationId: string;
    userId: string;
    userRole: string;
}

export interface NotificationConfig {
    notifyRequester: boolean;
    notifyWarehouseManagers: boolean;
    notifyOrderOwner: boolean;
}

@Injectable()
export class TransferReservationService implements OnModuleInit {
    // Dynamic configuration
    private notificationConfig: NotificationConfig = {
        notifyRequester: true,
        notifyWarehouseManagers: true,
        notifyOrderOwner: true,
    };

    private availablePriorities: TransferPriority[] = [
        TransferPriority.LOW,
        TransferPriority.NORMAL,
        TransferPriority.HIGH,
        TransferPriority.URGENT,
    ];

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    onModuleInit() {
        // Could load config from environment/database
    }

    // =========================================================================
    // PUBLIC API - CONFIG
    // =========================================================================

    getAvailablePriorities(): TransferPriority[] {
        return [...this.availablePriorities];
    }

    getNotificationConfig(): NotificationConfig {
        return { ...this.notificationConfig };
    }

    // =========================================================================
    // PUBLIC API - CREATE TRANSFER
    // =========================================================================

    async createTransferRequest(
        input: TransferRequestInput,
        context: TransferContext
    ): Promise<TransferRequestResult> {
        // Validation
        this.validateInput(input);
        this.validateContext(context);

        // Find reservation
        const reservation = await this.prisma.reservation.findFirst({
            where: {
                id: input.reservationId,
                organizationId: context.organizationId,
            },
        });

        if (!reservation) {
            return { success: false, error: 'Reservation not found' };
        }

        // Validate source warehouse matches reservation
        if (reservation.warehouseId !== input.sourceWarehouseId) {
            return { success: false, error: 'Source warehouse mismatch with reservation' };
        }

        // Validate quantity
        if (input.quantity > reservation.quantity) {
            return { success: false, error: 'Transfer quantity exceeds reserved amount' };
        }

        // Validate same source/target
        if (input.sourceWarehouseId === input.targetWarehouseId) {
            return { success: false, error: 'Source and target warehouse cannot be the same' };
        }

        // Validate warehouses exist
        const [sourceWarehouse, targetWarehouse] = await Promise.all([
            this.prisma.warehouse.findFirst({
                where: { id: input.sourceWarehouseId, organizationId: context.organizationId },
            }),
            this.prisma.warehouse.findFirst({
                where: { id: input.targetWarehouseId, organizationId: context.organizationId },
            }),
        ]);

        if (!targetWarehouse) {
            return { success: false, error: 'Target warehouse not found' };
        }

        // Check for existing active transfer
        const existingTransfer = await this.prisma.transferRequest.findFirst({
            where: {
                reservationId: input.reservationId,
                organizationId: context.organizationId,
                status: { in: [TransferStatus.PENDING, TransferStatus.APPROVED, TransferStatus.IN_TRANSIT] },
            },
        });

        if (existingTransfer) {
            return { success: false, error: 'An existing transfer is already in progress for this reservation' };
        }

        // Determine initial status based on transfer type
        // IMMEDIATE transfers are auto-approved (best practice)
        const initialStatus = input.transferType === TransferType.IMMEDIATE
            ? TransferStatus.APPROVED
            : TransferStatus.PENDING;

        // Create transfer request
        const transfer = await this.prisma.transferRequest.create({
            data: {
                organizationId: context.organizationId,
                reservationId: input.reservationId,
                sourceWarehouseId: input.sourceWarehouseId,
                targetWarehouseId: input.targetWarehouseId,
                sku: reservation.sku,
                quantity: input.quantity,
                transferType: input.transferType,
                status: initialStatus,
                priority: input.priority || TransferPriority.NORMAL,
                reason: this.sanitizeText(input.reason),
                scheduledAt: input.scheduledAt,
                requestedBy: context.userId,
                requestedAt: new Date(),
                // Auto-approve IMMEDIATE transfers
                ...(input.transferType === TransferType.IMMEDIATE && {
                    approvedBy: context.userId,
                    approvedAt: new Date(),
                }),
            },
        });

        // Emit events
        this.eventEmitter.emit('transfer.requested', {
            transferId: transfer.id,
            organizationId: context.organizationId,
            requestedBy: context.userId,
            sourceWarehouse: input.sourceWarehouseId,
            targetWarehouse: input.targetWarehouseId,
            quantity: input.quantity,
        });

        // Notify warehouse managers (configurable)
        if (this.notificationConfig.notifyWarehouseManagers) {
            this.eventEmitter.emit('notification.batch', {
                target: 'warehouse_managers',
                type: 'TRANSFER_REQUESTED',
                organizationId: context.organizationId,
                data: { transferId: transfer.id },
            });
        }

        return {
            success: true,
            transferId: transfer.id,
            status: initialStatus,
        };
    }

    // =========================================================================
    // PUBLIC API - APPROVE/REJECT
    // =========================================================================

    async approveTransfer(
        transferId: string,
        options: { notes?: string } = {},
        context: TransferContext
    ): Promise<TransferResult> {
        this.validateContext(context);
        this.checkApprovalPermission(context);

        const transfer = await this.prisma.transferRequest.findFirst({
            where: {
                id: transferId,
                organizationId: context.organizationId,
            },
        });

        if (!transfer) {
            return { success: false, error: 'Transfer not found' };
        }

        if (transfer.status === TransferStatus.APPROVED) {
            return { success: false, error: 'Transfer already approved' };
        }

        if (transfer.status !== TransferStatus.PENDING) {
            return { success: false, error: `Cannot approve transfer with status: ${transfer.status}` };
        }

        await this.prisma.transferRequest.update({
            where: { id: transferId },
            data: {
                status: TransferStatus.APPROVED,
                approvedBy: context.userId,
                approvedAt: new Date(),
                notes: options.notes,
            },
        });

        this.eventEmitter.emit('transfer.approved', {
            transferId,
            organizationId: context.organizationId,
            approvedBy: context.userId,
        });

        return { success: true, status: TransferStatus.APPROVED };
    }

    async rejectTransfer(
        transferId: string,
        options: { reason: string },
        context: TransferContext
    ): Promise<TransferResult> {
        this.validateContext(context);
        this.checkApprovalPermission(context);

        const transfer = await this.prisma.transferRequest.findFirst({
            where: {
                id: transferId,
                organizationId: context.organizationId,
            },
        });

        if (!transfer) {
            return { success: false, error: 'Transfer not found' };
        }

        if (transfer.status === TransferStatus.REJECTED) {
            return { success: false, error: 'Transfer already rejected' };
        }

        if (transfer.status !== TransferStatus.PENDING) {
            return { success: false, error: `Cannot reject transfer with status: ${transfer.status}` };
        }

        await this.prisma.transferRequest.update({
            where: { id: transferId },
            data: {
                status: TransferStatus.REJECTED,
                rejectedBy: context.userId,
                rejectedAt: new Date(),
                rejectionReason: this.sanitizeText(options.reason),
            },
        });

        this.eventEmitter.emit('transfer.rejected', {
            transferId,
            organizationId: context.organizationId,
            rejectedBy: context.userId,
            reason: options.reason,
        });

        return { success: true, status: TransferStatus.REJECTED };
    }

    // =========================================================================
    // PUBLIC API - EXECUTE TRANSFER
    // =========================================================================

    async executeTransfer(transferId: string, context: TransferContext): Promise<TransferResult> {
        this.validateContext(context);

        const transfer = await this.prisma.transferRequest.findFirst({
            where: {
                id: transferId,
                organizationId: context.organizationId,
            },
        });

        if (!transfer) {
            return { success: false, error: 'Transfer not found' };
        }

        if (transfer.status !== TransferStatus.APPROVED) {
            return { success: false, error: 'Transfer is not approved for execution' };
        }

        try {
            await this.prisma.$transaction(async (tx) => {
                // Get reservation
                const reservation = await tx.reservation.findFirst({
                    where: {
                        id: transfer.reservationId,
                        organizationId: context.organizationId,
                    },
                });

                if (!reservation) {
                    throw new Error('Reservation not found');
                }

                // Get source inventory
                const sourceInventory = await tx.inventoryItem.findFirst({
                    where: {
                        warehouseId: transfer.sourceWarehouseId,
                        sku: transfer.sku,
                        organizationId: context.organizationId,
                    },
                });

                // Get target inventory
                const targetInventory = await tx.inventoryItem.findFirst({
                    where: {
                        warehouseId: transfer.targetWarehouseId,
                        sku: transfer.sku,
                        organizationId: context.organizationId,
                    },
                });

                // Update source inventory - decrease reserved
                if (sourceInventory) {
                    await tx.inventoryItem.update({
                        where: { id: sourceInventory.id },
                        data: {
                            reservedQuantity: Math.max(0, sourceInventory.reservedQuantity - transfer.quantity),
                        },
                    });
                }

                // Update target inventory - increase reserved
                if (targetInventory) {
                    await tx.inventoryItem.update({
                        where: { id: targetInventory.id },
                        data: {
                            reservedQuantity: targetInventory.reservedQuantity + transfer.quantity,
                        },
                    });
                }

                // Update reservation warehouse (maintains order link)
                await tx.reservation.update({
                    where: { id: reservation.id },
                    data: {
                        warehouseId: transfer.targetWarehouseId,
                        // orderId is NOT modified - maintains the link
                    },
                });

                // Update transfer status
                await tx.transferRequest.update({
                    where: { id: transferId },
                    data: {
                        status: TransferStatus.COMPLETED,
                        completedAt: new Date(),
                    },
                });

                // Create audit log
                await tx.inventoryAuditLog.create({
                    data: {
                        organizationId: context.organizationId,
                        warehouseId: transfer.sourceWarehouseId,
                        userId: context.userId,
                        sku: transfer.sku,
                        action: 'TRANSFER',
                        notes: `Transfer to ${transfer.targetWarehouseId}: ${transfer.quantity} units`,
                        metadata: {
                            transferId,
                            sourceWarehouse: transfer.sourceWarehouseId,
                            targetWarehouse: transfer.targetWarehouseId,
                            quantity: transfer.quantity,
                            reservationId: transfer.reservationId,
                        },
                        createdAt: new Date(),
                    },
                });
            });

            // Emit completion event
            this.eventEmitter.emit('transfer.completed', {
                transferId,
                organizationId: context.organizationId,
                sourceWarehouse: transfer.sourceWarehouseId,
                targetWarehouse: transfer.targetWarehouseId,
                quantity: transfer.quantity,
                sku: transfer.sku,
            });

            // Notify order owner (configurable)
            if (this.notificationConfig.notifyOrderOwner) {
                this.eventEmitter.emit('notification.send', {
                    target: 'order_owner',
                    type: 'TRANSFER_COMPLETED',
                    organizationId: context.organizationId,
                    data: { transferId },
                });
            }

            return { success: true, status: TransferStatus.COMPLETED };
        } catch (error) {
            // Mark as failed (ignore if this fails too)
            try {
                await this.prisma.transferRequest.update({
                    where: { id: transferId },
                    data: { status: TransferStatus.FAILED },
                });
            } catch {
                // Ignore secondary failure
            }

            return {
                success: false,
                status: TransferStatus.FAILED,
                error: `Transfer execution failed: ${error.message}`,
            };
        }
    }

    // =========================================================================
    // PUBLIC API - SCHEDULING
    // =========================================================================

    async rescheduleTransfer(
        transferId: string,
        newScheduledAt: Date,
        context: TransferContext
    ): Promise<TransferResult> {
        this.validateContext(context);

        const transfer = await this.prisma.transferRequest.findFirst({
            where: {
                id: transferId,
                organizationId: context.organizationId,
            },
        });

        if (!transfer) {
            return { success: false, error: 'Transfer not found' };
        }

        if (transfer.status !== TransferStatus.PENDING) {
            return { success: false, error: 'Can only reschedule pending transfers' };
        }

        await this.prisma.transferRequest.update({
            where: { id: transferId },
            data: { scheduledAt: newScheduledAt },
        });

        return { success: true };
    }

    async cancelTransfer(
        transferId: string,
        reason: string,
        context: TransferContext
    ): Promise<TransferResult> {
        this.validateContext(context);

        const transfer = await this.prisma.transferRequest.findFirst({
            where: {
                id: transferId,
                organizationId: context.organizationId,
            },
        });

        if (!transfer) {
            return { success: false, error: 'Transfer not found' };
        }

        if ([TransferStatus.COMPLETED, TransferStatus.CANCELLED].includes(transfer.status as TransferStatus)) {
            return { success: false, error: 'Cannot cancel this transfer' };
        }

        await this.prisma.transferRequest.update({
            where: { id: transferId },
            data: {
                status: TransferStatus.CANCELLED,
                notes: this.sanitizeText(reason),
            },
        });

        return { success: true, status: TransferStatus.CANCELLED };
    }

    async getDueScheduledTransfers(context: TransferContext): Promise<any[]> {
        this.validateContext(context);

        const now = new Date();

        return this.prisma.transferRequest.findMany({
            where: {
                organizationId: context.organizationId,
                transferType: TransferType.SCHEDULED,
                status: TransferStatus.APPROVED,
                scheduledAt: { lte: now },
            },
            orderBy: [
                { priority: 'desc' },
                { scheduledAt: 'asc' },
            ],
        });
    }

    // =========================================================================
    // PUBLIC API - QUERY
    // =========================================================================

    async getTransferRequests(
        filters: TransferQueryFilters,
        context: TransferContext
    ): Promise<{ items: any[]; total: number }> {
        this.validateContext(context);

        const where: any = {
            organizationId: context.organizationId,
        };

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.sourceWarehouseId) {
            where.sourceWarehouseId = filters.sourceWarehouseId;
        }

        if (filters.targetWarehouseId) {
            where.targetWarehouseId = filters.targetWarehouseId;
        }

        if (filters.priority) {
            where.priority = filters.priority;
        }

        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;
        const skip = (page - 1) * pageSize;

        const orderBy: any = filters.sortByPriority
            ? { priority: 'desc' }
            : { requestedAt: 'desc' };

        const [items, total] = await Promise.all([
            this.prisma.transferRequest.findMany({
                where,
                skip,
                take: pageSize,
                orderBy,
            }),
            this.prisma.transferRequest.count({ where }),
        ]);

        return { items, total };
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private validateInput(input: TransferRequestInput): void {
        if (!input.reservationId || input.reservationId.trim() === '') {
            throw new BadRequestException('Reservation ID is required');
        }

        if (!input.quantity || input.quantity <= 0) {
            throw new BadRequestException('Quantity must be greater than 0');
        }

        if (!input.reason || input.reason.trim() === '') {
            throw new BadRequestException('Reason is required');
        }

        if (input.transferType === TransferType.SCHEDULED) {
            if (!input.scheduledAt) {
                throw new BadRequestException('Scheduled time is required for SCHEDULED transfers');
            }
            if (input.scheduledAt < new Date()) {
                throw new BadRequestException('Scheduled time cannot be in the past');
            }
        }
    }

    private validateContext(context: TransferContext): void {
        if (!context.organizationId) {
            throw new BadRequestException('Organization ID is required');
        }
        if (!context.userId) {
            throw new BadRequestException('User ID is required');
        }
    }

    private checkApprovalPermission(context: TransferContext): void {
        if (!APPROVAL_ROLES.includes(context.userRole)) {
            throw new ForbiddenException('Approval requires WAREHOUSE_MANAGER or ADMIN role');
        }
    }

    private sanitizeText(text: string): string {
        if (!text) return '';
        return text
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, '')
            .trim();
    }
}
