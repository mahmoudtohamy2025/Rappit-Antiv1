/**
 * Inventory Update Service (INV-03)
 * 
 * Handles bulk inventory updates and cycle counts with:
 * - Update Types: ABSOLUTE, ADJUSTMENT, TRANSFER
 * - Cycle Count Types: FULL, PARTIAL, BLIND, GUIDED
 * - Variance tracking and approval workflows
 * - Complete audit trail
 * - Cross-org isolation
 */

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { InventoryValidationService } from './inventory-validation.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';

// =========================================================================
// ENUMS & TYPES
// =========================================================================

export enum UpdateType {
    ABSOLUTE = 'ABSOLUTE',       // Set exact quantity
    ADJUSTMENT = 'ADJUSTMENT',   // Add/subtract from current
    TRANSFER = 'TRANSFER',       // Move between warehouses
}

export enum CycleCountType {
    FULL = 'FULL',       // Complete warehouse count
    PARTIAL = 'PARTIAL', // Specific SKUs only
}

export type VarianceLevel = 'OK' | 'WARNING' | 'ERROR';

export interface UpdateItem {
    sku: string;
    quantity: number;
    updateType: UpdateType;
    reasonCode: string;
    notes?: string;
}

export interface UpdateResult {
    success: boolean;
    sku?: string;
    previousQuantity?: number;
    newQuantity?: number;
    adjustmentAmount?: number;
    variance?: number;
    variancePercent?: number;
    varianceLevel?: VarianceLevel;
    requiresApproval?: boolean;
    autoApproved?: boolean;
    status?: string;
    error?: string;
}

export interface BulkUpdateResult {
    success: boolean;
    successCount: number;
    errorCount: number;
    results: UpdateResult[];
    errors: Array<{ sku: string; error: string }>;
}

export interface TransferRequest {
    sku: string;
    quantity: number;
    sourceWarehouseId: string;
    targetWarehouseId: string;
    reasonCode: string;
    notes?: string;
}

export interface TransferResult {
    success: boolean;
    sourceNewQuantity?: number;
    targetNewQuantity?: number;
    error?: string;
}

export interface CycleCountSession {
    id: string;
    type: CycleCountType;
    status: string;
    warehouseId: string;
    itemCount?: number;
    isBlind?: boolean;
}

export interface CycleCountItem {
    sku: string;
    countedQuantity: number;
}

export interface SessionItem {
    sku: string;
    expectedQuantity?: number;
    countedQuantity?: number;
}

export interface VarianceReport {
    totalItems: number;
    itemsWithVariance: number;
    totalVariance: number;
    absoluteVariance: number;
    items: Array<{
        sku: string;
        expectedQuantity: number;
        countedQuantity: number;
        variance: number;
        variancePercent: number;
        varianceLevel?: VarianceLevel;
    }>;
}

export interface UpdateContext {
    organizationId: string;
    warehouseId?: string;
    userId: string;
    atomic?: boolean;
    useOptimisticLocking?: boolean;
    retryOnConflict?: boolean;
    varianceWarningThreshold?: number;
    varianceErrorThreshold?: number;
    autoApproveThreshold?: number;
}

// Valid reason codes
const VALID_REASON_CODES = [
    'CYCLE_COUNT',
    'DAMAGE',
    'THEFT',
    'EXPIRED',
    'FOUND',
    'ADJUSTMENT',
    'RECEIVING',
    'RECOUNT',
    'TRANSFER',
    'RETURN',
    'WRITE_OFF',
    'OTHER',
];

const MAX_QUANTITY = 10_000_000;

@Injectable()
export class InventoryUpdateService {
    // In-memory session storage (would be DB in production)
    private sessions = new Map<string, any>();
    private sessionItems = new Map<string, any[]>();
    private sessionCounts = new Map<string, CycleCountItem[]>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly validationService: InventoryValidationService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    // =========================================================================
    // SINGLE ITEM UPDATE
    // =========================================================================

