/**
 * Stock Movement Service (INV-02)
 * 
 * Business Logic:
 * - Track all stock movements in/out of warehouses
 * - Support multiple movement types: RECEIVE, SHIP, RETURN, TRANSFER, ADJUSTMENT, DAMAGE
 * - Always block negative inventory
 * - Create paired movements for transfers
 * - Full audit trail
 * 
 * Future-Ready Design:
 * - Approval workflow (configurable, disabled for MVP)
 * - Zone-level tracking (configurable, disabled for MVP)
 * - Dynamic reference types
 */

import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

// =========================================================================
// ENUMS & TYPES
// =========================================================================

export enum MovementType {
    RECEIVE = 'RECEIVE',
    SHIP = 'SHIP',
    RETURN = 'RETURN',
    TRANSFER_OUT = 'TRANSFER_OUT',
    TRANSFER_IN = 'TRANSFER_IN',
    ADJUSTMENT_ADD = 'ADJUSTMENT_ADD',
    ADJUSTMENT_REMOVE = 'ADJUSTMENT_REMOVE',
    DAMAGE = 'DAMAGE',
    INTERNAL_MOVE = 'INTERNAL_MOVE',
}

export enum MovementStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    FAILED = 'FAILED',
}

export enum ReferenceType {
    ORDER = 'ORDER',
    PURCHASE_ORDER = 'PURCHASE_ORDER',
    RETURN = 'RETURN',
    TRANSFER = 'TRANSFER',
    ADJUSTMENT = 'ADJUSTMENT',
}

type MovementDirection = 'INBOUND' | 'OUTBOUND' | 'INTERNAL';

const INBOUND_TYPES: MovementType[] = [
    MovementType.RECEIVE,
    MovementType.RETURN,
    MovementType.TRANSFER_IN,
    MovementType.ADJUSTMENT_ADD,
];

const OUTBOUND_TYPES: MovementType[] = [
    MovementType.SHIP,
    MovementType.TRANSFER_OUT,
    MovementType.ADJUSTMENT_REMOVE,
    MovementType.DAMAGE,
];

export interface MovementInput {
    warehouseId: string;
    sku: string;
    quantity: number;
    type: MovementType;
    targetWarehouseId?: string;
    sourceZone?: string;
    targetZone?: string;
    referenceId?: string;
    referenceType?: ReferenceType;
    reason: string;
    notes?: string;
    scheduledAt?: Date;
}

export interface MovementResult {
    success: boolean;
    movementId?: string;
    status?: MovementStatus;
    error?: string;
}

export interface TransferInput {
    sourceWarehouseId: string;
    targetWarehouseId: string;
    sku: string;
    quantity: number;
    reason: string;
    scheduledAt?: Date;
}

export interface TransferResult {
    success: boolean;
    transferOutId?: string;
    transferInId?: string;
    error?: string;
}

export interface ExecuteResult {
    success: boolean;
    status?: MovementStatus;
    error?: string;
}

export interface MovementQueryFilters {
    warehouseId?: string;
    sku?: string;
    type?: MovementType;
    status?: MovementStatus;
    startDate?: Date;
    endDate?: Date;
    referenceId?: string;
    page?: number;
    pageSize?: number;
}

export interface MovementContext {
    organizationId: string;
    userId: string;
}

export interface MovementSummary {
    totalInbound: number;
    totalOutbound: number;
    netChange: number;
    byType: Record<string, { count: number; quantity: number }>;
}

export interface ApprovalConfig {
    requiresApproval: boolean;
    approvalThreshold?: number;
    approvalRoles?: string[];
}

export interface ZoneConfig {
    zoneEnabled: boolean;
}

@Injectable()
export class StockMovementService implements OnModuleInit {
    // Configuration (future-ready)
    private approvalConfig: ApprovalConfig = {
        requiresApproval: false, // MVP: no approval required
    };

    private zoneConfig: ZoneConfig = {
        zoneEnabled: false, // MVP: warehouse-level only
    };

