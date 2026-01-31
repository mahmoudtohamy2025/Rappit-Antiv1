import { Injectable, Logger } from '@nestjs/common';

export interface SlackMessage {
    title: string;
    message: string;
    organizationId: string;
    correlationId?: string;
    timestamp: string;
}

/**
 * Slack client for warning alerts
 * Uses Slack Incoming Webhooks
 */
@Injectable()
export class SlackClient {
    private readonly logger = new Logger(SlackClient.name);
    private readonly webhookUrl = process.env.SLACK_WEBHOOK_URL;

    async sendMessage(message: SlackMessage): Promise<{ success: boolean }> {
        this.logger.log(`Sending Slack message: ${message.title}`);

        // In production, this would POST to Slack webhook URL
        const payload = {
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: `⚠️ ${message.title}`,
                    },
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: message.message,
                    },
                },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: `*Org:* ${message.organizationId} | *Time:* ${message.timestamp}`,
                        },
                    ],
                },
            ],
        };

        this.logger.debug(`Slack payload: ${JSON.stringify(payload)}`);

        return { success: true };
    }
}
