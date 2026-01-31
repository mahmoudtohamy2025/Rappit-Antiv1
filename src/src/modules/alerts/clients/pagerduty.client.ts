import { Injectable, Logger } from '@nestjs/common';

export interface PagerDutyAlert {
    severity: string;
    title: string;
    message: string;
    organizationId: string;
    correlationId?: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

/**
 * PagerDuty client for critical alerts
 * Uses PagerDuty Events API v2
 */
@Injectable()
export class PagerDutyClient {
    private readonly logger = new Logger(PagerDutyClient.name);
    private readonly routingKey = process.env.PAGERDUTY_ROUTING_KEY;

    async sendAlert(alert: PagerDutyAlert): Promise<{ success: boolean }> {
        this.logger.log(`Sending PagerDuty alert: ${alert.title}`);

        // In production, this would make an HTTP request to PagerDuty Events API
        // POST https://events.pagerduty.com/v2/enqueue
        const payload = {
            routing_key: this.routingKey,
            event_action: 'trigger',
            payload: {
                summary: alert.title,
                severity: alert.severity,
                source: 'rappit',
                custom_details: {
                    message: alert.message,
                    organizationId: alert.organizationId,
                    correlationId: alert.correlationId,
                    timestamp: alert.timestamp,
                },
            },
        };

        this.logger.debug(`PagerDuty payload: ${JSON.stringify(payload)}`);

        return { success: true };
    }
}
