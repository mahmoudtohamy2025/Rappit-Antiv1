/**
 * Webhook Verification Service (ORD-01)
 * 
 * Implements secure webhook signature verification for:
 * - Shopify: X-Shopify-Hmac-Sha256 (HMAC-SHA256, base64)
 * - WooCommerce: X-WC-Webhook-Signature (HMAC-SHA256, base64)
 * 
 * Security features:
 * - Timing-safe comparison (prevents timing attacks)
 * - Per-channel unique secrets
 * - Inactive channel rejection
 * - Cross-org isolation
 * - Audit logging
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import * as crypto from 'crypto';

/**
 * Channel types supported for webhook verification
 */
export enum ChannelType {
    SHOPIFY = 'SHOPIFY',
    WOOCOMMERCE = 'WOOCOMMERCE',
}

/**
 * Headers for webhook signatures
 */
const SIGNATURE_HEADERS: Record<ChannelType, string> = {
    [ChannelType.SHOPIFY]: 'x-shopify-hmac-sha256',
    [ChannelType.WOOCOMMERCE]: 'x-wc-webhook-signature',
};

/**
 * Result of webhook verification
 */
export interface WebhookVerificationResult {
    valid: boolean;
    channelId?: string;
    organizationId?: string;
    error?: string;
    statusCode?: number;
}

/**
 * Input for webhook verification
 */
export interface WebhookVerificationInput {
    channelId: string;
    channelType: ChannelType;
    signature: string;
    payload: string;
}

/**
 * Input for webhook verification with org check
 */
export interface WebhookVerificationWithOrgInput extends WebhookVerificationInput {
    organizationId: string;
}

@Injectable()
export class WebhookVerificationService {
    private readonly logger = new Logger(WebhookVerificationService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Verify webhook signature for a channel
     */
    async verifyWebhook(input: WebhookVerificationInput): Promise<WebhookVerificationResult> {
        const { channelId, channelType, signature, payload } = input;

        // Check for missing signature
        if (!signature) {
            this.logger.warn(`Webhook verification failed: missing signature for channel ${channelId}`);
            return {
                valid: false,
                error: 'Webhook signature is missing',
                statusCode: 401,
            };
        }

        // Fetch channel from database
        const channel = await this.prisma.channel.findUnique({
            where: { id: channelId },
        });

        // Check if channel exists
        if (!channel) {
            this.logger.warn(`Webhook verification failed: channel ${channelId} not found`);
            return {
                valid: false,
                error: 'Channel not found',
                statusCode: 404,
            };
        }

        // Check if channel is active
        if (channel.status !== 'ACTIVE') {
            this.logger.warn(`Webhook verification failed: channel ${channelId} is inactive`);
            return {
                valid: false,
                error: 'Channel is inactive',
                statusCode: 403,
            };
        }

        // Check if channel type matches
        if (channel.type !== channelType) {
            this.logger.warn(
                `Webhook verification failed: channel ${channelId} type mismatch (expected ${channelType}, got ${channel.type})`
            );
            return {
                valid: false,
                error: 'Channel type mismatch',
                statusCode: 400,
            };
        }

        // Check if webhook secret exists
        if (!channel.webhookSecret) {
            this.logger.warn(`Webhook verification failed: channel ${channelId} has no webhook secret`);
            return {
                valid: false,
                error: 'Channel webhook secret not configured',
                statusCode: 500,
            };
        }

        // Generate expected signature
        const expectedSignature = this.generateSignature(payload, channel.webhookSecret);

        // Timing-safe comparison
        const isValid = this.verifySignature(signature, expectedSignature);

        if (!isValid) {
            this.logger.warn(`Webhook verification failed: invalid signature for channel ${channelId}`);
            return {
                valid: false,
                error: 'Invalid webhook signature',
                statusCode: 401,
            };
        }

        this.logger.debug(`Webhook verified successfully for channel ${channelId}`);
        return {
            valid: true,
            channelId: channel.id,
            organizationId: channel.organizationId,
        };
    }

    /**
     * Verify webhook with organization check
     */
    async verifyWebhookWithOrg(input: WebhookVerificationWithOrgInput): Promise<WebhookVerificationResult> {
        const { organizationId, ...verifyInput } = input;

        // First, verify the signature
        const result = await this.verifyWebhook(verifyInput);

        if (!result.valid) {
            return result;
        }

        // Check organization match
        if (result.organizationId !== organizationId) {
            this.logger.warn(
                `Webhook verification failed: organization mismatch for channel ${input.channelId} ` +
                `(expected ${organizationId}, got ${result.organizationId})`
            );
            return {
                valid: false,
                error: 'Channel does not belong to this organization',
                statusCode: 403,
            };
        }

        return result;
    }

    /**
     * Generate HMAC-SHA256 signature (base64)
     */
    generateSignature(payload: string, secret: string): string {
        return crypto
            .createHmac('sha256', secret)
            .update(payload, 'utf8')
            .digest('base64');
    }

    /**
     * Verify signature using timing-safe comparison
     */
    verifySignature(provided: string, expected: string): boolean {
        // Convert to buffers for timing-safe comparison
        const providedBuffer = Buffer.from(provided);
        const expectedBuffer = Buffer.from(expected);

        // If lengths differ, we still need to do a comparison
        // to avoid timing attacks on length
        if (providedBuffer.length !== expectedBuffer.length) {
            // Compare against itself to maintain constant time
            // but return false
            this.timingSafeEqual(expectedBuffer, expectedBuffer);
            return false;
        }

        return this.timingSafeEqual(providedBuffer, expectedBuffer);
    }

    /**
     * Timing-safe buffer comparison
     * Prevents timing attacks by taking constant time regardless of match
     */
    timingSafeEqual(a: Buffer, b: Buffer): boolean {
        if (a.length !== b.length) {
            return false;
        }
        return crypto.timingSafeEqual(a, b);
    }

    /**
     * Extract signature from request headers
     */
    extractSignature(headers: Record<string, string>, channelType: ChannelType): string | null {
        const headerName = SIGNATURE_HEADERS[channelType];

        // Headers may be case-insensitive
        for (const [key, value] of Object.entries(headers)) {
            if (key.toLowerCase() === headerName) {
                return value;
            }
        }

        return null;
    }

    /**
     * Get the expected header name for a channel type
     */
    getSignatureHeader(channelType: ChannelType): string {
        return SIGNATURE_HEADERS[channelType];
    }

    /**
     * Validate that a signature looks valid (basic format check)
     */
    isValidSignatureFormat(signature: string): boolean {
        if (!signature || signature.length < 10) {
            return false;
        }

        // Base64 pattern
        const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
        return base64Pattern.test(signature);
    }
}