    private availableReferenceTypes: ReferenceType[] = [
        ReferenceType.ORDER,
        ReferenceType.PURCHASE_ORDER,
        ReferenceType.RETURN,
        ReferenceType.TRANSFER,
        ReferenceType.ADJUSTMENT,
    ];

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    onModuleInit() {
        // Load configuration from environment/database if needed
    }

    // =========================================================================
    // PUBLIC API - CONFIGURATION
    // =========================================================================

    getApprovalConfig(): ApprovalConfig {
        return { ...this.approvalConfig };
    }

    getZoneConfig(): ZoneConfig {
        return { ...this.zoneConfig };
    }

    getAvailableReferenceTypes(): ReferenceType[] {
        return [...this.availableReferenceTypes];
    }

    // =========================================================================
    // PUBLIC API - CREATE MOVEMENT
    // =========================================================================

    async createMovement(
        input: MovementInput,
        context: MovementContext
    ): Promise<MovementResult> {
        // Validation
        this.validateInput(input);
        this.validateContext(context);

        // Verify warehouse exists
        const warehouse = await this.prisma.warehouse.findFirst({
            where: {
                id: input.warehouseId,
                organizationId: context.organizationId,
            },
        });

        if (!warehouse) {
            return { success: false, error: 'Warehouse not found' };
        }

        // Determine direction
        const direction = this.getDirection(input.type);

        // For outbound movements, check stock availability
        if (direction === 'OUTBOUND') {
            const inventory = await this.prisma.inventoryItem.findFirst({
                where: {
                    warehouseId: input.warehouseId,
                    sku: input.sku,
                    organizationId: context.organizationId,
                },
            });

            if (!inventory) {
                return { success: false, error: `Inventory item not found for SKU: ${input.sku}` };
            }

            const available = inventory.quantity - (inventory.reservedQuantity || 0);
            if (input.quantity > available) {
                return {
                    success: false,
                    error: `Insufficient stock: ${available} available, ${input.quantity} requested`,
                };
            }
        }

        // For transfers, verify target warehouse
        if (input.type === MovementType.TRANSFER_OUT && input.targetWarehouseId) {
            const targetWarehouse = await this.prisma.warehouse.findFirst({
                where: {
                    id: input.targetWarehouseId,
                    organizationId: context.organizationId,
                },
            });

            if (!targetWarehouse) {
                return { success: false, error: 'Target warehouse not found' };
            }
        }

        // Create movement
        const movement = await this.prisma.stockMovement.create({
            data: {
                organizationId: context.organizationId,
                warehouseId: input.warehouseId,
                sku: input.sku,
                quantity: input.quantity,
                type: input.type,
                direction,
                status: MovementStatus.PENDING,
                targetWarehouseId: input.targetWarehouseId,
                sourceZone: input.sourceZone,
                targetZone: input.targetZone,
                referenceId: input.referenceId,
                referenceType: input.referenceType,
                reason: this.sanitizeText(input.reason),
                notes: input.notes ? this.sanitizeText(input.notes) : undefined,
                scheduledAt: input.scheduledAt,
                createdBy: context.userId,
                createdAt: new Date(),
            },
        });

        // Emit event
        this.eventEmitter.emit('movement.created', {
            movementId: movement.id,
            organizationId: context.organizationId,
            type: input.type,
            sku: input.sku,
            quantity: input.quantity,
        });

        return {
            success: true,
            movementId: movement.id,
            status: MovementStatus.PENDING,
        };
    }

    // =========================================================================
    // PUBLIC API - CREATE TRANSFER (Paired Movements)
    // =========================================================================