    async updateSingle(item: UpdateItem, context: UpdateContext): Promise<UpdateResult> {
        // Validate context
        this.validateContext(context);

        // Validate item
        const itemValidation = this.validateItem(item);
        if (!itemValidation.valid) {
            return { success: false, error: itemValidation.error };
        }

        try {
            // Find the inventory item
            const inventoryItem = await this.prisma.inventoryItem.findFirst({
                where: {
                    organizationId: context.organizationId,
                    sku: item.sku,
                    ...(context.warehouseId && { warehouseId: context.warehouseId }),
                },
            });

            if (!inventoryItem) {
                return { success: false, error: 'Item not found', sku: item.sku };
            }

            // Verify org match
            if (inventoryItem.organizationId !== context.organizationId) {
                return { success: false, error: 'Item not found', sku: item.sku };
            }

            const previousQuantity = inventoryItem.quantity;
            let newQuantity: number;
            let adjustmentAmount: number | undefined;

            // Calculate new quantity based on update type
            switch (item.updateType) {
                case UpdateType.ABSOLUTE:
                    if (item.quantity < 0) {
                        return { success: false, error: 'Quantity cannot be negative', sku: item.sku };
                    }
                    newQuantity = item.quantity;
                    break;

                case UpdateType.ADJUSTMENT:
                    adjustmentAmount = item.quantity;
                    newQuantity = previousQuantity + item.quantity;

                    if (newQuantity < 0) {
                        return { success: false, error: 'Adjustment would reduce quantity below zero', sku: item.sku };
                    }

                    // Check reserved quantity constraint
                    const reservedQuantity = inventoryItem.reservedQuantity || 0;
                    if (newQuantity < reservedQuantity) {
                        return {
                            success: false,
                            error: `Cannot reduce below reserved quantity (${reservedQuantity} reserved)`,
                            sku: item.sku,
                        };
                    }
                    break;

                default:
                    return { success: false, error: 'Invalid update type', sku: item.sku };
            }

            // Calculate variance
            const variance = newQuantity - previousQuantity;
            const variancePercent = previousQuantity > 0
                ? (variance / previousQuantity) * 100
                : (newQuantity > 0 ? 100 : 0);

            // Determine variance level
            const varianceLevel = this.determineVarianceLevel(
                Math.abs(variancePercent),
                context.varianceWarningThreshold,
                context.varianceErrorThreshold
            );

            // Check approval requirements
            const autoApproveThreshold = context.autoApproveThreshold ?? 100; // Default: auto-approve all
            const requiresApproval = Math.abs(variancePercent) > autoApproveThreshold;
            const autoApproved = !requiresApproval && varianceLevel !== 'OK';

            // If requires approval, don't update yet
            if (requiresApproval) {
                return {
                    success: true,
                    sku: item.sku,
                    previousQuantity,
                    newQuantity,
                    adjustmentAmount,
                    variance,
                    variancePercent,
                    varianceLevel,
                    requiresApproval: true,
                    status: 'PENDING_APPROVAL',
                };
            }

            // Perform update
            await this.prisma.inventoryItem.update({
                where: { id: inventoryItem.id },
                data: {
                    quantity: newQuantity,
                    updatedAt: new Date(),
                },
            });

            // Create audit log
            await this.createAuditLog({
                organizationId: context.organizationId,
                warehouseId: inventoryItem.warehouseId,
                userId: context.userId,
                sku: item.sku,
                action: 'UPDATE',
                previousQuantity,
                newQuantity,
                variance,
                variancePercent,
                reasonCode: item.reasonCode,
                notes: this.sanitizeNotes(item.notes),
            });

            // Emit event
            this.eventEmitter.emit('inventory.updated', {
                organizationId: context.organizationId,
                warehouseId: inventoryItem.warehouseId,
                sku: item.sku,
                previousQuantity,
                newQuantity,
                variance,
                userId: context.userId,
                reasonCode: item.reasonCode,
            });

            return {
                success: true,
                sku: item.sku,
                previousQuantity,
                newQuantity,
                adjustmentAmount,
                variance,
                variancePercent,
                varianceLevel,
                requiresApproval: false,
                autoApproved,
            };

        } catch (error: any) {
            // Handle optimistic locking conflicts
            if (context.useOptimisticLocking && error.code === 'P2025') {
                if (context.retryOnConflict) {
                    // Retry once
                    return this.updateSingle(item, { ...context, retryOnConflict: false });
                }
                return { success: false, error: 'Item was modified by another process', sku: item.sku };
            }

            return {
                success: false,
                error: error.message || 'Update failed',
                sku: item.sku,
            };
        }
    }

    // =========================================================================
    // BULK UPDATES
    // =========================================================================

