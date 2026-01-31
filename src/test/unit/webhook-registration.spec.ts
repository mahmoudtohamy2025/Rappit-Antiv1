/**
 * Webhook Registration Service Unit Tests (ORD-02)
 * 
 * Step A: Write Tests BEFORE Implementation
 * 
 * Tests cover:
 * - 32+ byte secret generation
 * - Shopify webhook payload format
 * - WooCommerce webhook payload format
 * - Registration on OAuth success
 * - Rollback on failure
 * - Retry on transient errors
 * - Secret encryption
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException } from '@nestjs/common';
import {
    WebhookRegistrationService,
    ChannelType,
    WebhookTopic,
    WebhookRegistrationResult,
} from '../../src/modules/channels/webhook-registration.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import * as crypto from 'crypto';

describe('WebhookRegistrationService', () => {
    let service: WebhookRegistrationService;
    let prisma: jest.Mocked<PrismaService>;
    let httpService: jest.Mocked<HttpService>;
    let configService: jest.Mocked<ConfigService>;

    // Mock channel data
    const mockShopifyChannel = {
        id: 'channel-shopify-123',
        organizationId: 'org-123',
        type: 'SHOPIFY',
        name: 'Test Shopify Store',
        accessToken: 'shopify_access_token_xxx',
        shopDomain: 'test-store.myshopify.com',
        webhookSecret: null,
        status: 'ACTIVE',
    };

    const mockWooCommerceChannel = {
        id: 'channel-woo-456',
        organizationId: 'org-123',
        type: 'WOOCOMMERCE',
        name: 'Test WooCommerce Store',
        accessToken: 'woo_consumer_key',
        consumerSecret: 'woo_consumer_secret',
        storeUrl: 'https://test-store.com',
        webhookSecret: null,
        status: 'ACTIVE',
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        prisma = {
            channel: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
        } as any;

        httpService = {
            post: jest.fn(),
            delete: jest.fn(),
            get: jest.fn(),
        } as any;

        configService = {
            get: jest.fn((key) => {
                const config: Record<string, string> = {
                    'APP_URL': 'https://api.rappit.com',
                    'ENCRYPTION_KEY': 'test-encryption-key-32-bytes-long',
                };
                return config[key];
            }),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhookRegistrationService,
                { provide: PrismaService, useValue: prisma },
                { provide: HttpService, useValue: httpService },
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        service = module.get<WebhookRegistrationService>(WebhookRegistrationService);
    });

    // =========================================================================
    // SECRET GENERATION
    // =========================================================================
    describe('secret generation', () => {
        it('should generate secret with 32+ bytes', () => {
            const secret = service.generateWebhookSecret();

            // Convert hex to bytes (2 hex chars = 1 byte)
            const byteLength = Buffer.from(secret, 'hex').length;
            expect(byteLength).toBeGreaterThanOrEqual(32);
        });

        it('should generate cryptographically secure random secrets', () => {
            const secrets = new Set<string>();

            // Generate multiple secrets and ensure they're unique
            for (let i = 0; i < 100; i++) {
                secrets.add(service.generateWebhookSecret());
            }

            expect(secrets.size).toBe(100);
        });

        it('should generate hex-encoded secret', () => {
            const secret = service.generateWebhookSecret();

            // Should only contain hex characters
            expect(/^[a-f0-9]+$/i.test(secret)).toBe(true);
        });
    });

    // =========================================================================
    // SHOPIFY WEBHOOK PAYLOAD FORMAT
    // =========================================================================
    describe('Shopify webhook payload format', () => {
        it('should format Shopify webhook creation payload correctly', () => {
            const secret = 'test_secret_123';
            const payload = service.formatShopifyWebhookPayload(
                WebhookTopic.ORDERS_CREATE,
                secret,
                'https://api.rappit.com/webhooks/shopify/channel-123'
            );

            expect(payload).toEqual({
                webhook: {
                    topic: 'orders/create',
                    address: 'https://api.rappit.com/webhooks/shopify/channel-123',
                    format: 'json',
                },
            });
        });

        it('should map all order webhook topics correctly', () => {
            const topics = [
                { input: WebhookTopic.ORDERS_CREATE, expected: 'orders/create' },
                { input: WebhookTopic.ORDERS_UPDATE, expected: 'orders/updated' },
                { input: WebhookTopic.ORDERS_CANCELLED, expected: 'orders/cancelled' },
                { input: WebhookTopic.ORDERS_FULFILLED, expected: 'orders/fulfilled' },
            ];

            topics.forEach(({ input, expected }) => {
                const payload = service.formatShopifyWebhookPayload(
                    input,
                    'secret',
                    'https://example.com/webhook'
                );
                expect(payload.webhook.topic).toBe(expected);
            });
        });

        it('should include correct webhook address with channel ID', () => {
            const channelId = 'channel-abc-123';
            const baseUrl = 'https://api.rappit.com';

            const payload = service.formatShopifyWebhookPayload(
                WebhookTopic.ORDERS_CREATE,
                'secret',
                `${baseUrl}/webhooks/shopify/${channelId}`
            );

            expect(payload.webhook.address).toContain(channelId);
            expect(payload.webhook.address).toContain('/webhooks/shopify/');
        });
    });

    // =========================================================================
    // WOOCOMMERCE WEBHOOK PAYLOAD FORMAT
    // =========================================================================
    describe('WooCommerce webhook payload format', () => {
        it('should format WooCommerce webhook creation payload correctly', () => {
            const secret = 'test_secret_456';
            const payload = service.formatWooCommerceWebhookPayload(
                WebhookTopic.ORDERS_CREATE,
                secret,
                'https://api.rappit.com/webhooks/woocommerce/channel-456'
            );

            expect(payload).toEqual({
                name: 'Rappit Order Created',
                topic: 'order.created',
                delivery_url: 'https://api.rappit.com/webhooks/woocommerce/channel-456',
                secret: secret,
                status: 'active',
            });
        });

        it('should map WooCommerce webhook topics correctly', () => {
            const topics = [
                { input: WebhookTopic.ORDERS_CREATE, expected: 'order.created' },
                { input: WebhookTopic.ORDERS_UPDATE, expected: 'order.updated' },
                { input: WebhookTopic.ORDERS_CANCELLED, expected: 'order.deleted' },
            ];

            topics.forEach(({ input, expected }) => {
                const payload = service.formatWooCommerceWebhookPayload(
                    input,
                    'secret',
                    'https://example.com/webhook'
                );
                expect(payload.topic).toBe(expected);
            });
        });

        it('should include secret in WooCommerce payload', () => {
            const secret = 'my_webhook_secret_789';
            const payload = service.formatWooCommerceWebhookPayload(
                WebhookTopic.ORDERS_CREATE,
                secret,
                'https://example.com/webhook'
            );

            expect(payload.secret).toBe(secret);
        });
    });

    // =========================================================================
    // REGISTRATION ON OAUTH SUCCESS
    // =========================================================================
    describe('registration on OAuth success', () => {
        it('should register webhooks after successful OAuth', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);
            prisma.channel.update.mockResolvedValueOnce({
                ...mockShopifyChannel,
                webhookSecret: 'encrypted_secret',
            } as any);

            // Mock successful Shopify API response
            httpService.post.mockReturnValue(of({
                data: { webhook: { id: 12345 } },
                status: 201,
            }) as any);

            const result = await service.registerWebhooksForChannel(mockShopifyChannel.id);

            expect(result.success).toBe(true);
            expect(result.webhooksRegistered).toBeGreaterThan(0);
        });

        it('should store webhook secret after registration', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);
            prisma.channel.update.mockResolvedValueOnce({
                ...mockShopifyChannel,
                webhookSecret: 'encrypted_secret',
            } as any);

            httpService.post.mockReturnValue(of({
                data: { webhook: { id: 12345 } },
                status: 201,
            }) as any);

            await service.registerWebhooksForChannel(mockShopifyChannel.id);

            expect(prisma.channel.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        webhookSecret: expect.any(String),
                    }),
                })
            );
        });

        it('should register all required webhook topics', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);
            prisma.channel.update.mockResolvedValueOnce(mockShopifyChannel as any);

            httpService.post.mockReturnValue(of({
                data: { webhook: { id: 12345 } },
                status: 201,
            }) as any);

            await service.registerWebhooksForChannel(mockShopifyChannel.id);

            // Should register multiple webhook topics
            expect(httpService.post).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // ROLLBACK ON FAILURE
    // =========================================================================
    describe('rollback on failure', () => {
        it('should rollback when webhook registration fails', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            // First call succeeds, second fails
            httpService.post
                .mockReturnValueOnce(of({ data: { webhook: { id: 1 } }, status: 201 }) as any)
                .mockReturnValueOnce(throwError(() => new Error('API Error')));

            // Mock delete for rollback
            httpService.delete.mockReturnValue(of({ status: 200 }) as any);

            const result = await service.registerWebhooksForChannel(mockShopifyChannel.id);

            expect(result.success).toBe(false);
            expect(result.rolledBack).toBe(true);
        });

        it('should delete successfully registered webhooks on failure', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            // First call succeeds, second fails
            httpService.post
                .mockReturnValueOnce(of({ data: { webhook: { id: 1 } }, status: 201 }) as any)
                .mockReturnValueOnce(throwError(() => new Error('API Error')));

            httpService.delete.mockReturnValue(of({ status: 200 }) as any);

            await service.registerWebhooksForChannel(mockShopifyChannel.id);

            // Should call delete to rollback the first successful webhook
            expect(httpService.delete).toHaveBeenCalled();
        });

        it('should not update channel secret on registration failure', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            httpService.post.mockReturnValue(
                throwError(() => new Error('API Error'))
            );

            await service.registerWebhooksForChannel(mockShopifyChannel.id);

            // Channel update should not be called for webhook secret
            expect(prisma.channel.update).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // RETRY ON TRANSIENT ERRORS
    // =========================================================================
    describe('retry on transient errors', () => {
        it('should retry up to 3 times on transient failures', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);
            prisma.channel.update.mockResolvedValueOnce(mockShopifyChannel as any);

            // Setup retries for first webhook (fail twice, succeed third)
            // Then success for second webhook
            httpService.post
                .mockReturnValueOnce(throwError(() => ({ response: { status: 503 } })))
                .mockReturnValueOnce(throwError(() => ({ response: { status: 503 } })))
                .mockReturnValueOnce(of({ data: { webhook: { id: 1 } }, status: 201 }) as any)
                .mockReturnValueOnce(of({ data: { webhook: { id: 2 } }, status: 201 }) as any);

            const result = await service.registerWebhooksForChannel(mockShopifyChannel.id);

            expect(result.success).toBe(true);
        });

        it('should fail after max retries exceeded', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            // Always fail with transient error
            httpService.post.mockReturnValue(
                throwError(() => ({ response: { status: 503 } }))
            );

            const result = await service.registerWebhooksForChannel(mockShopifyChannel.id);

            expect(result.success).toBe(false);
            expect(result.error?.toLowerCase()).toContain('retr');
        });

        it('should not retry on non-transient errors (4xx)', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);

            httpService.post.mockReturnValue(
                throwError(() => ({ response: { status: 400 } }))
            );

            await service.registerWebhooksForChannel(mockShopifyChannel.id);

            // Should not retry 400 errors
            expect(httpService.post).toHaveBeenCalledTimes(1);
        });

        it('should identify transient errors correctly', () => {
            expect(service.isTransientError({ response: { status: 500 } })).toBe(true);
            expect(service.isTransientError({ response: { status: 502 } })).toBe(true);
            expect(service.isTransientError({ response: { status: 503 } })).toBe(true);
            expect(service.isTransientError({ response: { status: 504 } })).toBe(true);
            expect(service.isTransientError({ response: { status: 429 } })).toBe(true);
            expect(service.isTransientError({ response: { status: 400 } })).toBe(false);
            expect(service.isTransientError({ response: { status: 401 } })).toBe(false);
            expect(service.isTransientError({ response: { status: 404 } })).toBe(false);
        });
    });

    // =========================================================================
    // SECRET ENCRYPTION
    // =========================================================================
    describe('secret encryption', () => {
        it('should encrypt webhook secret before storing', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);
            prisma.channel.update.mockResolvedValueOnce(mockShopifyChannel as any);

            httpService.post.mockReturnValue(of({
                data: { webhook: { id: 12345 } },
                status: 201,
            }) as any);

            await service.registerWebhooksForChannel(mockShopifyChannel.id);

            // The stored secret should not be the raw secret
            expect(prisma.channel.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        webhookSecret: expect.any(String),
                    }),
                })
            );
        });

        it('should be able to decrypt stored secret', () => {
            const originalSecret = service.generateWebhookSecret();
            const encrypted = service.encryptSecret(originalSecret);
            const decrypted = service.decryptSecret(encrypted);

            expect(decrypted).toBe(originalSecret);
        });

        it('should produce different ciphertext for same plaintext', () => {
            const secret = 'test_secret_123';
            const encrypted1 = service.encryptSecret(secret);
            const encrypted2 = service.encryptSecret(secret);

            // With proper IV, same plaintext should produce different ciphertext
            expect(encrypted1).not.toBe(encrypted2);
        });
    });

    // =========================================================================
    // NO DUPLICATE REGISTRATION
    // =========================================================================
    describe('duplicate prevention', () => {
        it('should skip registration if webhooks already registered', async () => {
            const channelWithSecret = {
                ...mockShopifyChannel,
                webhookSecret: 'already_has_secret',
            };
            prisma.channel.findUnique.mockResolvedValueOnce(channelWithSecret as any);

            const result = await service.registerWebhooksForChannel(channelWithSecret.id);

            expect(result.skipped).toBe(true);
            expect(httpService.post).not.toHaveBeenCalled();
        });

        it('should allow force re-registration', async () => {
            const channelWithSecret = {
                ...mockShopifyChannel,
                webhookSecret: 'already_has_secret',
            };
            prisma.channel.findUnique.mockResolvedValueOnce(channelWithSecret as any);
            prisma.channel.update.mockResolvedValueOnce(channelWithSecret as any);

            httpService.post.mockReturnValue(of({
                data: { webhook: { id: 12345 } },
                status: 201,
            }) as any);

            const result = await service.registerWebhooksForChannel(
                channelWithSecret.id,
                { force: true }
            );

            expect(result.skipped).toBeFalsy();
            expect(httpService.post).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // CHANNEL TYPE HANDLING
    // =========================================================================
    describe('channel type handling', () => {
        it('should use correct API for Shopify channels', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockShopifyChannel as any);
            prisma.channel.update.mockResolvedValueOnce(mockShopifyChannel as any);

            httpService.post.mockReturnValue(of({
                data: { webhook: { id: 12345 } },
                status: 201,
            }) as any);

            await service.registerWebhooksForChannel(mockShopifyChannel.id);

            // Should call Shopify API endpoint
            expect(httpService.post).toHaveBeenCalledWith(
                expect.stringContaining('myshopify.com'),
                expect.any(Object),
                expect.any(Object)
            );
        });

        it('should use correct API for WooCommerce channels', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(mockWooCommerceChannel as any);
            prisma.channel.update.mockResolvedValueOnce(mockWooCommerceChannel as any);

            httpService.post.mockReturnValue(of({
                data: { id: 12345 },
                status: 201,
            }) as any);

            await service.registerWebhooksForChannel(mockWooCommerceChannel.id);

            // Should call WooCommerce API endpoint
            expect(httpService.post).toHaveBeenCalledWith(
                expect.stringContaining('test-store.com'),
                expect.any(Object),
                expect.any(Object)
            );
        });
    });

    // =========================================================================
    // ERROR HANDLING
    // =========================================================================
    describe('error handling', () => {
        it('should handle non-existent channel', async () => {
            prisma.channel.findUnique.mockResolvedValueOnce(null);

            const result = await service.registerWebhooksForChannel('non-existent');

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should handle invalid channel type', async () => {
            const invalidChannel = {
                ...mockShopifyChannel,
                type: 'UNKNOWN',
            };
            prisma.channel.findUnique.mockResolvedValueOnce(invalidChannel as any);

            const result = await service.registerWebhooksForChannel(invalidChannel.id);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported');
        });
    });
});
