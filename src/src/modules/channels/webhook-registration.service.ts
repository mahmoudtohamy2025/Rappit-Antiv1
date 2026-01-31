/**
 * Webhook Registration Service (ORD-02)
 * 
 * Automatically registers webhooks with channel platforms (Shopify, WooCommerce)
 * after successful OAuth connection.
 * 
 * Features:
 * - 32+ byte cryptographically secure secret generation
 * - Shopify webhook API integration
 * - WooCommerce webhook API integration
 * - Encrypted secret storage
 * - Retry on transient failures (3 attempts)
 * - Rollback on partial failure
 * - Duplicate registration prevention
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

/**
 * Supported channel types
 */
export enum ChannelType {
    SHOPIFY = 'SHOPIFY',
    WOOCOMMERCE = 'WOOCOMMERCE',
}

/**
 * Webhook topics for order events
 */
export enum WebhookTopic {
    ORDERS_CREATE = 'ORDERS_CREATE',
    ORDERS_UPDATE = 'ORDERS_UPDATE',
    ORDERS_CANCELLED = 'ORDERS_CANCELLED',
    ORDERS_FULFILLED = 'ORDERS_FULFILLED',
}

/**
 * Shopify topic mapping
 */
const SHOPIFY_TOPICS: Record<WebhookTopic, string> = {
    [WebhookTopic.ORDERS_CREATE]: 'orders/create',
    [WebhookTopic.ORDERS_UPDATE]: 'orders/updated',
    [WebhookTopic.ORDERS_CANCELLED]: 'orders/cancelled',
    [WebhookTopic.ORDERS_FULFILLED]: 'orders/fulfilled',
};

/**
 * WooCommerce topic mapping
 */
const WOOCOMMERCE_TOPICS: Record<WebhookTopic, string> = {
    [WebhookTopic.ORDERS_CREATE]: 'order.created',
    [WebhookTopic.ORDERS_UPDATE]: 'order.updated',
    [WebhookTopic.ORDERS_CANCELLED]: 'order.deleted',
    [WebhookTopic.ORDERS_FULFILLED]: 'order.updated',
};

/**
 * Webhook topic names for WooCommerce
 */
const WOOCOMMERCE_NAMES: Record<WebhookTopic, string> = {
    [WebhookTopic.ORDERS_CREATE]: 'Rappit Order Created',
    [WebhookTopic.ORDERS_UPDATE]: 'Rappit Order Updated',
    [WebhookTopic.ORDERS_CANCELLED]: 'Rappit Order Cancelled',
    [WebhookTopic.ORDERS_FULFILLED]: 'Rappit Order Fulfilled',
};

/**
 * Result of webhook registration
 */
export interface WebhookRegistrationResult {
    success: boolean;
    webhooksRegistered?: number;
    skipped?: boolean;
    rolledBack?: boolean;
    error?: string;
    partialWebhooks?: number[];
}

/**
 * Options for registration
 */
export interface RegistrationOptions {
    force?: boolean;
}

/**
 * Registered webhook info for rollback
 */
interface RegisteredWebhook {
    id: number | string;
    topic: WebhookTopic;
}

@Injectable()
export class WebhookRegistrationService {
    private readonly logger = new Logger(WebhookRegistrationService.name);
    private readonly MAX_RETRIES = 3;
    private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';

