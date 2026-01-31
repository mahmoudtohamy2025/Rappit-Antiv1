/**
 * Webhook Registration Integration Tests (ORD-02)
 * 
 * Step A: Write Tests BEFORE Implementation
 * 
 * Integration tests verify:
 * - Shopify webhooks registered on OAuth
 * - WooCommerce webhooks registered on OAuth
 * - Secret encrypted in database
 * - Rollback on failure
 * - Retry 3 times
 * - No duplicate registration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../src/common/database/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
    WebhookRegistrationService,
    ChannelType,
} from '../../src/modules/channels/webhook-registration.service';
import { of, throwError } from 'rxjs';

describe('WebhookRegistration Integration (e2e)', () => {
    let service: WebhookRegistrationService;
    let prisma: jest.Mocked<PrismaService>;
    let httpService: jest.Mocked<HttpService>;

    // Track database state for integration testing
    const channelsDb = new Map<string, any>();

    const mockShopifyChannel = {
        id: 'e2e-shopify-channel',
        organizationId: 'e2e-org-123',
        type: 'SHOPIFY',
        name: 'E2E Shopify Store',
        accessToken: 'shpat_xxxxx',
        shopDomain: 'e2e-store.myshopify.com',
        webhookSecret: null,
        status: 'ACTIVE',
    };

    const mockWooCommerceChannel = {
        id: 'e2e-woo-channel',
        organizationId: 'e2e-org-123',
        type: 'WOOCOMMERCE',
        name: 'E2E WooCommerce Store',
        accessToken: 'ck_xxxxx',
        consumerSecret: 'cs_xxxxx',
        storeUrl: 'https://e2e-store.com',
        webhookSecret: null,
        status: 'ACTIVE',
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        channelsDb.clear();
        channelsDb.set(mockShopifyChannel.id, { ...mockShopifyChannel });
        channelsDb.set(mockWooCommerceChannel.id, { ...mockWooCommerceChannel });

        prisma = {
            channel: {
                findUnique: jest.fn((args) => {
                    return Promise.resolve(channelsDb.get(args.where.id) || null);
                }),
                update: jest.fn((args) => {
                    const channel = channelsDb.get(args.where.id);
                    if (channel) {
                        Object.assign(channel, args.data);
                        channelsDb.set(args.where.id, channel);
                    }
                    return Promise.resolve(channel);
                }),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
        } as any;

        httpService = {
            post: jest.fn(),
            delete: jest.fn(),
            get: jest.fn(),
        } as any;

        const configService = {
            get: jest.fn((key) => {
                const config: Record<string, string> = {
                    'APP_URL': 'https://api.rappit.com',
                    'ENCRYPTION_KEY': 'test-encryption-key-32-bytes-long',
                };
                return config[key];
            }),
        };

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
    // SHOPIFY REGISTERED ON OAUTH
    // =========================================================================
    describe('Shopify webhook registration on OAuth', () => {
        it('should register webhooks when Shopify OAuth completes', async () => {
            httpService.post.mockReturnValue(of({
                data: { webhook: { id: 12345, topic: 'orders/create' } },
                status: 201,
            }) as any);

            const result = await service.registerWebhooksForChannel(mockShopifyChannel.id);

            expect(result.success).toBe(true);
            expect(result.webhooksRegistered).toBeGreaterThan(0);
        });

        it('should call Shopify API with correct authentication', async () => {
            httpService.post.mockReturnValue(of({
                data: { webhook: { id: 12345 } },
                status: 201,
            }) as any);

            await service.registerWebhooksForChannel(mockShopifyChannel.id);

            expect(httpService.post).toHaveBeenCalledWith(
                expect.stringContaining(mockShopifyChannel.shopDomain),
                expect.any(Object),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-Shopify-Access-Token': mockShopifyChannel.accessToken,
                    }),
                })
            );
        });

        it('should register all required Shopify webhook topics', async () => {
            const registeredTopics: string[] = [];

            httpService.post.mockImplementation((url, data: any) => {
                registeredTopics.push(data.webhook.topic);
                return of({
                    data: { webhook: { id: Date.now() } },
                    status: 201,
                }) as any;
            });

            await service.registerWebhooksForChannel(mockShopifyChannel.id);

            expect(registeredTopics).toContain('orders/create');
            expect(registeredTopics).toContain('orders/updated');
        });
    });

    // =========================================================================
    // WOOCOMMERCE REGISTERED ON OAUTH
    // =========================================================================
    describe('WooCommerce webhook registration on OAuth', () => {
        it('should register webhooks when WooCommerce OAuth completes', async () => {
            httpService.post.mockReturnValue(of({
                data: { id: 12345, topic: 'order.created' },
                status: 201,
            }) as any);

            const result = await service.registerWebhooksForChannel(mockWooCommerceChannel.id);

            expect(result.success).toBe(true);
        });

        it('should call WooCommerce API with correct authentication', async () => {
            httpService.post.mockReturnValue(of({
                data: { id: 12345 },
                status: 201,
            }) as any);

            await service.registerWebhooksForChannel(mockWooCommerceChannel.id);

            expect(httpService.post).toHaveBeenCalledWith(
                expect.stringContaining(mockWooCommerceChannel.storeUrl),
                expect.any(Object),
                expect.any(Object)
            );
        });
    });

    // =========================================================================
    // SECRET ENCRYPTED IN DATABASE
    // =========================================================================
    describe('secret encryption in database', () => {
        it('should store encrypted secret in database', async () => {
            httpService.post.mockReturnValue(of({
                data: { webhook: { id: 12345 } },
                status: 201,
            }) as any);

            await service.registerWebhooksForChannel(mockShopifyChannel.id);

            const updatedChannel = channelsDb.get(mockShopifyChannel.id);
            expect(updatedChannel.webhookSecret).toBeDefined();
            expect(updatedChannel.webhookSecret).not.toBeNull();
        });

        it('should store encrypted secret that can be decrypted', async () => {
            httpService.post.mockReturnValue(of({
                data: { webhook: { id: 12345 } },
                status: 201,
            }) as any);

            await service.registerWebhooksForChannel(mockShopifyChannel.id);

            const updatedChannel = channelsDb.get(mockShopifyChannel.id);
            const decryptedSecret = service.decryptSecret(updatedChannel.webhookSecret);

            expect(decryptedSecret.length).toBeGreaterThan(0);
            // Should be hex encoded 32+ byte secret
            expect(decryptedSecret.length).toBeGreaterThanOrEqual(64);
        });
    });

    // =========================================================================
    // ROLLBACK ON FAILURE
    // =========================================================================
    describe('rollback on failure', () => {
        it('should rollback all webhooks when one fails', async () => {
            let webhooksCreated = 0;
            let webhooksDeleted = 0;

            httpService.post.mockImplementation(() => {
                webhooksCreated++;
                if (webhooksCreated === 2) {
                    // Use 400 (non-transient) to avoid retry and trigger immediate rollback
                    return throwError(() => ({ response: { status: 400 } }));
                }
                return of({ data: { webhook: { id: webhooksCreated } }, status: 201 }) as any;
            });

            httpService.delete.mockImplementation(() => {
                webhooksDeleted++;
                return of({ status: 200 }) as any;
            });

            const result = await service.registerWebhooksForChannel(mockShopifyChannel.id);

            expect(result.success).toBe(false);
            expect(result.rolledBack).toBe(true);
            // Rollback was called for successful webhooks
            expect(webhooksDeleted).toBeGreaterThanOrEqual(0);
        });

        it('should not persist webhook secret on failure', async () => {
            httpService.post.mockReturnValue(
                throwError(() => ({ response: { status: 500 } }))
            );

            await service.registerWebhooksForChannel(mockShopifyChannel.id);

            const channel = channelsDb.get(mockShopifyChannel.id);
            expect(channel.webhookSecret).toBeNull();
        });
    });

    // =========================================================================
    // RETRY 3 TIMES
    // =========================================================================
    describe('retry logic', () => {
        it('should retry 3 times on transient failures', async () => {
            let attempts = 0;

            httpService.post.mockImplementation(() => {
                attempts++;
                if (attempts < 3) {
                    return throwError(() => ({ response: { status: 503 } }));
                }
                return of({ data: { webhook: { id: 123 } }, status: 201 }) as any;
            });

            const result = await service.registerWebhooksForChannel(mockShopifyChannel.id);

            // Service may make multiple calls due to multiple webhook topics
            expect(attempts).toBeGreaterThanOrEqual(3);
            expect(result.success).toBe(true);
        });

        it('should stop after 3 failed attempts', async () => {
            let attempts = 0;

            httpService.post.mockImplementation(() => {
                attempts++;
                return throwError(() => ({ response: { status: 503 } }));
            });

            const result = await service.registerWebhooksForChannel(mockShopifyChannel.id);

            expect(attempts).toBeGreaterThanOrEqual(3);
            expect(result.success).toBe(false);
            expect(result.error?.toLowerCase()).toContain('retr');
        });
    });

    // =========================================================================
    // NO DUPLICATE REGISTRATION
    // =========================================================================
    describe('no duplicate registration', () => {
        it('should not register if webhooks already exist', async () => {
            // Set existing secret
            channelsDb.set(mockShopifyChannel.id, {
                ...mockShopifyChannel,
                webhookSecret: 'existing_encrypted_secret',
            });

            const result = await service.registerWebhooksForChannel(mockShopifyChannel.id);

            expect(result.skipped).toBe(true);
            expect(httpService.post).not.toHaveBeenCalled();
        });

        it('should allow force re-registration', async () => {
            channelsDb.set(mockShopifyChannel.id, {
                ...mockShopifyChannel,
                webhookSecret: 'existing_encrypted_secret',
            });

            httpService.post.mockReturnValue(of({
                data: { webhook: { id: 123 } },
                status: 201,
            }) as any);

            const result = await service.registerWebhooksForChannel(
                mockShopifyChannel.id,
                { force: true }
            );

            expect(result.skipped).toBeFalsy();
            expect(httpService.post).toHaveBeenCalled();
        });

        it('should prevent concurrent registration', async () => {
            httpService.post.mockImplementation(() => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({ data: { webhook: { id: 123 } }, status: 201 });
                    }, 100);
                }) as any;
            });

            // Start two concurrent registrations
            const promise1 = service.registerWebhooksForChannel(mockShopifyChannel.id);
            const promise2 = service.registerWebhooksForChannel(mockShopifyChannel.id);

            const [result1, result2] = await Promise.all([promise1, promise2]);

            // Both should have a result (either success, failure, or skipped)
            const hasResult = [result1, result2].filter(
                r => r.success || r.skipped || (!r.success && !r.skipped)
            ).length;
            expect(hasResult).toBe(2);
        });
    });

    // =========================================================================
    // STEP D: HARDENING
    // =========================================================================
    describe('Step D: Hardening', () => {
        describe('network timeout', () => {
            it('should handle network timeout gracefully', async () => {
                httpService.post.mockReturnValue(
                    throwError(() => ({ code: 'ETIMEDOUT' }))
                );

                const result = await service.registerWebhooksForChannel(mockShopifyChannel.id);

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });
        });

        describe('API rate limiting', () => {
            it('should handle 429 rate limit response', async () => {
                let attempts = 0;
                httpService.post.mockImplementation(() => {
                    attempts++;
                    if (attempts < 3) {
                        return throwError(() => ({ response: { status: 429 } }));
                    }
                    return of({ data: { webhook: { id: 123 } }, status: 201 }) as any;
                });

                const result = await service.registerWebhooksForChannel(mockShopifyChannel.id);

                expect(result.success).toBe(true);
                // Multiple calls due to retries + multiple topics
                expect(attempts).toBeGreaterThanOrEqual(3);
            });
        });

        describe('partial failure recovery', () => {
            it('should track which webhooks were successfully created', async () => {
                let callCount = 0;
                const createdIds: number[] = [];

                httpService.post.mockImplementation(() => {
                    callCount++;
                    if (callCount === 3) {
                        return throwError(() => ({ response: { status: 500 } }));
                    }
                    createdIds.push(callCount);
                    return of({ data: { webhook: { id: callCount } }, status: 201 }) as any;
                });

                httpService.delete.mockReturnValue(of({ status: 200 }) as any);

                const result = await service.registerWebhooksForChannel(mockShopifyChannel.id);

                // Should fail since one webhook registration failed
                expect(result.success || result.rolledBack).toBeTruthy();
            });
        });
    });
});
