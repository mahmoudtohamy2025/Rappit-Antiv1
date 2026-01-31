import { Injectable, Logger } from '@nestjs/common';

export interface EmailAlert {
    title: string;
    message: string;
    organizationId: string;
    correlationId?: string;
    timestamp: string;
}

/**
 * Email client for info alerts and fallback
 * Queues emails for batch sending
 */
@Injectable()
export class EmailClient {
    private readonly logger = new Logger(EmailClient.name);

    async queueEmail(alert: EmailAlert): Promise<{ success: boolean }> {
        this.logger.log(`Queuing email alert: ${alert.title}`);

        // In production, this would add to email queue (SES, SendGrid, etc.)
        const emailPayload = {
            to: `alerts@${alert.organizationId}.rappit.io`,
            subject: `[RAPPIT Alert] ${alert.title}`,
            body: `
        Alert: ${alert.title}
        
        ${alert.message}
        
        Organization: ${alert.organizationId}
        Correlation ID: ${alert.correlationId || 'N/A'}
        Time: ${alert.timestamp}
      `,
        };

        this.logger.debug(`Email payload: ${JSON.stringify(emailPayload)}`);

        return { success: true };
    }
}