    async createTransfer(
        input: TransferInput,
        context: MovementContext
    ): Promise<TransferResult> {
        this.validateContext(context);

        if (!input.quantity || input.quantity <= 0) {
            throw new BadRequestException('Quantity must be greater than 0');
        }

        if (!input.reason || input.reason.trim() === '') {
            throw new BadRequestException('Reason is required');
        }

        if (input.sourceWarehouseId === input.targetWarehouseId) {
            return { success: false, error: 'Cannot transfer to same warehouse' };
        }

        // Verify source warehouse
        const sourceWarehouse = await this.prisma.warehouse.findFirst({
            where: {
                id: input.sourceWarehouseId,
                organizationId: context.organizationId,
            },
        });

        if (!sourceWarehouse) {
            return { success: false, error: 'Source warehouse not found' };
        }

        // Verify target warehouse
        const targetWarehouse = await this.prisma.warehouse.findFirst({
            where: {
                id: input.targetWarehouseId,
                organizationId: context.organizationId,
            },
        });

        if (!targetWarehouse) {
            return { success: false, error: 'Target warehouse not found' };
        }

        // Check source inventory
        const sourceInventory = await this.prisma.inventoryItem.findFirst({
            where: {
                warehouseId: input.sourceWarehouseId,
                sku: input.sku,
                organizationId: context.organizationId,
            },
        });

        if (!sourceInventory) {
            return { success: false, error: `Item not found at source: ${input.sku}` };
        }

        const available = sourceInventory.quantity - (sourceInventory.reservedQuantity || 0);
        if (input.quantity > available) {
            return {
                success: false,
                error: `Insufficient stock at source: ${available} available`,
            };
        }

        // Create paired movements
        const transferOut = await this.prisma.stockMovement.create({
            data: {
                organizationId: context.organizationId,
                warehouseId: input.sourceWarehouseId,
                sku: input.sku,
                quantity: input.quantity,
                type: MovementType.TRANSFER_OUT,
                direction: 'OUTBOUND',
                status: MovementStatus.PENDING,
                targetWarehouseId: input.targetWarehouseId,
                referenceType: ReferenceType.TRANSFER,
                reason: this.sanitizeText(input.reason),
                scheduledAt: input.scheduledAt,
                createdBy: context.userId,
                createdAt: new Date(),
            },
        });

        const transferIn = await this.prisma.stockMovement.create({
            data: {
                organizationId: context.organizationId,
                warehouseId: input.targetWarehouseId,
                sku: input.sku,
                quantity: input.quantity,
                type: MovementType.TRANSFER_IN,
                direction: 'INBOUND',
                status: MovementStatus.PENDING,
                linkedMovementId: transferOut.id,
                referenceType: ReferenceType.TRANSFER,
                reason: this.sanitizeText(input.reason),
                scheduledAt: input.scheduledAt,
                createdBy: context.userId,
                createdAt: new Date(),
            },
        });

        // Link movements both ways
        await this.prisma.stockMovement.update({
            where: { id: transferOut.id },
            data: { linkedMovementId: transferIn.id },
        });

        return {
            success: true,
            transferOutId: transferOut.id,
            transferInId: transferIn.id,
        };
    }

    // =========================================================================
    // PUBLIC API - EXECUTE MOVEMENT
    // =========================================================================

