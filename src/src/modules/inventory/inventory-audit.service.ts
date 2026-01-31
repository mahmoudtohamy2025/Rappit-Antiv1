/**
 * Inventory Audit Service (INV-07)
 * 
 * Comprehensive audit trail for inventory operations:
 * - Immutable audit log entries
 * - Query with filters, pagination, sorting
 * - Aggregations and variance summaries
 * - Event-driven automatic logging
 * - Export capabilities (CSV, JSON)
 * - Retention policy management
 */

import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

// =========================================================================
// ENUMS & TYPES
// =========================================================================

export enum AuditAction {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    TRANSFER = 'TRANSFER',
    RESERVE = 'RESERVE',
    RELEASE = 'RELEASE',
    IMPORT = 'IMPORT',
}

const VALID_ACTIONS = Object.values(AuditAction);

export interface AuditEntry {
    id: string;
    organizationId: string;
    warehouseId: string;
    userId: string;
    sku: string;
    action: AuditAction;
    previousQuantity: number;
    newQuantity: number;
    previousReserved?: number;
    newReserved?: number;
    variance: number;
    variancePercent: number;
    reasonCode: string;
    notes?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}

export interface AuditLogInput {
    sku: string;
    warehouseId: string;
    action: AuditAction;
    previousQuantity: number;
    newQuantity: number;
    previousReserved?: number;
    newReserved?: number;
    reasonCode: string;
    notes?: string;
    metadata?: Record<string, any>;
}

export interface AuditQuery {
    sku?: string;
    warehouseId?: string;
    action?: AuditAction;
    userId?: string;
    reasonCode?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface AuditQueryResult {
    items: AuditEntry[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
}

export interface AuditSummary {
    totalVariance: number;
    absoluteVariance: number;
    itemCount: number;
    positiveVariance: number;
    negativeVariance: number;
}

export interface ActivityByUser {
    userId: string;
    count: number;
}

export interface ActivityByAction {
    action: AuditAction;
    count: number;
}

export interface DailyTrend {
    date: Date;
    count: number;
}

export interface RetentionPolicy {
    retentionDays: number;
    archiveEnabled: boolean;
}

export interface AuditContext {
    organizationId: string;
    userId: string;
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_RETENTION_DAYS = 2555; // ~7 years

@Injectable()
export class InventoryAuditService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    onModuleInit() {
        // Register event listeners
        this.eventEmitter.on('inventory.updated', this.handleInventoryUpdated.bind(this));
        this.eventEmitter.on('inventory.created', this.handleInventoryCreated.bind(this));
        this.eventEmitter.on('inventory.import.completed', this.handleImportCompleted.bind(this));
    }

    // =========================================================================
    // AUDIT LOGGING
    // =========================================================================

    async logChange(input: AuditLogInput, context: AuditContext): Promise<AuditEntry> {
        // Validate context
        this.validateContext(context);

        // Validate input
        this.validateInput(input);

        // Calculate variance
        const variance = input.newQuantity - input.previousQuantity;
        const variancePercent = input.previousQuantity > 0
            ? (variance / input.previousQuantity) * 100
            : (input.newQuantity > 0 ? 100 : 0);

        // Sanitize notes
        const sanitizedNotes = this.sanitizeNotes(input.notes);

        const entry = await this.prisma.inventoryAuditLog.create({
            data: {
                organizationId: context.organizationId,
                warehouseId: input.warehouseId,
                userId: context.userId,
                sku: input.sku,
                action: input.action,
                previousQuantity: input.previousQuantity,
                newQuantity: input.newQuantity,
                previousReserved: input.previousReserved,
                newReserved: input.newReserved,
                variance,
                variancePercent,
                reasonCode: input.reasonCode,
                notes: sanitizedNotes,
                metadata: input.metadata || {},
                createdAt: new Date(),
            },
        });

        return entry as AuditEntry;
    }

    async logBulkChanges(inputs: AuditLogInput[], context: AuditContext): Promise<{ count: number }> {
        this.validateContext(context);

        const data = inputs.map(input => {
            this.validateInput(input);

            const variance = input.newQuantity - input.previousQuantity;
            const variancePercent = input.previousQuantity > 0
                ? (variance / input.previousQuantity) * 100
                : (input.newQuantity > 0 ? 100 : 0);

            return {
                organizationId: context.organizationId,
                warehouseId: input.warehouseId,
                userId: context.userId,
                sku: input.sku,
                action: input.action,
                previousQuantity: input.previousQuantity,
                newQuantity: input.newQuantity,
                previousReserved: input.previousReserved,
                newReserved: input.newReserved,
                variance,
                variancePercent,
                reasonCode: input.reasonCode,
                notes: this.sanitizeNotes(input.notes),
                metadata: input.metadata || {},
                createdAt: new Date(),
            };
        });

        return await this.prisma.$transaction(async (tx) => {
            return await tx.inventoryAuditLog.createMany({ data });
        });
    }

    // =========================================================================
    // IMMUTABILITY ENFORCEMENT
    // =========================================================================

    async updateEntry(id: string, data: any, context: AuditContext): Promise<never> {
        throw new BadRequestException('Audit entries are immutable and cannot be updated');
    }

    async deleteEntry(id: string, context: AuditContext): Promise<never> {
        throw new BadRequestException('Audit entries are immutable and cannot be deleted');
    }

    // =========================================================================
    // QUERY FEATURES
    // =========================================================================

    async query(query: AuditQuery, context: AuditContext): Promise<AuditQueryResult> {
        this.validateContext(context);

        // Handle invalid date range
        if (query.startDate && query.endDate && query.startDate > query.endDate) {
            return {
                items: [],
                totalItems: 0,
                totalPages: 0,
                currentPage: query.page || 1,
                pageSize: query.pageSize || DEFAULT_PAGE_SIZE,
            };
        }

        // Build where clause
        const where: any = {
            organizationId: context.organizationId,
        };

        if (query.sku) where.sku = query.sku;
        if (query.warehouseId) where.warehouseId = query.warehouseId;
        if (query.action) where.action = query.action;
        if (query.userId) where.userId = query.userId;
        if (query.reasonCode) where.reasonCode = query.reasonCode;

        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) where.createdAt.gte = query.startDate;
            if (query.endDate) where.createdAt.lte = query.endDate;
        }

        // Pagination
        const page = Math.max(1, query.page || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize || DEFAULT_PAGE_SIZE));
        const skip = (page - 1) * pageSize;

