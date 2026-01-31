/**
 * Webhook Verification Service Unit Tests (ORD-01)
 * 
 * Step A: Write Tests BEFORE Implementation
 * 
 * Tests cover:
 * - Shopify HMAC-SHA256 verification
 * - WooCommerce HMAC-SHA256 verification (base64)
 * - Timing-safe comparison
 * - Invalid/missing signatures
 * - Inactive channels
 * - Cross-org security
 * 
 * Headers:
 * - Shopify: X-Shopify-Hmac-Sha256 (base64)
 * - WooCommerce: X-WC-Webhook-Signature (base64)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import {
    WebhookVerificationService,
    ChannelType,
    WebhookVerificationResult
} from '../../src/modules/channels/webhook-verification.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import * as crypto from 'crypto';

describe('WebhookVerificationService', () => {
    let service: WebhookVerificationService;
    let prisma: jest.Mocked<PrismaService>;

    // Test secrets
    const shopifySecret = 'shopify_webhook_secret_test_123';
    const woocommerceSecret = 'woocommerce_webhook_secret_test_456';

    // Sample webhook payloads
    const samplePayload = JSON.stringify({
        id: 12345,
        order_number: 'ORD-001',
        total_price: '99.99',
    });

    // Generate valid HMAC signatures
    const generateShopifySignature = (payload: string, secret: string): string => {
        return crypto
            .createHmac('sha256', secret)
            .update(payload, 'utf8')
            .digest('base64');
    };

    const generateWooCommerceSignature = (payload: string, secret: string): string => {
        return crypto
            .createHmac('sha256', secret)
            .update(payload, 'utf8')
            .digest('base64');
    };

    // Mock channel data
    const mockShopifyChannel = {
        id: 'channel-shopify-123',
        organizationId: 'org-123',
        type: 'SHOPIFY',
        name: 'Test Shopify Store',
        webhookSecret: shopifySecret,
        status: 'ACTIVE',
        config: {},
    };

    const mockWooCommerceChannel = {
        id: 'channel-woo-456',
        organizationId: 'org-123',
        type: 'WOOCOMMERCE',
        name: 'Test WooCommerce Store',
        webhookSecret: woocommerceSecret,
        status: 'ACTIVE',
        config: {},
    };

    const mockInactiveChannel = {
        id: 'channel-inactive-789',
        organizationId: 'org-123',
        type: 'SHOPIFY',
        name: 'Inactive Store',
        webhookSecret: 'inactive_secret',
        status: 'INACTIVE',
        config: {},
    };

    beforeEach(async () => {
        prisma = {
            channel: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
            },
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhookVerificationService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<WebhookVerificationService>(WebhookVerificationService);
    });

    // =========================================================================
    // SHOPIFY HMAC VERIFICATION
    // =========================================================================
    describe('Shopify webhook verification', () => {
        it('should verify valid Shopify HMAC signature', async () => {
            const signature = generateShopifySignature(samplePayload, shopifySecret);
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature,
                payload: samplePayload,
            });

            expect(result.valid).toBe(true);
            expect(result.channelId).toBe(mockShopifyChannel.id);
        });

        it('should reject invalid Shopify HMAC signature', async () => {
            const invalidSignature = 'invalid_signature_abc123';
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature: invalidSignature,
                payload: samplePayload,
            });

            expect(result.valid).toBe(false);
            expect(result.error).toContain('signature');
        });

        it('should reject when payload is tampered', async () => {
            const signature = generateShopifySignature(samplePayload, shopifySecret);
            const tamperedPayload = JSON.stringify({ id: 99999, hacked: true });
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature,
                payload: tamperedPayload,
            });

            expect(result.valid).toBe(false);
        });

        it('should reject signature from wrong secret', async () => {
            const wrongSignature = generateShopifySignature(samplePayload, 'wrong_secret');
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature: wrongSignature,
                payload: samplePayload,
            });

            expect(result.valid).toBe(false);
        });
    });

    // =========================================================================
    // WOOCOMMERCE HMAC VERIFICATION
    // =========================================================================
    describe('WooCommerce webhook verification', () => {
        it('should verify valid WooCommerce HMAC signature', async () => {
            const signature = generateWooCommerceSignature(samplePayload, woocommerceSecret);
            prisma.channel.findUnique.mockResolvedValueOnce(mockWooCommerceChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockWooCommerceChannel.id,
                channelType: ChannelType.WOOCOMMERCE,
                signature,
                payload: samplePayload,
            });

            expect(result.valid).toBe(true);
        });

        it('should reject invalid WooCommerce HMAC signature', async () => {
            const invalidSignature = 'invalid_woo_signature';
            prisma.channel.findUnique.mockResolvedValueOnce(mockWooCommerceChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockWooCommerceChannel.id,
                channelType: ChannelType.WOOCOMMERCE,
                signature: invalidSignature,
                payload: samplePayload,
            });

            expect(result.valid).toBe(false);
        });

        it('should reject WooCommerce signature from wrong secret', async () => {
            const wrongSignature = generateWooCommerceSignature(samplePayload, 'wrong_secret');
            prisma.channel.findUnique.mockResolvedValueOnce(mockWooCommerceChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockWooCommerceChannel.id,
                channelType: ChannelType.WOOCOMMERCE,
                signature: wrongSignature,
                payload: samplePayload,
            });

            expect(result.valid).toBe(false);
        });
    });

    // =========================================================================
    // TIMING-SAFE COMPARISON
    // =========================================================================
    describe('timing-safe comparison', () => {
        it('should use timing-safe comparison to prevent timing attacks', async () => {
            // This test verifies that the service uses crypto.timingSafeEqual
            // by checking that comparison time is consistent regardless of
            // where the signature differs

            const signature = generateShopifySignature(samplePayload, shopifySecret);
            prisma.channel.findUnique.mockResolvedValue(mockShopifyChannel as any);

            // Short signature (differs at start)
            const shortSig = 'a';

            // Same length but wrong (differs at end)
            const wrongEnd = signature.slice(0, -1) + 'X';

            const start1 = Date.now();
            await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature: shortSig,
                payload: samplePayload,
            });
            const time1 = Date.now() - start1;

            const start2 = Date.now();
            await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature: wrongEnd,
                payload: samplePayload,
            });
            const time2 = Date.now() - start2;

            // Times should be similar (within reasonable margin)
            // This is a basic check; proper timing attack testing requires more sophisticated methods
            expect(Math.abs(time1 - time2)).toBeLessThan(100);
        });

        it('should use crypto.timingSafeEqual internally', () => {
            // Verify the service exposes a method that uses timing-safe comparison
            expect(service.timingSafeEqual).toBeDefined();

            const a = Buffer.from('test_signature');
            const b = Buffer.from('test_signature');
            const c = Buffer.from('diff_signature');

            expect(service.timingSafeEqual(a, b)).toBe(true);
            expect(service.timingSafeEqual(a, c)).toBe(false);
        });
    });

    // =========================================================================
    // MISSING SIGNATURE
    // =========================================================================
    describe('missing signature handling', () => {
        it('should reject request with missing signature', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature: '',
                payload: samplePayload,
            });

            expect(result.valid).toBe(false);
            expect(result.error).toContain('missing');
        });

        it('should reject request with null signature', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature: null as any,
                payload: samplePayload,
            });

            expect(result.valid).toBe(false);
        });

        it('should reject request with undefined signature', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature: undefined as any,
                payload: samplePayload,
            });

            expect(result.valid).toBe(false);
        });
    });

    // =========================================================================
    // INACTIVE CHANNEL
    // =========================================================================
    describe('inactive channel handling', () => {
        it('should reject webhook for inactive channel', async () => {
            const signature = generateShopifySignature(samplePayload, 'inactive_secret');
            prisma.channel.findUnique.mockResolvedValueOnce(mockInactiveChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockInactiveChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature,
                payload: samplePayload,
            });

            expect(result.valid).toBe(false);
            expect(result.error).toContain('inactive');
            expect(result.statusCode).toBe(403);
        });

        it('should reject webhook for non-existent channel', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(null);

            const result = await service.verifyWebhook({
                channelId: 'non-existent-channel',
                channelType: ChannelType.SHOPIFY,
                signature: 'any_signature',
                payload: samplePayload,
            });

            expect(result.valid).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    // =========================================================================
    // CROSS-ORG SECURITY
    // =========================================================================
    describe('cross-org security', () => {
        it('should reject webhook when organization ID does not match', async () => {
            const signature = generateShopifySignature(samplePayload, shopifySecret);
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhookWithOrg({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature,
                payload: samplePayload,
                organizationId: 'different-org-456', // Wrong org
            });

            expect(result.valid).toBe(false);
            expect(result.error).toContain('organization');
        });

        it('should accept webhook when organization ID matches', async () => {
            const signature = generateShopifySignature(samplePayload, shopifySecret);
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhookWithOrg({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature,
                payload: samplePayload,
                organizationId: 'org-123', // Correct org
            });

            expect(result.valid).toBe(true);
        });
    });

    // =========================================================================
    // CHANNEL TYPE VALIDATION
    // =========================================================================
    describe('channel type validation', () => {
        it('should reject when channel type does not match', async () => {
            const signature = generateShopifySignature(samplePayload, shopifySecret);
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.WOOCOMMERCE, // Wrong type
                signature,
                payload: samplePayload,
            });

            expect(result.valid).toBe(false);
            expect(result.error).toContain('type');
        });
    });

    // =========================================================================
    // AUDIT LOGGING
    // =========================================================================
    describe('audit logging', () => {
        it('should log verification failure with channel ID', async () => {
            const logSpy = jest.spyOn(service['logger'], 'warn');
            const invalidSignature = 'invalid_sig';
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature: invalidSignature,
                payload: samplePayload,
            });

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining(mockShopifyChannel.id)
            );
        });

        it('should log verification success', async () => {
            const logSpy = jest.spyOn(service['logger'], 'debug');
            const signature = generateShopifySignature(samplePayload, shopifySecret);
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature,
                payload: samplePayload,
            });

            expect(logSpy).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================
    describe('edge cases', () => {
        it('should handle empty payload', async () => {
            const emptyPayload = '';
            const signature = generateShopifySignature(emptyPayload, shopifySecret);
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature,
                payload: emptyPayload,
            });

            // Empty payload with valid signature should still work
            expect(result.valid).toBe(true);
        });

        it('should handle large payload', async () => {
            const largePayload = JSON.stringify({ data: 'x'.repeat(100000) });
            const signature = generateShopifySignature(largePayload, shopifySecret);
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature,
                payload: largePayload,
            });

            expect(result.valid).toBe(true);
        });

        it('should handle special characters in payload', async () => {
            const specialPayload = JSON.stringify({
                name: '日本語テスト',
                emoji: '🎉🔥',
                special: '<script>alert("xss")</script>',
            });
            const signature = generateShopifySignature(specialPayload, shopifySecret);
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            const result = await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature,
                payload: specialPayload,
            });

            expect(result.valid).toBe(true);
        });

        it('should handle missing webhook secret in channel', async () => {
            const channelWithoutSecret = { ...mockShopifyChannel, webhookSecret: null };
            prisma.channel.findUnique.mockResolvedValueOnce(channelWithoutSecret as any);

            const result = await service.verifyWebhook({
                channelId: mockShopifyChannel.id,
                channelType: ChannelType.SHOPIFY,
                signature: 'any_sig',
                payload: samplePayload,
            });

            expect(result.valid).toBe(false);
            expect(result.error).toContain('secret');
        });
    });

    // =========================================================================
    // HELPER METHODS
    // =========================================================================
    describe('helper methods', () => {
        it('should extract Shopify signature from headers', () => {
            const headers = {
                'x-shopify-hmac-sha256': 'test_signature_123',
            };

            const signature = service.extractSignature(headers, ChannelType.SHOPIFY);
            expect(signature).toBe('test_signature_123');
        });

        it('should extract WooCommerce signature from headers', () => {
            const headers = {
                'x-wc-webhook-signature': 'woo_signature_456',
            };

            const signature = service.extractSignature(headers, ChannelType.WOOCOMMERCE);
            expect(signature).toBe('woo_signature_456');
        });

        it('should return null for missing header', () => {
            const headers = {};

            const signature = service.extractSignature(headers, ChannelType.SHOPIFY);
            expect(signature).toBeNull();
        });

        it('should handle case-insensitive headers', () => {
            const headers = {
                'X-SHOPIFY-HMAC-SHA256': 'test_signature',
            };

            const signature = service.extractSignature(headers, ChannelType.SHOPIFY);
            expect(signature).toBe('test_signature');
        });
    });
});