    async executeMovement(
        movementId: string,
        context: MovementContext
    ): Promise<ExecuteResult> {
        this.validateContext(context);

        const movement = await this.prisma.stockMovement.findFirst({
            where: {
                id: movementId,
                organizationId: context.organizationId,
            },
        });

        if (!movement) {
            return { success: false, error: 'Movement not found' };
        }

        if (movement.status === MovementStatus.COMPLETED) {
            return { success: false, error: 'Movement already completed' };
        }

        if (movement.status === MovementStatus.CANCELLED) {
            return { success: false, error: 'Movement was cancelled' };
        }

        if (movement.status !== MovementStatus.PENDING && movement.status !== MovementStatus.APPROVED) {
            return { success: false, error: `Cannot execute movement with status: ${movement.status}` };
        }

        try {
            await this.prisma.$transaction(async (tx) => {
                // Get current inventory
                const inventory = await tx.inventoryItem.findFirst({
                    where: {
                        warehouseId: movement.warehouseId,
                        sku: movement.sku,
                        organizationId: context.organizationId,
                    },
                });

                const direction = movement.direction as MovementDirection;

                if (direction === 'OUTBOUND') {
                    // For outbound, verify stock still available
                    if (!inventory) {
                        throw new Error('Inventory item not found');
                    }

                    const available = inventory.quantity - (inventory.reservedQuantity || 0);
                    if (movement.quantity > available) {
                        throw new Error(`Insufficient stock: ${available} available, ${movement.quantity} needed`);
                    }

                    // Decrease quantity
                    await tx.inventoryItem.update({
                        where: { id: inventory.id },
                        data: {
                            quantity: inventory.quantity - movement.quantity,
                        },
                    });
                } else if (direction === 'INBOUND') {
                    // For inbound, create or update inventory
                    if (inventory) {
                        await tx.inventoryItem.update({
                            where: { id: inventory.id },
                            data: {
                                quantity: inventory.quantity + movement.quantity,
                            },
                        });
                    } else {
                        // Create new inventory item
                        await tx.inventoryItem.create({
                            data: {
                                organizationId: context.organizationId,
                                warehouseId: movement.warehouseId,
                                sku: movement.sku,
                                quantity: movement.quantity,
                                reservedQuantity: 0,
                            },
                        });
                    }
                }

                // Update movement status
                await tx.stockMovement.update({
                    where: { id: movementId },
                    data: {
                        status: MovementStatus.COMPLETED,
                        executedAt: new Date(),
                        executedBy: context.userId,
                    },
                });

                // Create audit log
                await tx.inventoryAuditLog.create({
                    data: {
                        organizationId: context.organizationId,
                        warehouseId: movement.warehouseId,
                        userId: context.userId,
                        sku: movement.sku,
                        action: movement.type,
                        previousQuantity: inventory?.quantity || 0,
                        newQuantity: direction === 'INBOUND'
                            ? (inventory?.quantity || 0) + movement.quantity
                            : (inventory?.quantity || 0) - movement.quantity,
                        variance: direction === 'INBOUND' ? movement.quantity : -movement.quantity,
                        notes: `${movement.type}: ${movement.reason}`,
                        metadata: {
                            movementId,
                            referenceId: movement.referenceId,
                            referenceType: movement.referenceType,
                        },
                        createdAt: new Date(),
                    },
                });
            });

            // Emit event
            this.eventEmitter.emit('movement.completed', {
                movementId,
                organizationId: context.organizationId,
                type: movement.type,
                sku: movement.sku,
                quantity: movement.quantity,
            });

            this.eventEmitter.emit('inventory.updated', {
                organizationId: context.organizationId,
                warehouseId: movement.warehouseId,
                sku: movement.sku,
            });

            return { success: true, status: MovementStatus.COMPLETED };
        } catch (error) {
            // Mark as failed
            try {
                await this.prisma.stockMovement.update({
                    where: { id: movementId },
                    data: { status: MovementStatus.FAILED },
                });
            } catch {
                // Ignore secondary failure
            }

            return {
                success: false,
                status: MovementStatus.FAILED,
                error: `Execution failed: ${error.message}`,
            };
        }
    }

    // =========================================================================
    // PUBLIC API - CANCEL MOVEMENT
    // =========================================================================

    async cancelMovement(
        movementId: string,
        reason: string,
        context: MovementContext
    ): Promise<ExecuteResult> {
        this.validateContext(context);

        if (!reason || reason.trim() === '') {
            throw new BadRequestException('Cancellation reason is required');
        }

        const movement = await this.prisma.stockMovement.findFirst({
            where: {
                id: movementId,
                organizationId: context.organizationId,
            },
        });

        if (!movement) {
            return { success: false, error: 'Movement not found' };
        }

        if (movement.status === MovementStatus.COMPLETED) {
            return { success: false, error: 'Cannot cancel completed movement' };
        }

        if (movement.status === MovementStatus.CANCELLED) {
            return { success: false, error: 'Movement already cancelled' };
        }

        await this.prisma.stockMovement.update({
            where: { id: movementId },
            data: {
                status: MovementStatus.CANCELLED,
                cancelledAt: new Date(),
                cancelledBy: context.userId,
                cancellationReason: this.sanitizeText(reason),
            },
        });

        // Emit event
        this.eventEmitter.emit('movement.cancelled', {
            movementId,
            organizationId: context.organizationId,
            reason,
        });

        return { success: true, status: MovementStatus.CANCELLED };
    }