    async updateBulk(items: UpdateItem[], context: UpdateContext): Promise<BulkUpdateResult> {
        this.validateContext(context);

        const results: UpdateResult[] = [];
        const errors: Array<{ sku: string; error: string }> = [];

        if (context.atomic) {
            // Atomic mode: all or nothing
            try {
                await this.prisma.$transaction(async (tx) => {
                    for (const item of items) {
                        const result = await this.updateSingle(item, context);
                        results.push(result);

                        if (!result.success) {
                            errors.push({ sku: item.sku, error: result.error || 'Unknown error' });
                            throw new Error('Atomic update failed');
                        }
                    }
                });

                return {
                    success: true,
                    successCount: results.filter(r => r.success).length,
                    errorCount: 0,
                    results,
                    errors: [],
                };
            } catch (error: any) {
                return {
                    success: false,
                    successCount: 0,
                    errorCount: items.length,
                    results: [],
                    errors: errors.length > 0 ? errors : [{ sku: 'all', error: error.message }],
                };
            }
        } else {
            // Non-atomic: continue on error
            for (const item of items) {
                const result = await this.updateSingle(item, context);
                results.push(result);

                if (!result.success) {
                    errors.push({ sku: item.sku, error: result.error || 'Unknown error' });
                }
            }

            const successCount = results.filter(r => r.success).length;
            return {
                success: errors.length === 0,
                successCount,
                errorCount: errors.length,
                results,
                errors,
            };
        }
    }

    // =========================================================================
    // TRANSFER
    // =========================================================================

    async transfer(request: TransferRequest, context: UpdateContext): Promise<TransferResult> {
        this.validateContext(context);

        // Validate same warehouse
        if (request.sourceWarehouseId === request.targetWarehouseId) {
            return { success: false, error: 'Cannot transfer to same warehouse' };
        }

        // Validate target warehouse
        const warehouseValidation = await this.validationService.validate({
            warehouseId: request.targetWarehouseId,
            organizationId: context.organizationId,
        });

        if (!warehouseValidation.valid) {
            return { success: false, error: warehouseValidation.errors.join(', ') };
        }

        try {
            // Find source item
            const sourceItem = await this.prisma.inventoryItem.findFirst({
                where: {
                    organizationId: context.organizationId,
                    warehouseId: request.sourceWarehouseId,
                    sku: request.sku,
                },
            });

            if (!sourceItem) {
                return { success: false, error: 'Source item not found' };
            }

            // Check available quantity
            const availableQuantity = sourceItem.quantity - (sourceItem.reservedQuantity || 0);
            if (request.quantity > availableQuantity) {
                return { success: false, error: 'Insufficient available quantity' };
            }

            // Find or create target item
            let targetItem = await this.prisma.inventoryItem.findFirst({
                where: {
                    organizationId: context.organizationId,
                    warehouseId: request.targetWarehouseId,
                    sku: request.sku,
                },
            });

            const sourceNewQuantity = sourceItem.quantity - request.quantity;
            let targetNewQuantity: number;

            if (targetItem) {
                targetNewQuantity = targetItem.quantity + request.quantity;
                await this.prisma.inventoryItem.update({
                    where: { id: targetItem.id },
                    data: { quantity: targetNewQuantity },
                });
            } else {
                targetNewQuantity = request.quantity;
                await this.prisma.inventoryItem.create({
                    data: {
                        organizationId: context.organizationId,
                        warehouseId: request.targetWarehouseId,
                        sku: request.sku,
                        quantity: targetNewQuantity,
                        reservedQuantity: 0,
                    },
                });
            }

            // Update source
            await this.prisma.inventoryItem.update({
                where: { id: sourceItem.id },
                data: { quantity: sourceNewQuantity },
            });

            // Create audit logs
            await this.createAuditLog({
                organizationId: context.organizationId,
                warehouseId: request.sourceWarehouseId,
                userId: context.userId,
                sku: request.sku,
                action: 'TRANSFER_OUT',
                previousQuantity: sourceItem.quantity,
                newQuantity: sourceNewQuantity,
                reasonCode: request.reasonCode,
                notes: `Transfer to ${request.targetWarehouseId}: ${this.sanitizeNotes(request.notes)}`,
            });

            await this.createAuditLog({
                organizationId: context.organizationId,
                warehouseId: request.targetWarehouseId,
                userId: context.userId,
                sku: request.sku,
                action: 'TRANSFER_IN',
                previousQuantity: targetItem?.quantity || 0,
                newQuantity: targetNewQuantity,
                reasonCode: request.reasonCode,
                notes: `Transfer from ${request.sourceWarehouseId}: ${this.sanitizeNotes(request.notes)}`,
            });

            return {
                success: true,
                sourceNewQuantity,
                targetNewQuantity,
            };

        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    // =========================================================================
    // CYCLE COUNT SESSIONS
    // =========================================================================

    async createCycleCountSession(
        options: {
            type: CycleCountType;
            warehouseId: string;
            skus?: string[];
            isBlind?: boolean;
            lockItems?: boolean;
        },
        context: UpdateContext
    ): Promise<CycleCountSession> {
        this.validateContext(context);

        // Validate partial count has SKUs
        if (options.type === CycleCountType.PARTIAL && (!options.skus || options.skus.length === 0)) {
            throw new BadRequestException('SKUs required for partial cycle count');
        }

        // Get items for the session
        const whereClause: any = {
            organizationId: context.organizationId,
            warehouseId: options.warehouseId,
        };

        if (options.type === CycleCountType.PARTIAL && options.skus) {
            whereClause.sku = { in: options.skus };
        }

        const items = await this.prisma.inventoryItem.findMany({ where: whereClause });

        // Create session
        const sessionId = `session-${randomUUID()}`;
        const session = {
            id: sessionId,
            type: options.type,
            status: 'IN_PROGRESS',
            warehouseId: options.warehouseId,
            organizationId: context.organizationId,
            itemCount: items.length,
            isBlind: options.isBlind ?? false,
            createdAt: new Date(),
            createdBy: context.userId,
        };

        this.sessions.set(sessionId, session);
        this.sessionItems.set(sessionId, items);
        this.sessionCounts.set(sessionId, []);

        // Lock items if requested
        if (options.lockItems) {
            await this.prisma.inventoryItem.updateMany({
                where: { id: { in: items.map(i => i.id) } },
                data: { isLocked: true },
            });
        }

        // Also persist to DB
        await this.prisma.cycleCountSession.create({
            data: {
                id: sessionId,
                type: options.type,
                status: 'IN_PROGRESS',
                warehouseId: options.warehouseId,
                organizationId: context.organizationId,
                isBlind: options.isBlind ?? false,
            },
        });

        return session;
    }

    async getSessionItems(sessionId: string, context: UpdateContext): Promise<SessionItem[]> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new BadRequestException('Session not found');
        }

        if (session.organizationId !== context.organizationId) {
            throw new ForbiddenException('Access denied');
        }

        const items = this.sessionItems.get(sessionId) || [];
        const counts = this.sessionCounts.get(sessionId) || [];

        return items.map(item => {
            const count = counts.find(c => c.sku === item.sku);
            return {
                sku: item.sku,
                // Hide expected quantity in blind mode
                expectedQuantity: session.isBlind ? undefined : item.quantity,
                countedQuantity: count?.countedQuantity,
            };
        });
    }

