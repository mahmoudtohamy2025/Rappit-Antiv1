import { Injectable, Logger } from '@nestjs/common';
import { PagerDutyClient } from './clients/pagerduty.client';
import { SlackClient } from './clients/slack.client';
import { EmailClient } from './clients/email.client';

export enum AlertSeverity {
    CRITICAL = 'CRITICAL',
    WARNING = 'WARNING',
    INFO = 'INFO',
}

export interface AlertPayload {
    severity: AlertSeverity;
    title: string;
    message: string;
    organizationId: string;
    correlationId?: string;
    metadata?: Record<string, any>;
}

@Injectable()
export class AlertsService {
    private readonly logger = new Logger(AlertsService.name);
    private readonly DEDUPLICATION_WINDOW_MS = 300000; // 5 minutes
    private readonly RATE_LIMIT_PER_HOUR = 100;
    private readonly MAX_RETRIES = 3;

    // Deduplication cache: key -> timestamp
    private readonly deduplicationCache = new Map<string, number>();
    // Rate limit tracking: orgId -> count per hour
    private readonly rateLimitCache = new Map<string, { count: number; resetAt: number }>();

    // Sensitive patterns to redact
    private readonly SENSITIVE_PATTERNS = [
        /password\s*=\s*\S+/gi,
        /token\s*=\s*\S+/gi,
        /key\s*=\s*\S+/gi,
        /secret\s*=\s*\S+/gi,
        /api_key\s*=\s*\S+/gi,
        /sk-[a-zA-Z0-9]+/gi,
    ];

    constructor(
        private readonly pagerDutyClient: PagerDutyClient,
        private readonly slackClient: SlackClient,
        private readonly emailClient: EmailClient,
    ) { }

    async sendAlert(payload: AlertPayload): Promise<void> {
        const { severity, title, message, organizationId, correlationId, metadata } = payload;

        // Check deduplication
        const dedupeKey = this.getDedupeKey(payload);
        if (this.isDuplicate(dedupeKey)) {
            this.logger.debug(`Alert deduplicated: ${title}`);
            return;
        }

        // Check rate limit
        if (!this.checkRateLimit(organizationId)) {
            this.logger.warn(`Rate limit exceeded for org ${organizationId}`);
            return; // Silently drop to avoid cascading issues
        }

        // Sanitize message
        const sanitizedMessage = this.sanitizeMessage(message);
        const sanitizedMetadata = this.sanitizeMetadata(metadata);

        const alertData = {
            severity: severity.toLowerCase(),
            title,
            message: sanitizedMessage,
            organizationId,
            correlationId,
            timestamp: new Date().toISOString(),
            metadata: sanitizedMetadata,
        };

        // Route based on severity
        switch (severity) {
            case AlertSeverity.CRITICAL:
                await this.sendWithRetry(() => this.pagerDutyClient.sendAlert(alertData));
                break;
            case AlertSeverity.WARNING:
                try {
                    await this.slackClient.sendMessage(alertData);
                } catch (error) {
                    this.logger.warn(`Slack failed, falling back to email: ${error.message}`);
                    await this.emailClient.queueEmail(alertData);
                }
                break;
            case AlertSeverity.INFO:
                await this.emailClient.queueEmail(alertData);
                break;
        }

        // Mark as sent for deduplication
        this.markSent(dedupeKey);
        this.incrementRateLimit(organizationId);
    }

    private getDedupeKey(payload: AlertPayload): string {
        return `${payload.organizationId}:${payload.severity}:${payload.title}`;
    }

    private isDuplicate(key: string): boolean {
        const lastSent = this.deduplicationCache.get(key);
        if (!lastSent) return false;
        return Date.now() - lastSent < this.DEDUPLICATION_WINDOW_MS;
    }

    private markSent(key: string): void {
        this.deduplicationCache.set(key, Date.now());
        // Clean old entries periodically
        if (this.deduplicationCache.size > 1000) {
            const cutoff = Date.now() - this.DEDUPLICATION_WINDOW_MS;
            for (const [k, v] of this.deduplicationCache.entries()) {
                if (v < cutoff) this.deduplicationCache.delete(k);
            }
        }
    }

    private checkRateLimit(organizationId: string): boolean {
        const now = Date.now();
        const hourMs = 60 * 60 * 1000;
        let entry = this.rateLimitCache.get(organizationId);

        if (!entry || now > entry.resetAt) {
            entry = { count: 0, resetAt: now + hourMs };
            this.rateLimitCache.set(organizationId, entry);
        }

        return entry.count < this.RATE_LIMIT_PER_HOUR;
    }

    private incrementRateLimit(organizationId: string): void {
        const entry = this.rateLimitCache.get(organizationId);
        if (entry) {
            entry.count++;
        }
    }

    private sanitizeMessage(message: string): string {
        let sanitized = message;
        for (const pattern of this.SENSITIVE_PATTERNS) {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        }
        return sanitized;
    }

    private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
        if (!metadata) return undefined;
        const sanitized: Record<string, any> = {};
        const sensitiveKeys = ['password', 'secret', 'token', 'apikey', 'api_key', 'key'];
        for (const [key, value] of Object.entries(metadata)) {
            if (!sensitiveKeys.includes(key.toLowerCase())) {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    private async sendWithRetry<T>(fn: () => Promise<T>, retries = this.MAX_RETRIES): Promise<T> {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === retries) throw error;
                const backoff = attempt * 1000;
                this.logger.warn(`Retry ${attempt}/${retries} after ${backoff}ms: ${error.message}`);
                await new Promise((r) => setTimeout(r, backoff));
            }
        }
        throw new Error('Max retries exceeded');
    }
}