    // =========================================================================
    // PUBLIC API - QUERY
    // =========================================================================

    async getMovements(
        filters: MovementQueryFilters,
        context: MovementContext
    ): Promise<{ items: any[]; total: number }> {
        this.validateContext(context);

        const where: any = {
            organizationId: context.organizationId,
        };

        if (filters.warehouseId) {
            where.warehouseId = filters.warehouseId;
        }

        if (filters.sku) {
            where.sku = filters.sku;
        }

        if (filters.type) {
            where.type = filters.type;
        }

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.referenceId) {
            where.referenceId = filters.referenceId;
        }

        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                where.createdAt.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.createdAt.lte = filters.endDate;
            }
        }

        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;
        const skip = (page - 1) * pageSize;

        const [items, total] = await Promise.all([
            this.prisma.stockMovement.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.stockMovement.count({ where }),
        ]);

        return { items, total };
    }

    async getMovementSummary(
        query: { warehouseId?: string; startDate?: Date; endDate?: Date },
        context: MovementContext
    ): Promise<MovementSummary> {
        this.validateContext(context);

        const where: any = {
            organizationId: context.organizationId,
            status: MovementStatus.COMPLETED,
        };

        if (query.warehouseId) {
            where.warehouseId = query.warehouseId;
        }

        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) {
                where.createdAt.gte = query.startDate;
            }
            if (query.endDate) {
                where.createdAt.lte = query.endDate;
            }
        }

        const movements = await this.prisma.stockMovement.findMany({
            where,
            select: {
                type: true,
                direction: true,
                quantity: true,
            },
        });

        let totalInbound = 0;
        let totalOutbound = 0;
        const byType: Record<string, { count: number; quantity: number }> = {};

        for (const mov of movements) {
            // Aggregate by direction
            if (mov.direction === 'INBOUND') {
                totalInbound += mov.quantity;
            } else if (mov.direction === 'OUTBOUND') {
                totalOutbound += mov.quantity;
            }

            // Aggregate by type
            if (!byType[mov.type]) {
                byType[mov.type] = { count: 0, quantity: 0 };
            }
            byType[mov.type].count++;
            byType[mov.type].quantity += mov.quantity;
        }

        return {
            totalInbound,
            totalOutbound,
            netChange: totalInbound - totalOutbound,
            byType,
        };
    }

    async getSkuMovements(
        sku: string,
        options: { warehouseId?: string; limit?: number },
        context: MovementContext
    ): Promise<any[]> {
        this.validateContext(context);

        const where: any = {
            organizationId: context.organizationId,
            sku,
        };

        if (options.warehouseId) {
            where.warehouseId = options.warehouseId;
        }

        return this.prisma.stockMovement.findMany({
            where,
            take: options.limit || 50,
            orderBy: { createdAt: 'desc' },
        });
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private getDirection(type: MovementType): MovementDirection {
        if (INBOUND_TYPES.includes(type)) {
            return 'INBOUND';
        }
        if (OUTBOUND_TYPES.includes(type)) {
            return 'OUTBOUND';
        }
        return 'INTERNAL';
    }

    private validateInput(input: MovementInput): void {
        if (!input.quantity || input.quantity <= 0) {
            throw new BadRequestException('Quantity must be greater than 0');
        }

        if (!input.reason || input.reason.trim() === '') {
            throw new BadRequestException('Reason is required');
        }

        if (!input.warehouseId || input.warehouseId.trim() === '') {
            throw new BadRequestException('Warehouse ID is required');
        }

        if (!input.sku || input.sku.trim() === '') {
            throw new BadRequestException('SKU is required');
        }
    }

    private validateContext(context: MovementContext): void {
        if (!context.organizationId || context.organizationId.trim() === '') {
            throw new BadRequestException('Organization ID is required');
        }
        if (!context.userId || context.userId.trim() === '') {
            throw new BadRequestException('User ID is required');
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
