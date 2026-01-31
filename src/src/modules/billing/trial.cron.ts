import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TrialService } from './trial.service';

/**
 * TrialCron (BILL-04)
 * 
 * Scheduled job for trial management:
 * - Runs daily at 00:00 UTC
 * - Expires overdue trials (TRIAL → SUSPENDED)
 * - Sends notification emails at 7, 3, 1 days before expiry
 * 
 * CRITICAL: This job NEVER deletes data. Only updates status and sends notifications.
 */
@Injectable()
export class TrialCronService {
    private readonly logger = new Logger(TrialCronService.name);

    constructor(private trialService: TrialService) { }

    /**
     * Daily trial management job
     * Runs at 00:00 UTC every day
     */
    @Cron('0 0 * * *', {
        name: 'trial-expiry-check',
        timeZone: 'UTC',
    })
    async handleTrialExpiry(): Promise<void> {
        this.logger.log('Starting daily trial expiry check...');

        try {
            // 1. Expire overdue trials
            const expiredCount = await this.trialService.expireTrials();
            this.logger.log(`Expired ${expiredCount} trial(s)`);

            // 2. Send notification emails
            await this.sendTrialNotifications();

            this.logger.log('Daily trial expiry check completed');
        } catch (error) {
            this.logger.error(`Trial expiry job failed: ${error.message}`);
        }
    }

    /**
     * Send notification emails for trials expiring soon
     */
    private async sendTrialNotifications(): Promise<void> {
        for (const days of TrialService.NOTIFICATION_SCHEDULE) {
            const orgsExpiringSoon = await this.trialService.getTrialsExpiringInDays(days);

            for (const org of orgsExpiringSoon) {
                await this.sendTrialReminderEmail(org, days);
            }

            if (orgsExpiringSoon.length > 0) {
                this.logger.log(
                    `Sent ${orgsExpiringSoon.length} trial reminder(s) for ${days} day(s) before expiry`,
                );
            }
        }

        // Also send expired notifications (0 days = today)
        const expiredToday = await this.trialService.getTrialsExpiringInDays(0);
        for (const org of expiredToday) {
            await this.sendTrialExpiredEmail(org);
        }

        if (expiredToday.length > 0) {
            this.logger.log(`Sent ${expiredToday.length} trial expired notification(s)`);
        }
    }

    /**
     * Send trial reminder email
     * 
     * TODO: Integrate with actual email service (SendGrid, etc.)
     */
    private async sendTrialReminderEmail(
        org: { id: string; name: string; billingEmail: string | null },
        daysRemaining: number,
    ): Promise<void> {
        const email = org.billingEmail;

        if (!email) {
            this.logger.warn(`No billing email for org ${org.id}, skipping notification`);
            return;
        }

        // Mock email sending - log for now
        this.logger.log(
            `[MOCK EMAIL] To: ${email} | Subject: Your trial expires in ${daysRemaining} day(s) | Org: ${org.name}`,
        );

        // TODO: Replace with actual email integration
        // await this.emailService.send({
        //   to: email,
        //   template: 'trial-reminder',
        //   data: {
        //     organizationName: org.name,
        //     daysRemaining,
        //   },
        // });
    }

    /**
     * Send trial expired email
     * 
     * TODO: Integrate with actual email service (SendGrid, etc.)
     */
    private async sendTrialExpiredEmail(
        org: { id: string; name: string; billingEmail: string | null },
    ): Promise<void> {
        const email = org.billingEmail;

        if (!email) {
            this.logger.warn(`No billing email for org ${org.id}, skipping expiry notification`);
            return;
        }

        // Mock email sending - log for now
        this.logger.log(
            `[MOCK EMAIL] To: ${email} | Subject: Your trial has expired | Org: ${org.name}`,
        );

        // TODO: Replace with actual email integration
        // await this.emailService.send({
        //   to: email,
        //   template: 'trial-expired',
        //   data: {
        //     organizationName: org.name,
        //   },
        // });
    }

    /**
     * Manual trigger for testing
     * Can be called via admin endpoint
     */
    async runManually(): Promise<{ expired: number }> {
        this.logger.log('Manual trial expiry check triggered');
        const expired = await this.trialService.expireTrials();
        await this.sendTrialNotifications();
        return { expired };
    }
}
