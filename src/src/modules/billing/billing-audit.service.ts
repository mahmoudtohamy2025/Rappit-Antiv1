import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Billing Audit Actions (BILL-05)
 * 
 * Standard event types for billing audit logging
 */
export enum BillingAuditAction {
    // Subscription lifecycle
    SUBSCRIPTION_CREATED = 'subscription.created',
    SUBSCRIPTION_UPDATED = 'subscription.updated',
    SUBSCRIPTION_CANCELLED = 'subscription.cancelled',

    // Payment events
    PAYMENT_SUCCEEDED = 'invoice.paid',
    PAYMENT_FAILED = 'invoice.payment_failed',

    // Trial events
    TRIAL_STARTED = 'trial.started',
    TRIAL_EXPIRED = 'trial.expired',

    // Status changes
    STATUS_CHANGED = 'status.changed',
}

/**
 * Input for creating audit log entry
 */
export interface BillingAuditLogInput {
    organizationId: string;
    action: BillingAuditAction | string;
    previousValue?: Record<string, any>;
    newValue?: Record<string, any>;
    metadata?: Record<string, any>;
    performedBy?: string; // 'system', 'stripe', or user ID
}

/**
 * Pagination options
 */
export interface PaginationOptions {
    page?: number;
    limit?: number;
}

/**
 * Date range options
 */
export interface DateRangeOptions {
    startDate: Date;
    endDate: Date;
}

/**
 * BillingAuditService (BILL-05)
 * 
 * Centralized service for billing audit logging.
 * 
 * CRITICAL:
 * - Logs are IMMUTABLE - no update/delete operations
 * - 7-year retention (CTO compliance decision)
 * - All billing events must be logged for disputes and compliance
 */
@Injectable()
export class BillingAuditService {
    private readonly logger = new Logger(BillingAuditService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Create a billing audit log entry
     * 
     * @param input - Audit log input data
     * @returns Created audit log entry
     */
    async log(input: BillingAuditLogInput) {
        const entry = await this.prisma.billingAuditLog.create({
            data: {
                organizationId: input.organizationId,
                action: input.action,
                previousValue: input.previousValue as Prisma.JsonObject,
                newValue: input.newValue as Prisma.JsonObject,
                metadata: input.metadata as Prisma.JsonObject,
                performedBy: input.performedBy ?? 'system',
            },
        });

        this.logger.log(
            `Audit log created: ${input.action} for org ${input.organizationId}`,
        );

        return entry;
    }

    /**
     * Log a subscription status change
     * 
     * Helper method for common status change logging
     */
    async logStatusChange(
        organizationId: string,
        previousStatus: string,
        newStatus: string,
        metadata?: Record<string, any>,
        performedBy?: string,
    ) {
        return this.log({
            organizationId,
            action: BillingAuditAction.STATUS_CHANGED,
            previousValue: { subscriptionStatus: previousStatus },
            newValue: { subscriptionStatus: newStatus },
            metadata: {
                ...metadata,
                changedAt: new Date().toISOString(),
            },
            performedBy,
        });
    }

    /**
     * Find audit logs by organization with pagination
     * 
     * @param organizationId - Organization ID
     * @param options - Pagination options
     * @returns Paginated audit logs
     */
    async findByOrganization(
        organizationId: string,
        options: PaginationOptions = {},
    ) {
        const page = options.page ?? 1;
        const limit = Math.min(options.limit ?? 20, 100); // Max 100 per page
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            this.prisma.billingAuditLog.findMany({
                where: { organizationId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.billingAuditLog.count({
                where: { organizationId },
            }),
        ]);

        return {
            data: logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Find audit logs by date range
     * 
     * @param organizationId - Organization ID
     * @param dateRange - Start and end dates
     * @param options - Pagination options
     * @returns Audit logs within date range
     */
    async findByDateRange(
        organizationId: string,
        dateRange: DateRangeOptions,
        options: PaginationOptions = {},
    ) {
        const page = options.page ?? 1;
        const limit = Math.min(options.limit ?? 20, 100);
        const skip = (page - 1) * limit;

        const where = {
            organizationId,
            createdAt: {
                gte: dateRange.startDate,
                lte: dateRange.endDate,
            },
        };

        const [logs, total] = await Promise.all([
            this.prisma.billingAuditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.billingAuditLog.count({ where }),
        ]);

        return {
            data: logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            dateRange: {
                startDate: dateRange.startDate.toISOString(),
                endDate: dateRange.endDate.toISOString(),
            },
        };
    }

    /**
     * Get latest billing events for an organization
     * 
     * @param organizationId - Organization ID
     * @param limit - Number of events (default 10, max 50)
     * @returns Latest audit log entries
     */
    async getLatestEvents(organizationId: string, limit: number = 10) {
        const safeLimit = Math.min(limit, 50);

        return this.prisma.billingAuditLog.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            take: safeLimit,
        });
    }

    /**
     * Find a specific audit log by ID
     * 
     * @param id - Audit log ID
     * @returns Audit log entry or null
     */
    async findById(id: string) {
        return this.prisma.billingAuditLog.findUnique({
            where: { id },
        });
    }

    /**
     * Find audit logs by action type
     * 
     * @param organizationId - Organization ID
     * @param action - Action type to filter by
     * @param options - Pagination options
     * @returns Filtered audit logs
     */
    async findByAction(
        organizationId: string,
        action: BillingAuditAction | string,
        options: PaginationOptions = {},
    ) {
        const page = options.page ?? 1;
        const limit = Math.min(options.limit ?? 20, 100);
        const skip = (page - 1) * limit;

        const where = { organizationId, action };

        const [logs, total] = await Promise.all([
            this.prisma.billingAuditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.billingAuditLog.count({ where }),
        ]);

        return {
            data: logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
