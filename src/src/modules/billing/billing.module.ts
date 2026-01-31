import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@common/database/database.module';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeService } from './stripe.service';
import { TrialService } from './trial.service';
import { TrialCronService } from './trial.cron';
import { BillingAuditService } from './billing-audit.service';
import { BillingAuditController } from './billing-audit.controller';

/**
 * Billing Module (BILL-01, BILL-02, BILL-04, BILL-05, BILL-06)
 * 
 * Handles platform billing and subscription management.
 * CRITICAL: Billing is ISOLATED from fulfillment logic.
 * 
 * Components:
 * - StripeService: Core Stripe API integration (BILL-06)
 * - StripeWebhookService: Handles Stripe webhook events
 * - TrialService: 14-day trial management
 * - TrialCronService: Daily job for trial expiry (00:00 UTC)
 * - BillingAuditService: Immutable audit logging (7-year retention)
 */
@Module({
    imports: [DatabaseModule, ConfigModule, ScheduleModule.forRoot()],
    controllers: [StripeWebhookController, BillingAuditController],
    providers: [StripeService, StripeWebhookService, TrialService, TrialCronService, BillingAuditService],
    exports: [StripeService, StripeWebhookService, TrialService, BillingAuditService],
})
export class BillingModule { }

