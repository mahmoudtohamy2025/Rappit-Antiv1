import {
    Injectable,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@common/database/prisma.service';
import { SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';

/**
 * Stripe Webhook Service (BILL-02)
 * 
 * Handles Stripe webhook events for subscription state management.
 * CRITICAL: Billing is ISOLATED from fulfillment - only updates billing state.
 */
@Injectable()
export class StripeWebhookService {
    private readonly logger = new Logger(StripeWebhookService.name);
    private readonly stripe: Stripe;
    private readonly webhookSecret: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {
        this.stripe = new Stripe(
            this.configService.get<string>('STRIPE_SECRET_KEY') || '',
            { apiVersion: '2025-12-15.clover' as const },
        );
        this.webhookSecret =
            this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    }

    /**
     * Verify Stripe webhook signature
     * @throws BadRequestException if signature is invalid
     */
    verifySignature(payload: Buffer, signature: string): Stripe.Event {
        try {
            return this.stripe.webhooks.constructEvent(
                payload,
                signature,
                this.webhookSecret,
            );
        } catch (err) {
            this.logger.error(`Webhook signature verification failed: ${err.message}`);
            throw new BadRequestException('Invalid Stripe signature');
        }
    }

    /**
     * Check if event has already been processed (idempotency)
     */
    async isEventProcessed(eventId: string): Promise<boolean> {
        const existing = await this.prisma.processedStripeEvent.findUnique({
            where: { id: eventId },
        });
        return !!existing;
    }

    /**
     * Mark event as processed
     */
    async markEventProcessed(eventId: string, eventType: string): Promise<void> {
        await this.prisma.processedStripeEvent.create({
            data: {
                id: eventId,
                eventType,
                processed: true,
            },
        });
    }

    /**
     * Main event handler - routes to specific handlers
     */
    async handleWebhookEvent(event: Stripe.Event): Promise<void> {
        this.logger.log(`Processing Stripe event: ${event.type} (${event.id})`);

        // Check idempotency
        if (await this.isEventProcessed(event.id)) {
            this.logger.warn(`Event ${event.id} already processed, skipping`);
            return;
        }

        // Route to specific handler
        switch (event.type) {
            case 'customer.subscription.created':
                await this.handleSubscriptionCreated(event);
                break;
            case 'customer.subscription.updated':
                await this.handleSubscriptionUpdated(event);
                break;
            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted(event);
                break;
            case 'invoice.payment_succeeded':
                await this.handlePaymentSucceeded(event);
                break;
            case 'invoice.payment_failed':
                await this.handlePaymentFailed(event);
                break;
            default:
                this.logger.log(`Unhandled event type: ${event.type}`);
        }

        // Mark as processed
        await this.markEventProcessed(event.id, event.type);
    }

    /**
     * Handle customer.subscription.created
     * Sets org status to ACTIVE (or TRIAL if trial_end set)
     */
    private async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const org = await this.findOrganizationByStripeCustomer(customerId);
        if (!org) {
            this.logger.warn(`No organization found for Stripe customer: ${customerId}`);
            return;
        }

        const previousStatus = org.subscriptionStatus;
        const newStatus = subscription.trial_end
            ? SubscriptionStatus.TRIAL
            : SubscriptionStatus.ACTIVE;

        await this.updateOrganizationSubscription(org.id, {
            subscriptionStatus: newStatus,
            stripeSubscriptionId: subscription.id,
            currentPlanId: subscription.items.data[0]?.price?.id || null,
            trialEndsAt: subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : null,
            subscriptionEndsAt: (subscription as any).current_period_end
                ? new Date((subscription as any).current_period_end * 1000)
                : null,
        });

        await this.createAuditLog(org.id, 'subscription.created', previousStatus, newStatus, {
            stripeEventId: event.id,
            subscriptionId: subscription.id,
        });

        this.logger.log(`Subscription created for org ${org.id}: ${newStatus}`);
    }

    /**
     * Handle customer.subscription.updated
     * Updates status based on subscription.status
     */
    private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const org = await this.findOrganizationByStripeCustomer(customerId);
        if (!org) {
            this.logger.warn(`No organization found for Stripe customer: ${customerId}`);
            return;
        }

        const previousStatus = org.subscriptionStatus;
        const newStatus = this.mapStripeStatusToSubscriptionStatus(subscription.status);

        await this.updateOrganizationSubscription(org.id, {
            subscriptionStatus: newStatus,
            currentPlanId: subscription.items.data[0]?.price?.id || null,
            subscriptionEndsAt: (subscription as any).current_period_end
                ? new Date((subscription as any).current_period_end * 1000)
                : null,
        });

        await this.createAuditLog(org.id, 'subscription.updated', previousStatus, newStatus, {
            stripeEventId: event.id,
            stripeStatus: subscription.status,
        });

        this.logger.log(`Subscription updated for org ${org.id}: ${newStatus}`);
    }

    /**
     * Handle customer.subscription.deleted
     * Sets org status to CANCELLED
     */
    private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const org = await this.findOrganizationByStripeCustomer(customerId);
        if (!org) {
            this.logger.warn(`No organization found for Stripe customer: ${customerId}`);
            return;
        }

        const previousStatus = org.subscriptionStatus;

        await this.updateOrganizationSubscription(org.id, {
            subscriptionStatus: SubscriptionStatus.CANCELLED,
            stripeSubscriptionId: null,
            subscriptionEndsAt: new Date(),
        });

        await this.createAuditLog(
            org.id,
            'subscription.deleted',
            previousStatus,
            SubscriptionStatus.CANCELLED,
            { stripeEventId: event.id },
        );

        this.logger.log(`Subscription cancelled for org ${org.id}`);
    }

    /**
     * Handle invoice.payment_succeeded
     * Sets org status to ACTIVE
     */
    private async handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const org = await this.findOrganizationByStripeCustomer(customerId);
        if (!org) {
            this.logger.warn(`No organization found for Stripe customer: ${customerId}`);
            return;
        }

        // Only update if currently PAST_DUE or SUSPENDED
        if (
            org.subscriptionStatus === SubscriptionStatus.PAST_DUE ||
            org.subscriptionStatus === SubscriptionStatus.SUSPENDED
        ) {
            const previousStatus = org.subscriptionStatus;

            await this.updateOrganizationSubscription(org.id, {
                subscriptionStatus: SubscriptionStatus.ACTIVE,
            });

            await this.createAuditLog(
                org.id,
                'payment.succeeded',
                previousStatus,
                SubscriptionStatus.ACTIVE,
                { stripeEventId: event.id, invoiceId: invoice.id },
            );

            this.logger.log(`Payment succeeded, org ${org.id} reactivated`);
        }
    }

    /**
     * Handle invoice.payment_failed
     * Sets org status to PAST_DUE
     */
    private async handlePaymentFailed(event: Stripe.Event): Promise<void> {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const org = await this.findOrganizationByStripeCustomer(customerId);
        if (!org) {
            this.logger.warn(`No organization found for Stripe customer: ${customerId}`);
            return;
        }

        const previousStatus = org.subscriptionStatus;

        await this.updateOrganizationSubscription(org.id, {
            subscriptionStatus: SubscriptionStatus.PAST_DUE,
        });

        await this.createAuditLog(
            org.id,
            'payment.failed',
            previousStatus,
            SubscriptionStatus.PAST_DUE,
            { stripeEventId: event.id, invoiceId: invoice.id },
        );

        this.logger.log(`Payment failed, org ${org.id} now PAST_DUE`);
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    private async findOrganizationByStripeCustomer(customerId: string) {
        return this.prisma.organization.findFirst({
            where: { stripeCustomerId: customerId },
        });
    }

    private async updateOrganizationSubscription(
        orgId: string,
        data: Partial<{
            subscriptionStatus: SubscriptionStatus;
            stripeSubscriptionId: string | null;
            currentPlanId: string | null;
            trialEndsAt: Date | null;
            subscriptionEndsAt: Date | null;
        }>,
    ) {
        return this.prisma.organization.update({
            where: { id: orgId },
            data,
        });
    }

    private async createAuditLog(
        organizationId: string,
        action: string,
        previousValue: SubscriptionStatus,
        newValue: SubscriptionStatus,
        metadata: Record<string, any>,
    ) {
        return this.prisma.billingAuditLog.create({
            data: {
                organizationId,
                action,
                previousValue: { status: previousValue },
                newValue: { status: newValue },
                metadata,
                performedBy: 'stripe',
            },
        });
    }

    private mapStripeStatusToSubscriptionStatus(
        stripeStatus: Stripe.Subscription.Status,
    ): SubscriptionStatus {
        switch (stripeStatus) {
            case 'trialing':
                return SubscriptionStatus.TRIAL;
            case 'active':
                return SubscriptionStatus.ACTIVE;
            case 'past_due':
                return SubscriptionStatus.PAST_DUE;
            case 'canceled':
            case 'unpaid':
                return SubscriptionStatus.CANCELLED;
            case 'incomplete':
            case 'incomplete_expired':
            case 'paused':
            default:
                return SubscriptionStatus.SUSPENDED;
        }
    }
}
