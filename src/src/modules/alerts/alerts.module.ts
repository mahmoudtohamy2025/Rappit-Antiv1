import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { PagerDutyClient } from './clients/pagerduty.client';
import { SlackClient } from './clients/slack.client';
import { EmailClient } from './clients/email.client';

@Module({
    providers: [AlertsService, PagerDutyClient, SlackClient, EmailClient],
    exports: [AlertsService],
})
export class AlertsModule { }