    constructor(
        private readonly prisma: PrismaService,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Register webhooks for a channel after OAuth
     */
    async registerWebhooksForChannel(
        channelId: string,
        options: RegistrationOptions = {}
    ): Promise<WebhookRegistrationResult> {
        this.logger.debug(`Registering webhooks for channel ${channelId}`);

        // Fetch channel
        const channel = await this.prisma.channel.findUnique({
            where: { id: channelId },
        });

        if (!channel) {
            return {
                success: false,
                error: 'Channel not found',
            };
        }

        // Check for existing registration
        if (channel.webhookSecret && !options.force) {
            this.logger.debug(`Channel ${channelId} already has webhooks registered`);
            return {
                success: false,
                skipped: true,
            };
        }

        // Validate channel type
        if (!Object.values(ChannelType).includes(channel.type as ChannelType)) {
            return {
                success: false,
                error: `Unsupported channel type: ${channel.type}`,
            };
        }

        // Generate new secret
        const secret = this.generateWebhookSecret();
        const encryptedSecret = this.encryptSecret(secret);

        // Register webhooks based on channel type
        try {
            const result = await this.registerWebhooks(channel, secret);

            if (result.success) {
                // Store encrypted secret
                await this.prisma.channel.update({
                    where: { id: channelId },
                    data: { webhookSecret: encryptedSecret },
                });
            }

            return result;
        } catch (error) {
            this.logger.error(`Failed to register webhooks for ${channelId}:`, error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Register webhooks with the channel's platform
     */
    private async registerWebhooks(
        channel: any,
        secret: string
    ): Promise<WebhookRegistrationResult> {
        const channelType = channel.type as ChannelType;
        const topics = [WebhookTopic.ORDERS_CREATE, WebhookTopic.ORDERS_UPDATE];
        const registeredWebhooks: RegisteredWebhook[] = [];

        try {
            for (const topic of topics) {
                const webhookId = await this.registerSingleWebhook(
                    channel,
                    channelType,
                    topic,
                    secret
                );
                registeredWebhooks.push({ id: webhookId, topic });
            }

            return {
                success: true,
                webhooksRegistered: registeredWebhooks.length,
            };
        } catch (error) {
            this.logger.warn(`Webhook registration failed, rolling back...`);

            // Rollback successful registrations
            await this.rollbackWebhooks(channel, channelType, registeredWebhooks);

            return {
                success: false,
                rolledBack: true,
                error: `Registration failed after ${this.MAX_RETRIES} retries`,
                partialWebhooks: registeredWebhooks.map(w => w.id as number),
            };
        }
    }

    /**
     * Register a single webhook with retry
     */
    private async registerSingleWebhook(
        channel: any,
        channelType: ChannelType,
        topic: WebhookTopic,
        secret: string
    ): Promise<number | string> {
        const appUrl = this.configService.get<string>('APP_URL');
        const webhookUrl = `${appUrl}/webhooks/${channelType.toLowerCase()}/${channel.id}`;

        let lastError: any;

        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                if (channelType === ChannelType.SHOPIFY) {
                    return await this.registerShopifyWebhook(channel, topic, webhookUrl);
                } else {
                    return await this.registerWooCommerceWebhook(channel, topic, secret, webhookUrl);
                }
            } catch (error) {
                lastError = error;

                if (!this.isTransientError(error) || attempt === this.MAX_RETRIES) {
                    throw error;
                }

                this.logger.debug(`Retry ${attempt}/${this.MAX_RETRIES} for ${topic}`);
                await this.delay(1000 * attempt); // Exponential backoff
            }
        }

        throw lastError;
    }

    /**
     * Register Shopify webhook
     */
    private async registerShopifyWebhook(
        channel: any,
        topic: WebhookTopic,
        webhookUrl: string
    ): Promise<number> {
        const url = `https://${channel.shopDomain}/admin/api/2024-01/webhooks.json`;
        const payload = this.formatShopifyWebhookPayload(topic, '', webhookUrl);

        const response = await firstValueFrom(
            this.httpService.post(url, payload, {
                headers: {
                    'X-Shopify-Access-Token': channel.accessToken,
                    'Content-Type': 'application/json',
                },
            })
        );

        return response.data.webhook.id;
    }

    /**
     * Register WooCommerce webhook
     */
    private async registerWooCommerceWebhook(
        channel: any,
        topic: WebhookTopic,
        secret: string,
        webhookUrl: string
    ): Promise<number> {
        const url = `${channel.storeUrl}/wp-json/wc/v3/webhooks`;
        const payload = this.formatWooCommerceWebhookPayload(topic, secret, webhookUrl);

        const auth = Buffer.from(`${channel.accessToken}:${channel.consumerSecret}`).toString('base64');

        const response = await firstValueFrom(
            this.httpService.post(url, payload, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json',
                },
            })
        );

        return response.data.id;
    }

    /**
     * Rollback registered webhooks
     */
    private async rollbackWebhooks(
        channel: any,
        channelType: ChannelType,
        webhooks: RegisteredWebhook[]
    ): Promise<void> {
        for (const webhook of webhooks) {
            try {
                if (channelType === ChannelType.SHOPIFY) {
                    const url = `https://${channel.shopDomain}/admin/api/2024-01/webhooks/${webhook.id}.json`;
                    await firstValueFrom(
                        this.httpService.delete(url, {
                            headers: {
                                'X-Shopify-Access-Token': channel.accessToken,
                            },
                        })
                    );
                } else {
                    const url = `${channel.storeUrl}/wp-json/wc/v3/webhooks/${webhook.id}`;
                    const auth = Buffer.from(`${channel.accessToken}:${channel.consumerSecret}`).toString('base64');
                    await firstValueFrom(
                        this.httpService.delete(url, {
                            headers: {
                                'Authorization': `Basic ${auth}`,
                            },
                        })
                    );
                }
                this.logger.debug(`Rolled back webhook ${webhook.id}`);
            } catch (error) {
                this.logger.warn(`Failed to rollback webhook ${webhook.id}:`, error);
            }
        }
    }

    /**
     * Format Shopify webhook payload
     */
    formatShopifyWebhookPayload(
        topic: WebhookTopic,
        secret: string,
        address: string
    ): { webhook: { topic: string; address: string; format: string } } {
        return {
            webhook: {
                topic: SHOPIFY_TOPICS[topic],
                address,
                format: 'json',
            },
        };
    }

    /**
     * Format WooCommerce webhook payload
     */
    formatWooCommerceWebhookPayload(
        topic: WebhookTopic,
        secret: string,
        deliveryUrl: string
    ): { name: string; topic: string; delivery_url: string; secret: string; status: string } {
        return {
            name: WOOCOMMERCE_NAMES[topic],
            topic: WOOCOMMERCE_TOPICS[topic],
            delivery_url: deliveryUrl,
            secret,
            status: 'active',
        };
    }

    /**
     * Generate cryptographically secure webhook secret (32+ bytes)
     */
    generateWebhookSecret(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Encrypt secret for database storage
     */
    encryptSecret(plaintext: string): string {
        const key = this.getEncryptionKey();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();

        // Combine IV + authTag + ciphertext
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }

    /**
     * Decrypt secret from database
     */
    decryptSecret(ciphertext: string): string {
        const key = this.getEncryptionKey();
        const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Get encryption key from config
     */
    private getEncryptionKey(): Buffer {
        const keyString = this.configService.get<string>('ENCRYPTION_KEY') || 'default-key-32-bytes-long-xxxxx';
        // Ensure 32 bytes for AES-256
        return crypto.createHash('sha256').update(keyString).digest();
    }

    /**
     * Check if error is transient and should be retried
     */
    isTransientError(error: any): boolean {
        const statusCode = error?.response?.status;
        const transientCodes = [429, 500, 502, 503, 504];

        if (transientCodes.includes(statusCode)) {
            return true;
        }

        // Network errors
        const networkErrors = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];
        if (networkErrors.includes(error?.code)) {
            return true;
        }

        return false;
    }

    /**
     * Delay helper for retry backoff
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
