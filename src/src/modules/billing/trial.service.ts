import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

/**
 * TrialService (BILL-04)
 * 
 * Manages trial period for organizations:
 * - 14-day trial period
 * - Automatic expiry transition: TRIAL → SUSPENDED
 * - Notification scheduling at 7, 3, 1 days before expiry
 * 
 * CRITICAL: This service NEVER deletes data. Only updates subscription status.
 */
@Injectable()
export class TrialService {
    private readonly logger = new Logger(TrialService.name);

    /**
     * Trial duration in days
     */
    static readonly TRIAL_DURATION_DAYS = 14;

    /**
     * Notification schedule (days before expiry)
     */
    static readonly NOTIFICATION_SCHEDULE = [7, 3, 1];

    constructor(private prisma: PrismaService) { }

    /**
     * Calculate trial end date from registration date
     * @param registrationDate - Date of organization registration
     * @returns Date when trial expires
     */
    calculateTrialEndDate(registrationDate: Date = new Date()): Date {
        const trialEnd = new Date(registrationDate);
        trialEnd.setDate(trialEnd.getDate() + TrialService.TRIAL_DURATION_DAYS);
        return trialEnd;
    }

    /**
     * Get number of days remaining in trial
     * @param trialEndsAt - Trial expiry date
     * @returns Number of days remaining (negative if expired)
     */
    getDaysRemaining(trialEndsAt: Date): number {
        const now = new Date();
        const diffMs = trialEndsAt.getTime() - now.getTime();
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    /**
     * Check if organization's trial has expired
     * @param organization - Organization with trialEndsAt field
     * @returns true if trial is expired
     */
    isTrialExpired(organization: { subscriptionStatus: SubscriptionStatus; trialEndsAt: Date | null }): boolean {
        if (organization.subscriptionStatus !== SubscriptionStatus.TRIAL) {
            return false; // Not in trial, cannot be "expired"
        }

        if (!organization.trialEndsAt) {
            return false; // No trial end date set
        }

        return new Date() > organization.trialEndsAt;
    }

    /**
     * Expire all trials that have passed their trialEndsAt date
     * Transitions: TRIAL → SUSPENDED
     * Creates BillingAuditLog entry for each expired trial
     * 
     * Called by daily cron job at 00:00 UTC
     * 
     * @returns Number of trials expired
     */
    async expireTrials(): Promise<number> {
        const now = new Date();

        this.logger.log('Checking for expired trials...');

        // Find all organizations where:
        // - Status is TRIAL
        // - trialEndsAt is in the past
        const expiredTrials = await this.prisma.organization.findMany({
            where: {
                subscriptionStatus: SubscriptionStatus.TRIAL,
                trialEndsAt: {
                    lt: now,
                },
            },
            select: {
                id: true,
                name: true,
                trialEndsAt: true,
                billingEmail: true,
            },
        });

        if (expiredTrials.length === 0) {
            this.logger.log('No expired trials found');
            return 0;
        }

        this.logger.log(`Found ${expiredTrials.length} expired trials to process`);

        // Process each expired trial
        for (const org of expiredTrials) {
            try {
                // Update status to SUSPENDED
                await this.prisma.organization.update({
                    where: { id: org.id },
                    data: {
                        subscriptionStatus: SubscriptionStatus.SUSPENDED,
                    },
                });

                // Create audit log entry
                await this.prisma.billingAuditLog.create({
                    data: {
                        organizationId: org.id,
                        action: 'TRIAL_EXPIRED',
                        previousValue: { status: SubscriptionStatus.TRIAL },
                        newValue: { status: SubscriptionStatus.SUSPENDED },
                        metadata: {
                            trialEndsAt: org.trialEndsAt?.toISOString(),
                            expiredAt: now.toISOString(),
                        },
                        performedBy: 'system',
                    },
                });

                this.logger.log(
                    `Trial expired for organization ${org.name} (${org.id}). Status: TRIAL → SUSPENDED`,
                );
            } catch (error) {
                this.logger.error(
                    `Failed to expire trial for organization ${org.id}: ${error.message}`,
                );
            }
        }

        return expiredTrials.length;
    }

    /**
     * Get organizations with trials expiring in exactly N days
     * Used for sending notification emails
     * 
     * @param days - Number of days until expiry
     * @returns Organizations expiring in exactly N days
     */
    async getTrialsExpiringInDays(days: number): Promise<
        Array<{
            id: string;
            name: string;
            billingEmail: string | null;
            trialEndsAt: Date;
        }>
    > {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        startOfDay.setDate(startOfDay.getDate() + days);

        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        return this.prisma.organization.findMany({
            where: {
                subscriptionStatus: SubscriptionStatus.TRIAL,
                trialEndsAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            select: {
                id: true,
                name: true,
                billingEmail: true,
                trialEndsAt: true,
            },
        });
    }

    /**
     * Get trial status for an organization
     * 
     * @param organizationId - Organization ID
     * @returns Trial status info
     */
    async getTrialStatus(organizationId: string): Promise<{
        isInTrial: boolean;
        trialEndsAt: Date | null;
        daysRemaining: number | null;
        isExpired: boolean;
    }> {
        const org = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                subscriptionStatus: true,
                trialEndsAt: true,
            },
        });

        if (!org) {
            return {
                isInTrial: false,
                trialEndsAt: null,
                daysRemaining: null,
                isExpired: false,
            };
        }

        const isInTrial = org.subscriptionStatus === SubscriptionStatus.TRIAL;
        const daysRemaining = org.trialEndsAt
            ? this.getDaysRemaining(org.trialEndsAt)
            : null;

        return {
            isInTrial,
            trialEndsAt: org.trialEndsAt,
            daysRemaining,
            isExpired: isInTrial && daysRemaining !== null && daysRemaining < 0,
        };
    }
}
