import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '@common/database/prisma.service';
import {
    REQUIRES_SUBSCRIPTION_KEY,
    ALLOW_BILLING_KEY,
} from '@common/decorators/subscription.decorator';
import { MetricsService } from '@common/metrics/metrics.service';

/**
 * SubscriptionGuard (BILL-03)
 * 
 * Enforces subscription status-based access control.
 * 
 * Access Rules:
 * | Status     | Read (GET) | Write (POST/PUT/PATCH/DELETE) |
 * |------------|------------|-------------------------------|
 * | TRIAL      | ✅         | ✅                            |
 * | ACTIVE     | ✅         | ✅                            |
 * | PAST_DUE   | ✅         | ✅                            |
 * | SUSPENDED  | ✅         | ❌                            |
 * | CANCELLED  | ✅         | ❌                            |
 * 
 * CRITICAL: This guard NEVER modifies data. It only gates access.
 * 
 * GATE-006: Records metrics for subscription enforcement monitoring.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
    private readonly logger = new Logger(SubscriptionGuard.name);

    // HTTP methods considered as "write" operations
    private readonly WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    // Subscription statuses that allow write operations
    private readonly ACTIVE_STATUSES: SubscriptionStatus[] = [
        SubscriptionStatus.TRIAL,
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.PAST_DUE,
    ];

    constructor(
        private reflector: Reflector,
        private prisma: PrismaService,
        private metricsService: MetricsService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Check if route requires subscription check
        const requiresSubscription = this.reflector.getAllAndOverride<boolean>(
            REQUIRES_SUBSCRIPTION_KEY,
            [context.getHandler(), context.getClass()],
        );

        // If @RequiresActiveSubscription() not applied, allow access
        if (!requiresSubscription) {
            return true;
        }

        // Check if billing operations are allowed (e.g., update payment method)
        const allowBilling = this.reflector.getAllAndOverride<boolean>(
            ALLOW_BILLING_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (allowBilling) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const method = request.method?.toUpperCase();
        const user = request.user;
        console.log('DEBUG: SubscriptionGuard - User:', user ? user.id : 'undefined');

        // If no user (shouldn't happen with JwtAuthGuard), deny
        if (!user) {
            console.log('DEBUG: SubscriptionGuard - No user found');
            throw new ForbiddenException('Authentication required');
        }

        const organizationId = user.organizationId;

        // If no organization context, deny
        if (!organizationId) {
            this.logger.warn('No organization context in request');
            throw new ForbiddenException('Organization context required');
        }

        // Read operations always allowed
        if (!this.WRITE_METHODS.includes(method)) {
            return true;
        }

        // Get organization subscription status
        const organization = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: { id: true, subscriptionStatus: true, name: true },
        });

        // If no organization found (shouldn't happen), deny
        if (!organization) {
            this.logger.error(`Organization not found: ${organizationId}`);
            throw new ForbiddenException('Organization not found');
        }

        // Default to TRIAL if no subscription status set
        const status = organization.subscriptionStatus ?? SubscriptionStatus.TRIAL;

        // Check if status allows write operations
        if (this.ACTIVE_STATUSES.includes(status)) {
            return true;
        }

        // Log blocked attempt
        this.logger.warn(
            `Blocked write operation for organization ${organization.name} ` +
            `(${organizationId}) with status ${status}. Method: ${method}, Path: ${request.path}`,
        );

        // Record metric for monitoring (GATE-006)
        this.metricsService.recordSubscriptionBlock(
            organizationId,
            status,
            request.path,
        );

        // Block with clear message
        throw new ForbiddenException({
            statusCode: 403,
            error: 'Subscription Inactive',
            message: 'Your subscription is inactive. Please update your payment method to continue.',
            billingUrl: '/billing',
            currentStatus: status,
        });
    }
}
