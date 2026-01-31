/**
 * Force Release Reservation Service (INV-05)
 * 
 * Business Logic:
 * - Force release stuck/orphaned reservations
 * - Batch release by SKU or expiry
 * - Permission check (ADMIN or INVENTORY_MANAGER)
 * - Notifications to order owner
 * - Configurable expiry (default 30min) and batch limit (default 500)
 * - Full audit trail
 */

import { Injectable, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

// =========================================================================
// ENUMS & TYPES
// =========================================================================

export enum ReservationStatus {
    ACTIVE = 'ACTIVE',
    RELEASED = 'RELEASED',
    FULFILLED = 'FULFILLED',
    FORCE_RELEASED = 'FORCE_RELEASED',
}

export enum ReleaseReasonCode {
    STUCK_ORDER = 'STUCK_ORDER',
    ORDER_CANCELLED = 'ORDER_CANCELLED',
    EXPIRED = 'EXPIRED',
    DUPLICATE = 'DUPLICATE',
    ADMIN_OVERRIDE = 'ADMIN_OVERRIDE',
    SYSTEM_RECOVERY = 'SYSTEM_RECOVERY',
}

const VALID_REASON_CODES = Object.values(ReleaseReasonCode);
const ALLOWED_ROLES = ['ADMIN', 'INVENTORY_MANAGER'];

export interface ForceReleaseResult {
    success: boolean;
    reservationId: string;
    quantityReleased?: number;
    sku?: string;
    error?: string;
}

export interface BatchReleaseResult {
    success: boolean;
    totalFound: number;
    releasedCount: number;
    skippedCount: number;
    totalQuantityReleased: number;
    dryRun?: boolean;
    wouldRelease?: number;
    errors?: string[];
}

export interface ForceReleaseOptions {
    reason: string;
    reasonCode: ReleaseReasonCode;
    notifyOrderOwner?: boolean;
}

export interface BatchReleaseOptions {
    reason: string;
    reasonCode: ReleaseReasonCode;
    olderThanMinutes?: number;
    notifyOrderOwners?: boolean;
}

export interface ExpiredReleaseOptions {
    expiryMinutes: number;
    maxToRelease?: number;
    dryRun?: boolean;
    skipActiveOrders?: boolean;
}

export interface ForceReleaseContext {
    organizationId: string;
    userId: string;
    userRole: string;
}

export interface ServiceConfig {
    defaultExpiryMinutes: number;
    defaultMaxBatchSize: number;
}

// Default configurable settings
const DEFAULT_EXPIRY_MINUTES = 30;
const DEFAULT_MAX_BATCH_SIZE = 500;

@Injectable()
export class ForceReleaseService implements OnModuleInit {
    private config: ServiceConfig = {
        defaultExpiryMinutes: DEFAULT_EXPIRY_MINUTES,
        defaultMaxBatchSize: DEFAULT_MAX_BATCH_SIZE,
    };

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    onModuleInit() {
        // Could load config from environment or database here
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    getDefaultConfig(): ServiceConfig {
        return { ...this.config };
    }

    /**
     * Force release a single reservation
     */
    async forceReleaseReservation(
        reservationId: string,
        options: ForceReleaseOptions,
        context: ForceReleaseContext
    ): Promise<ForceReleaseResult> {
        // Validate inputs
        this.validateContext(context);
        this.checkPermission(context);
        this.validateOptions(options);

        if (!reservationId || reservationId.trim() === '') {
            throw new BadRequestException('Reservation ID is required');
        }

        try {
            // Find reservation (scoped to organization)
            const reservation = await this.prisma.reservation.findFirst({
                where: {
                    id: reservationId,
                    organizationId: context.organizationId,
                },
            });

            if (!reservation) {
                return {
                    success: false,
                    reservationId,
                    error: 'Reservation not found',
                };
            }

            if (reservation.status !== ReservationStatus.ACTIVE) {
                return {
                    success: false,
                    reservationId,
                    error: `Reservation already ${reservation.status.toLowerCase()}`,
                };
            }

            // Execute release in transaction
            const result = await this.prisma.$transaction(async (tx) => {
                // Update reservation status
                const updated = await tx.reservation.update({
                    where: { id: reservationId },
                    data: {
                        status: ReservationStatus.FORCE_RELEASED,
                        releasedAt: new Date(),
                        releaseReason: this.sanitizeReason(options.reason),
                        releasedBy: context.userId,
                    },
                });

                // Update inventory - decrease reserved quantity
                const inventoryItem = await tx.inventoryItem.findFirst({
                    where: {
                        organizationId: context.organizationId,
                        sku: reservation.sku,
                    },
                });

                if (inventoryItem) {
                    await tx.inventoryItem.update({
                        where: { id: inventoryItem.id },
                        data: {
                            reservedQuantity: Math.max(0, inventoryItem.reservedQuantity - reservation.quantity),
                        },
                    });
                }

                return {
                    reservation: updated,
                    previousReserved: inventoryItem?.reservedQuantity || 0,
                    newReserved: Math.max(0, (inventoryItem?.reservedQuantity || 0) - reservation.quantity),
                };
            });

            // Create audit log (outside transaction, non-blocking)
            try {
                await this.createAuditLog({
                    organizationId: context.organizationId,
                    warehouseId: reservation.warehouseId,
                    userId: context.userId,
                    sku: reservation.sku,
                    action: 'FORCE_RELEASE',
                    previousReserved: result.previousReserved,
                    newReserved: result.newReserved,
                    notes: `${options.reasonCode}: ${this.sanitizeReason(options.reason)}`,
                    metadata: {
                        reservationId,
                        orderId: reservation.orderId,
                        reasonCode: options.reasonCode,
                    },
                });
            } catch (err) {
                console.error('Audit log failed:', err);
            }

            // Emit event
            this.eventEmitter.emit('reservation.force_released', {
                reservationId,
                organizationId: context.organizationId,
                sku: reservation.sku,
                quantityReleased: reservation.quantity,
                releasedBy: context.userId,
                reason: options.reasonCode,
            });

            // Send notification if requested
            if (options.notifyOrderOwner) {
                try {
                    this.eventEmitter.emit('notification.send', {
                        type: 'RESERVATION_FORCE_RELEASED',
                        organizationId: context.organizationId,
                        data: {
                            reservationId,
                            orderId: reservation.orderId,
                            sku: reservation.sku,
                            quantity: reservation.quantity,
                            reason: options.reason,
                            reasonCode: options.reasonCode,
                            releasedBy: context.userId,
                        },
                    });
                } catch (err) {
                    console.error('Notification failed:', err);
                }
            }

            return {
                success: true,
                reservationId,
                quantityReleased: reservation.quantity,
                sku: reservation.sku,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Force release all reservations for a SKU
     */
    async forceReleaseAllForSku(
        sku: string,
        options: BatchReleaseOptions,
        context: ForceReleaseContext
    ): Promise<BatchReleaseResult> {
        this.validateContext(context);
        this.checkPermission(context);
        this.validateBatchOptions(options);

        const where: any = {
            organizationId: context.organizationId,
            sku,
            status: ReservationStatus.ACTIVE,
        };

        if (options.olderThanMinutes) {
            const cutoff = new Date(Date.now() - options.olderThanMinutes * 60 * 1000);
            where.createdAt = { lt: cutoff };
        }

        // Find matching reservations
        const reservations = await this.prisma.reservation.findMany({
            where,
            take: this.config.defaultMaxBatchSize,
        });

        if (reservations.length === 0) {
            return {
                success: true,
                totalFound: 0,
                releasedCount: 0,
                skippedCount: 0,
                totalQuantityReleased: 0,
            };
        }

        // Filter out already released
        const activeReservations = reservations.filter(r => r.status === ReservationStatus.ACTIVE);
        const skippedCount = reservations.length - activeReservations.length;

        // Batch update
        const result = await this.prisma.$transaction(async (tx) => {
            const updateResult = await tx.reservation.updateMany({
                where: {
                    id: { in: activeReservations.map(r => r.id) },
                    organizationId: context.organizationId,
                    status: ReservationStatus.ACTIVE,
                },
                data: {
                    status: ReservationStatus.FORCE_RELEASED,
                    releasedAt: new Date(),
                    releaseReason: this.sanitizeReason(options.reason),
                    releasedBy: context.userId,
                },
            });

            // Update inventory reserved quantity
            const totalQuantity = activeReservations.reduce((sum, r) => sum + r.quantity, 0);
            const inventoryItem = await tx.inventoryItem.findFirst({
                where: {
                    organizationId: context.organizationId,
                    sku,
                },
            });

            if (inventoryItem) {
                await tx.inventoryItem.update({
                    where: { id: inventoryItem.id },
                    data: {
                        reservedQuantity: Math.max(0, inventoryItem.reservedQuantity - totalQuantity),
                    },
                });
            }

            return { count: updateResult.count, totalQuantity };
        });

        // Create audit logs for each reservation
        try {
            await this.prisma.inventoryAuditLog.createMany({
                data: activeReservations.map(r => ({
                    organizationId: context.organizationId,
                    warehouseId: r.warehouseId,
                    userId: context.userId,
                    sku,
                    action: 'FORCE_RELEASE',
                    previousReserved: r.quantity,
                    newReserved: 0,
                    notes: `Batch release: ${options.reasonCode}`,
                    metadata: { reservationId: r.id, orderId: r.orderId },
                    createdAt: new Date(),
                })),
            });
        } catch (err) {
            console.error('Batch audit log failed:', err);
        }

        // Emit batch notification
        if (options.notifyOrderOwners) {
            this.eventEmitter.emit('notification.batch', {
                type: 'RESERVATIONS_BATCH_RELEASED',
                organizationId: context.organizationId,
                count: result.count,
                sku,
                reason: options.reasonCode,
            });
        }

        return {
            success: true,
            totalFound: reservations.length,
            releasedCount: result.count,
            skippedCount,
            totalQuantityReleased: result.totalQuantity,
        };
    }

    /**
     * Force release expired reservations (cleanup job)
     */
    async forceReleaseExpired(
        options: ExpiredReleaseOptions,
        context: ForceReleaseContext
    ): Promise<BatchReleaseResult> {
        this.validateContext(context);
        this.checkPermission(context);
        this.validateExpiredOptions(options);

        const expiryMinutes = options.expiryMinutes || this.config.defaultExpiryMinutes;
        const maxToRelease = options.maxToRelease || this.config.defaultMaxBatchSize;
        const cutoff = new Date(Date.now() - expiryMinutes * 60 * 1000);

        const where: any = {
            organizationId: context.organizationId,
            status: ReservationStatus.ACTIVE,
            createdAt: { lt: cutoff },
        };

        // Find expired reservations
        const reservations = await this.prisma.reservation.findMany({
            where,
            take: maxToRelease,
        });

        // Dry run mode
        if (options.dryRun) {
            return {
                success: true,
                dryRun: true,
                wouldRelease: reservations.length,
                totalFound: reservations.length,
                releasedCount: 0,
                skippedCount: 0,
                totalQuantityReleased: 0,
            };
        }

        if (reservations.length === 0) {
            return {
                success: true,
                totalFound: 0,
                releasedCount: 0,
                skippedCount: 0,
                totalQuantityReleased: 0,
            };
        }

        // Skip active orders if requested
        let toRelease = reservations;
        let skippedCount = 0;
        if (options.skipActiveOrders) {
            toRelease = reservations.filter(r => !r.orderStatus || r.orderStatus !== 'PROCESSING');
            skippedCount = reservations.length - toRelease.length;
        }

        // Batch update
        const result = await this.prisma.$transaction(async (tx) => {
            const updateResult = await tx.reservation.updateMany({
                where: {
                    id: { in: toRelease.map(r => r.id) },
                    organizationId: context.organizationId,
                    status: ReservationStatus.ACTIVE,
                },
                data: {
                    status: ReservationStatus.FORCE_RELEASED,
                    releasedAt: new Date(),
                    releaseReason: 'Expired - automatic cleanup',
                    releasedBy: context.userId,
                },
            });

            // Update inventory for each SKU
            const skuQuantities = new Map<string, number>();
            toRelease.forEach(r => {
                skuQuantities.set(r.sku, (skuQuantities.get(r.sku) || 0) + r.quantity);
            });

            for (const [sku, quantity] of skuQuantities) {
                const inventoryItem = await tx.inventoryItem.findFirst({
                    where: {
                        organizationId: context.organizationId,
                        sku,
                    },
                });

                if (inventoryItem) {
                    await tx.inventoryItem.update({
                        where: { id: inventoryItem.id },
                        data: {
                            reservedQuantity: Math.max(0, inventoryItem.reservedQuantity - quantity),
                        },
                    });
                }
            }

            return {
                count: updateResult.count,
                totalQuantity: toRelease.reduce((sum, r) => sum + r.quantity, 0),
            };
        });

        // Create audit logs
        try {
            await this.prisma.inventoryAuditLog.createMany({
                data: toRelease.map(r => ({
                    organizationId: context.organizationId,
                    warehouseId: r.warehouseId,
                    userId: context.userId,
                    sku: r.sku,
                    action: 'FORCE_RELEASE',
                    previousReserved: r.quantity,
                    newReserved: 0,
                    notes: `Expired cleanup (${expiryMinutes} min threshold)`,
                    metadata: { reservationId: r.id, orderId: r.orderId },
                    createdAt: new Date(),
                })),
            });
        } catch (err) {
            console.error('Expired cleanup audit log failed:', err);
        }

        return {
            success: true,
            totalFound: reservations.length,
            releasedCount: result.count,
            skippedCount,
            totalQuantityReleased: result.totalQuantity,
        };
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private validateContext(context: ForceReleaseContext): void {
        if (!context.organizationId) {
            throw new BadRequestException('Organization ID is required');
        }
        if (!context.userId) {
            throw new BadRequestException('User ID is required');
        }
    }

    private checkPermission(context: ForceReleaseContext): void {
        if (!ALLOWED_ROLES.includes(context.userRole)) {
            throw new ForbiddenException('Force release requires ADMIN or INVENTORY_MANAGER role');
        }
    }

    private validateOptions(options: ForceReleaseOptions): void {
        if (!options.reason || options.reason.trim() === '') {
            throw new BadRequestException('Reason is required for force release');
        }

        if (!VALID_REASON_CODES.includes(options.reasonCode)) {
            throw new BadRequestException(`Invalid reason code. Valid codes: ${VALID_REASON_CODES.join(', ')}`);
        }
    }

    private validateBatchOptions(options: BatchReleaseOptions): void {
        if (!options.reason || options.reason.trim() === '') {
            throw new BadRequestException('Reason is required for batch release');
        }

        if (!VALID_REASON_CODES.includes(options.reasonCode)) {
            throw new BadRequestException(`Invalid reason code. Valid codes: ${VALID_REASON_CODES.join(', ')}`);
        }
    }

    private validateExpiredOptions(options: ExpiredReleaseOptions): void {
        if (options.expiryMinutes !== undefined && options.expiryMinutes < 0) {
            throw new BadRequestException('Expiry minutes must be positive');
        }

        if (options.maxToRelease !== undefined && options.maxToRelease <= 0) {
            throw new BadRequestException('Max to release must be greater than 0');
        }
    }

    private sanitizeReason(reason: string): string {
        if (!reason) return '';
        return reason
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, '')
            .trim();
    }

    private async createAuditLog(data: {
        organizationId: string;
        warehouseId: string;
        userId: string;
        sku: string;
        action: string;
        previousReserved: number;
        newReserved: number;
        notes: string;
        metadata: any;
    }): Promise<void> {
        await this.prisma.inventoryAuditLog.create({
            data: {
                ...data,
                createdAt: new Date(),
            },
        });
    }
}