        // Sorting
        const sortBy = query.sortBy || 'createdAt';
        const sortOrder = query.sortOrder || 'desc';
        const orderBy = { [sortBy]: sortOrder };

        // Execute query
        const [items, totalItems] = await Promise.all([
            this.prisma.inventoryAuditLog.findMany({
                where,
                skip,
                take: pageSize,
                orderBy,
            }),
            this.prisma.inventoryAuditLog.count({ where }),
        ]);

        return {
            items: items as AuditEntry[],
            totalItems,
            totalPages: Math.ceil(totalItems / pageSize),
            currentPage: page,
            pageSize,
        };
    }

    // =========================================================================
    // AGGREGATIONS
    // =========================================================================

    async getVarianceSummary(
        query: { startDate?: Date; endDate?: Date },
        context: AuditContext
    ): Promise<AuditSummary> {
        this.validateContext(context);

        const where: any = { organizationId: context.organizationId };
        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) where.createdAt.gte = query.startDate;
            if (query.endDate) where.createdAt.lte = query.endDate;
        }

        const result = await this.prisma.inventoryAuditLog.aggregate({
            where,
            _sum: { variance: true },
            _count: { id: true },
        });

        // Get positive and negative variance separately
        const entries = await this.prisma.inventoryAuditLog.findMany({
            where,
            select: { variance: true },
        });

        let positiveVariance = 0;
        let negativeVariance = 0;
        let absoluteVariance = 0;

        entries.forEach((e: any) => {
            if (e.variance > 0) positiveVariance += e.variance;
            if (e.variance < 0) negativeVariance += e.variance;
            absoluteVariance += Math.abs(e.variance || 0);
        });

        return {
            totalVariance: result._sum.variance || 0,
            absoluteVariance,
            itemCount: result._count.id || 0,
            positiveVariance,
            negativeVariance,
        };
    }

    async getActivityByUser(
        query: { startDate?: Date; endDate?: Date },
        context: AuditContext
    ): Promise<ActivityByUser[]> {
        this.validateContext(context);

        const where: any = { organizationId: context.organizationId };
        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) where.createdAt.gte = query.startDate;
            if (query.endDate) where.createdAt.lte = query.endDate;
        }

        const result = await this.prisma.inventoryAuditLog.groupBy({
            by: ['userId'],
            where,
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        });

        return result.map((r: any) => ({
            userId: r.userId,
            count: r._count.id,
        }));
    }

    async getActivityByAction(
        query: { startDate?: Date; endDate?: Date },
        context: AuditContext
    ): Promise<ActivityByAction[]> {
        this.validateContext(context);

        const where: any = { organizationId: context.organizationId };
        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) where.createdAt.gte = query.startDate;
            if (query.endDate) where.createdAt.lte = query.endDate;
        }

        const result = await this.prisma.inventoryAuditLog.groupBy({
            by: ['action'],
            where,
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        });

        return result.map((r: any) => ({
            action: r.action as AuditAction,
            count: r._count.id,
        }));
    }

    async getDailyTrends(
        query: { startDate?: Date; endDate?: Date },
        context: AuditContext
    ): Promise<DailyTrend[]> {
        this.validateContext(context);

        const where: any = { organizationId: context.organizationId };
        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) where.createdAt.gte = query.startDate;
            if (query.endDate) where.createdAt.lte = query.endDate;
        }

        const result = await this.prisma.inventoryAuditLog.groupBy({
            by: ['createdAt'],
            where,
            _count: { id: true },
        });

        return result.map((r: any) => ({
            date: r.createdAt,
            count: r._count.id,
        }));
    }

    // =========================================================================
    // RETENTION POLICY
    // =========================================================================

    async getRetentionPolicy(context: AuditContext): Promise<RetentionPolicy> {
        // In a real implementation, this would be per-organization
        return {
            retentionDays: DEFAULT_RETENTION_DAYS,
            archiveEnabled: true,
        };
    }

    async getEntriesPastRetention(context: AuditContext): Promise<{ count: number; entries: AuditEntry[] }> {
        this.validateContext(context);

        const policy = await this.getRetentionPolicy(context);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        const entries = await this.prisma.inventoryAuditLog.findMany({
            where: {
                organizationId: context.organizationId,
                createdAt: { lt: cutoffDate },
            },
        });

        return {
            count: entries.length,
            entries: entries as AuditEntry[],
        };
    }

    async archiveOldEntries(
        options: { retentionDays?: number },
        context: AuditContext
    ): Promise<{ archivedCount: number }> {
        this.validateContext(context);

        const retentionDays = options.retentionDays || DEFAULT_RETENTION_DAYS;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        // In a real implementation, entries would be moved to archive storage
        const oldEntries = await this.prisma.inventoryAuditLog.findMany({
            where: {
                organizationId: context.organizationId,
                createdAt: { lt: cutoffDate },
            },
        });

        // For now, just return count (would archive and delete in production)
        return {
            archivedCount: oldEntries.length,
        };
    }

    // =========================================================================
    // EXPORT CAPABILITIES
    // =========================================================================

    async exportCSV(query: AuditQuery, context: AuditContext): Promise<string> {
        const result = await this.query({ ...query, pageSize: MAX_PAGE_SIZE }, context);

        const headers = ['sku', 'action', 'previousQuantity', 'newQuantity', 'variance', 'reasonCode', 'userId', 'timestamp', 'notes'];
        const rows = result.items.map(entry => [
            entry.sku,
            entry.action,
            entry.previousQuantity.toString(),
            entry.newQuantity.toString(),
            entry.variance.toString(),
            entry.reasonCode,
            entry.userId,
            entry.createdAt.toISOString(),
            (entry.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    async exportJSON(query: AuditQuery, context: AuditContext): Promise<string> {
        const result = await this.query({ ...query, pageSize: MAX_PAGE_SIZE }, context);

        return JSON.stringify(result.items.map(entry => ({
            sku: entry.sku,
            action: entry.action,
            previousQuantity: entry.previousQuantity,
            newQuantity: entry.newQuantity,
            variance: entry.variance,
            variancePercent: entry.variancePercent,
            reasonCode: entry.reasonCode,
            userId: entry.userId,
            warehouseId: entry.warehouseId,
            notes: entry.notes,
            createdAt: entry.createdAt.toISOString(),
        })));
    }

    // =========================================================================
    // EVENT HANDLERS
    // =========================================================================

    private async handleInventoryUpdated(event: any): Promise<void> {
        try {
            await this.logChange({
                sku: event.sku,
                warehouseId: event.warehouseId,
                action: AuditAction.UPDATE,
                previousQuantity: event.previousQuantity,
                newQuantity: event.newQuantity,
                reasonCode: event.reasonCode || 'SYSTEM',
            }, {
                organizationId: event.organizationId,
                userId: event.userId,
            });
        } catch (error) {
            console.error('Failed to log inventory update:', error);
        }
    }

    private async handleInventoryCreated(event: any): Promise<void> {
        try {
            await this.logChange({
                sku: event.sku,
                warehouseId: event.warehouseId,
                action: AuditAction.CREATE,
                previousQuantity: 0,
                newQuantity: event.quantity,
                reasonCode: 'RECEIVING',
            }, {
                organizationId: event.organizationId,
                userId: event.userId,
            });
        } catch (error) {
            console.error('Failed to log inventory creation:', error);
        }
    }

    private async handleImportCompleted(event: any): Promise<void> {
        try {
            await this.logChange({
                sku: 'BULK_IMPORT',
                warehouseId: event.warehouseId,
                action: AuditAction.IMPORT,
                previousQuantity: 0,
                newQuantity: event.itemsImported,
                reasonCode: 'IMPORT',
                metadata: {
                    importId: event.importId,
                    itemsCreated: event.itemsCreated,
                    itemsUpdated: event.itemsUpdated,
                },
            }, {
                organizationId: event.organizationId,
                userId: event.userId,
            });
        } catch (error) {
            console.error('Failed to log import completion:', error);
        }
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private validateContext(context: AuditContext): void {
        if (!context.organizationId) {
            throw new BadRequestException('Organization ID is required');
        }
        if (!context.userId) {
            throw new BadRequestException('User ID is required');
        }
    }

    private validateInput(input: AuditLogInput): void {
        if (!input.sku || input.sku.trim() === '') {
            throw new BadRequestException('SKU is required');
        }

        if (!VALID_ACTIONS.includes(input.action)) {
            throw new BadRequestException(`Invalid action. Valid actions: ${VALID_ACTIONS.join(', ')}`);
        }
    }

    private sanitizeNotes(notes?: string): string {
        if (!notes) return '';

        // Remove script tags and HTML
        return notes
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, '')
            .trim();
    }
}