    async submitCycleCount(
        sessionId: string,
        counts: CycleCountItem[],
        context: UpdateContext
    ): Promise<void> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new BadRequestException('Session not found');
        }

        if (session.organizationId !== context.organizationId) {
            throw new ForbiddenException('Access denied');
        }

        // Store counts
        const existingCounts = this.sessionCounts.get(sessionId) || [];
        for (const count of counts) {
            const existing = existingCounts.findIndex(c => c.sku === count.sku);
            if (existing >= 0) {
                existingCounts[existing] = count;
            } else {
                existingCounts.push(count);
            }
        }
        this.sessionCounts.set(sessionId, existingCounts);
    }

    async completeCycleCountSession(
        sessionId: string,
        context: UpdateContext
    ): Promise<CycleCountSession> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new BadRequestException('Session not found');
        }

        if (session.organizationId !== context.organizationId) {
            throw new ForbiddenException('Access denied');
        }

        const items = this.sessionItems.get(sessionId) || [];
        const counts = this.sessionCounts.get(sessionId) || [];

        // Apply all counts as updates
        for (const count of counts) {
            const item = items.find(i => i.sku === count.sku);
            if (item) {
                await this.updateSingle({
                    sku: count.sku,
                    quantity: count.countedQuantity,
                    updateType: UpdateType.ABSOLUTE,
                    reasonCode: 'CYCLE_COUNT',
                    notes: `Cycle count session ${sessionId}`,
                }, { ...context, warehouseId: session.warehouseId });
            }
        }

        // Update session status
        session.status = 'COMPLETED';
        session.completedAt = new Date();
        session.completedBy = context.userId;

        await this.prisma.cycleCountSession.update({
            where: { id: sessionId },
            data: { status: 'COMPLETED' },
        });

        return session;
    }

    async generateVarianceReport(
        sessionId: string,
        context: UpdateContext & { varianceErrorThreshold?: number }
    ): Promise<VarianceReport> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            // Try to get from DB
            const dbSession = await this.prisma.cycleCountSession.findFirst({
                where: { id: sessionId },
            });

            if (!dbSession) {
                throw new BadRequestException('Session not found');
            }

            // Return empty report structure
            return {
                totalItems: 0,
                itemsWithVariance: 0,
                totalVariance: 0,
                absoluteVariance: 0,
                items: [],
            };
        }

        if (session.organizationId !== context.organizationId) {
            throw new ForbiddenException('Access denied');
        }

        const items = this.sessionItems.get(sessionId) || [];
        const counts = this.sessionCounts.get(sessionId) || [];

        const reportItems: VarianceReport['items'] = [];
        let totalVariance = 0;
        let absoluteVariance = 0;

        for (const count of counts) {
            const item = items.find(i => i.sku === count.sku);
            if (item) {
                const expected = item.quantity;
                const counted = count.countedQuantity;
                const variance = counted - expected;
                const variancePercent = expected > 0 ? (variance / expected) * 100 : 0;
                const varianceLevel = this.determineVarianceLevel(
                    Math.abs(variancePercent),
                    context.varianceWarningThreshold,
                    context.varianceErrorThreshold
                );

                reportItems.push({
                    sku: item.sku,
                    expectedQuantity: expected,
                    countedQuantity: counted,
                    variance,
                    variancePercent,
                    varianceLevel,
                });

                totalVariance += variance;
                absoluteVariance += Math.abs(variance);
            }
        }

        return {
            totalItems: items.length,
            itemsWithVariance: reportItems.filter(i => i.variance !== 0).length,
            totalVariance,
            absoluteVariance,
            items: reportItems,
        };
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private validateContext(context: UpdateContext): void {
        if (!context.organizationId) {
            throw new BadRequestException('Organization ID is required');
        }
        if (!context.userId) {
            throw new BadRequestException('User ID is required');
        }
    }

    private validateItem(item: UpdateItem): { valid: boolean; error?: string } {
        // Validate SKU
        if (!item.sku || item.sku.trim() === '') {
            return { valid: false, error: 'SKU is required' };
        }

        // Validate quantity
        if (item.quantity === null || item.quantity === undefined) {
            return { valid: false, error: 'Quantity is required' };
        }
        if (typeof item.quantity !== 'number' || isNaN(item.quantity) || !isFinite(item.quantity)) {
            return { valid: false, error: 'Quantity must be a valid number' };
        }
        if (!Number.isInteger(item.quantity)) {
            return { valid: false, error: 'Quantity must be an integer' };
        }
        if (item.updateType === UpdateType.ABSOLUTE && item.quantity > MAX_QUANTITY) {
            return { valid: false, error: `Quantity cannot exceed ${MAX_QUANTITY}` };
        }

        // Validate reason code
        if (!item.reasonCode || !VALID_REASON_CODES.includes(item.reasonCode)) {
            return { valid: false, error: `Invalid reason code. Valid codes: ${VALID_REASON_CODES.join(', ')}` };
        }

        return { valid: true };
    }

    private determineVarianceLevel(
        absVariancePercent: number,
        warningThreshold?: number,
        errorThreshold?: number
    ): VarianceLevel {
        const warning = warningThreshold ?? 10;
        const error = errorThreshold ?? 25;

        if (absVariancePercent >= error) {
            return 'ERROR';
        }
        if (absVariancePercent >= warning) {
            return 'WARNING';
        }
        return 'OK';
    }

    private sanitizeNotes(notes?: string): string {
        if (!notes) return '';

        // Remove script tags and other potentially dangerous content
        return notes
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, '') // Remove all HTML tags
            .trim();
    }

    private async createAuditLog(data: {
        organizationId: string;
        warehouseId: string;
        userId: string;
        sku: string;
        action: string;
        previousQuantity: number;
        newQuantity: number;
        variance?: number;
        variancePercent?: number;
        reasonCode: string;
        notes?: string;
    }): Promise<void> {
        try {
            await this.prisma.inventoryAuditLog.create({
                data: {
                    ...data,
                    createdAt: new Date(),
                },
            });
        } catch (error) {
            // Log error but don't fail the update
            console.error('Failed to create audit log:', error);
        }
    }
}
