/**
 * Webhook Verification Guard Unit Tests (ORD-01)
 * 
 * Tests for the NestJS guard that wraps WebhookVerificationService.
 * Also includes Step D hardening tests.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
    WebhookVerificationGuard,
    WebhookChannelType,
    WEBHOOK_CHANNEL_TYPE,
    getWebhookContext,
} from '../../src/common/guards/webhook-verification.guard';
import {
    WebhookVerificationService,
    ChannelType
} from '../../src/modules/channels/webhook-verification.service';

describe('WebhookVerificationGuard', () => {
    let guard: WebhookVerificationGuard;
    let webhookService: jest.Mocked<WebhookVerificationService>;
    let reflector: Reflector;

    // Mock request factory
    const createMockContext = (overrides: any = {}): ExecutionContext => {
        const request = {
            params: { channelId: 'test-channel-123', channelType: 'shopify' },
            headers: {
                'x-shopify-hmac-sha256': 'valid_signature_abc123',
            },
            body: { order_id: 12345 },
            rawBody: Buffer.from(JSON.stringify({ order_id: 12345 })),
            ...overrides,
        };

        return {
            switchToHttp: () => ({
                getRequest: () => request,
            }),
            getHandler: () => (() => { }),
            getClass: () => ({}),
        } as unknown as ExecutionContext;
    };

    beforeEach(async () => {
        webhookService = {
            extractSignature: jest.fn().mockReturnValue('valid_signature_abc123'),
            verifyWebhook: jest.fn().mockResolvedValue({
                valid: true,
                channelId: 'test-channel-123',
                organizationId: 'org-123',
            }),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhookVerificationGuard,
                { provide: WebhookVerificationService, useValue: webhookService },
                Reflector,
            ],
        }).compile();

        guard = module.get<WebhookVerificationGuard>(WebhookVerificationGuard);
        reflector = module.get<Reflector>(Reflector);
    });

    // =========================================================================
    // GUARD ACTIVATION
    // =========================================================================
    describe('canActivate', () => {
        it('should allow request with valid signature', async () => {
            const context = createMockContext();

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });

        it('should call webhookService.extractSignature with headers', async () => {
            const context = createMockContext();

            await guard.canActivate(context);

            expect(webhookService.extractSignature).toHaveBeenCalledWith(
                expect.objectContaining({ 'x-shopify-hmac-sha256': 'valid_signature_abc123' }),
                ChannelType.SHOPIFY
            );
        });

        it('should call webhookService.verifyWebhook with correct params', async () => {
            const context = createMockContext();

            await guard.canActivate(context);

            expect(webhookService.verifyWebhook).toHaveBeenCalledWith({
                channelId: 'test-channel-123',
                channelType: ChannelType.SHOPIFY,
                signature: 'valid_signature_abc123',
                payload: expect.any(String),
            });
        });

        it('should attach verification context to request', async () => {
            const mockRequest: any = {
                params: { channelId: 'test-channel-123', channelType: 'shopify' },
                headers: { 'x-shopify-hmac-sha256': 'sig' },
                rawBody: Buffer.from('{}'),
            };

            const context = {
                switchToHttp: () => ({ getRequest: () => mockRequest }),
                getHandler: () => (() => { }),
            } as unknown as ExecutionContext;

            await guard.canActivate(context);

            expect(mockRequest.webhookVerification).toEqual({
                channelId: 'test-channel-123',
                organizationId: 'org-123',
                verified: true,
            });
        });
    });

    // =========================================================================
    // MISSING CHANNEL ID
    // =========================================================================
    describe('missing channelId', () => {
        it('should throw UnauthorizedException when channelId is missing', async () => {
            const context = createMockContext({
                params: { channelType: 'shopify' }, // No channelId
            });

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });
    });

    // =========================================================================
    // MISSING SIGNATURE
    // =========================================================================
    describe('missing signature', () => {
        it('should throw UnauthorizedException when signature header is missing', async () => {
            webhookService.extractSignature.mockReturnValueOnce(null);
            const context = createMockContext();

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });
    });

    // =========================================================================
    // VERIFICATION FAILURES
    // =========================================================================
    describe('verification failures', () => {
        it('should throw UnauthorizedException for 401 status', async () => {
            webhookService.verifyWebhook.mockResolvedValueOnce({
                valid: false,
                error: 'Invalid signature',
                statusCode: 401,
            });
            const context = createMockContext();

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw ForbiddenException for 403 status', async () => {
            webhookService.verifyWebhook.mockResolvedValueOnce({
                valid: false,
                error: 'Channel inactive',
                statusCode: 403,
            });
            const context = createMockContext();

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        });

        it('should throw NotFoundException for 404 status', async () => {
            webhookService.verifyWebhook.mockResolvedValueOnce({
                valid: false,
                error: 'Channel not found',
                statusCode: 404,
            });
            const context = createMockContext();

            await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
        });
    });

    // =========================================================================
    // CHANNEL TYPE DETECTION
    // =========================================================================
    describe('channel type detection', () => {
        it('should detect Shopify from route params', async () => {
            const context = createMockContext({
                params: { channelId: 'ch-1', channelType: 'SHOPIFY' },
            });

            await guard.canActivate(context);

            expect(webhookService.verifyWebhook).toHaveBeenCalledWith(
                expect.objectContaining({ channelType: ChannelType.SHOPIFY })
            );
        });

        it('should detect WooCommerce from route params', async () => {
            webhookService.extractSignature.mockReturnValueOnce('woo_sig');
            const context = createMockContext({
                params: { channelId: 'ch-2', channelType: 'WOOCOMMERCE' },
                headers: { 'x-wc-webhook-signature': 'woo_sig' },
            });

            await guard.canActivate(context);

            expect(webhookService.verifyWebhook).toHaveBeenCalledWith(
                expect.objectContaining({ channelType: ChannelType.WOOCOMMERCE })
            );
        });

        it('should detect Shopify from header presence', async () => {
            const context = createMockContext({
                params: { channelId: 'ch-3' }, // No channelType
                headers: { 'x-shopify-hmac-sha256': 'shopify_sig' },
            });

            await guard.canActivate(context);

            expect(webhookService.verifyWebhook).toHaveBeenCalledWith(
                expect.objectContaining({ channelType: ChannelType.SHOPIFY })
            );
        });

        it('should detect WooCommerce from header presence', async () => {
            webhookService.extractSignature.mockReturnValueOnce('woo_sig');
            const context = createMockContext({
                params: { channelId: 'ch-4' }, // No channelType
                headers: { 'x-wc-webhook-signature': 'woo_sig' },
            });

            await guard.canActivate(context);

            expect(webhookService.verifyWebhook).toHaveBeenCalledWith(
                expect.objectContaining({ channelType: ChannelType.WOOCOMMERCE })
            );
        });
    });

    // =========================================================================
    // RAW BODY HANDLING
    // =========================================================================
    describe('raw body handling', () => {
        it('should use rawBody when available', async () => {
            const rawPayload = '{"raw": "payload"}';
            const context = createMockContext({
                rawBody: Buffer.from(rawPayload),
                body: { different: 'body' },
            });

            await guard.canActivate(context);

            expect(webhookService.verifyWebhook).toHaveBeenCalledWith(
                expect.objectContaining({ payload: rawPayload })
            );
        });

        it('should stringify body when rawBody not available', async () => {
            const context = createMockContext({
                rawBody: undefined,
                body: { fallback: 'body' },
            });

            await guard.canActivate(context);

            expect(webhookService.verifyWebhook).toHaveBeenCalledWith(
                expect.objectContaining({ payload: JSON.stringify({ fallback: 'body' }) })
            );
        });
    });

    // =========================================================================
    // HELPER FUNCTION
    // =========================================================================
    describe('getWebhookContext helper', () => {
        it('should return verification context when present', () => {
            const mockRequest: any = {
                webhookVerification: {
                    channelId: 'ch-123',
                    organizationId: 'org-456',
                    verified: true,
                },
            };

            const context = getWebhookContext(mockRequest);

            expect(context).toEqual({
                channelId: 'ch-123',
                organizationId: 'org-456',
                verified: true,
            });
        });

        it('should return null when no verification context', () => {
            const mockRequest: any = {};

            const context = getWebhookContext(mockRequest);

            expect(context).toBeNull();
        });
    });

    // =========================================================================
    // STEP D: HARDENING TESTS
    // =========================================================================
    describe('Step D: Hardening', () => {
        describe('malformed headers', () => {
            it('should handle header with empty value', async () => {
                webhookService.extractSignature.mockReturnValueOnce('');
                const context = createMockContext({
                    headers: { 'x-shopify-hmac-sha256': '' },
                });

                // Empty signature should be treated as missing
                webhookService.extractSignature.mockReturnValueOnce(null);

                await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
            });

            it('should handle header with whitespace only', async () => {
                webhookService.extractSignature.mockReturnValueOnce('   ');
                const context = createMockContext({
                    headers: { 'x-shopify-hmac-sha256': '   ' },
                });

                // Guard passes to service, service should handle
                await guard.canActivate(context);

                expect(webhookService.verifyWebhook).toHaveBeenCalled();
            });

            it('should handle non-string header value', async () => {
                webhookService.extractSignature.mockReturnValueOnce('array_sig');
                const context = createMockContext({
                    headers: { 'x-shopify-hmac-sha256': ['sig1', 'sig2'] as any },
                });

                await guard.canActivate(context);

                expect(webhookService.extractSignature).toHaveBeenCalled();
            });
        });

        describe('empty body', () => {
            it('should handle empty body object', async () => {
                const context = createMockContext({
                    rawBody: Buffer.from(''),
                    body: {},
                });

                await guard.canActivate(context);

                expect(webhookService.verifyWebhook).toHaveBeenCalledWith(
                    expect.objectContaining({ payload: '' })
                );
            });

            it('should handle null body', async () => {
                const context = createMockContext({
                    rawBody: undefined,
                    body: null,
                });

                // When body is null and no rawBody, should throw
                await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
            });
        });

        describe('concurrent verification', () => {
            it('should handle concurrent webhook verifications', async () => {
                const context1 = createMockContext({ params: { channelId: 'ch-1', channelType: 'shopify' } });
                const context2 = createMockContext({ params: { channelId: 'ch-2', channelType: 'shopify' } });
                const context3 = createMockContext({ params: { channelId: 'ch-3', channelType: 'shopify' } });

                webhookService.verifyWebhook.mockResolvedValue({
                    valid: true,
                    channelId: 'test',
                    organizationId: 'org',
                });

                // Execute all concurrently
                const results = await Promise.all([
                    guard.canActivate(context1),
                    guard.canActivate(context2),
                    guard.canActivate(context3),
                ]);

                expect(results).toEqual([true, true, true]);
                expect(webhookService.verifyWebhook).toHaveBeenCalledTimes(3);
            });

            it('should isolate verification failures in concurrent requests', async () => {
                const context1 = createMockContext({ params: { channelId: 'ch-valid', channelType: 'shopify' } });
                const context2 = createMockContext({ params: { channelId: 'ch-invalid', channelType: 'shopify' } });

                webhookService.verifyWebhook
                    .mockResolvedValueOnce({ valid: true, channelId: 'ch-valid', organizationId: 'org' })
                    .mockResolvedValueOnce({ valid: false, error: 'Invalid', statusCode: 401 });

                const result1 = guard.canActivate(context1);
                const result2 = guard.canActivate(context2);

                await expect(result1).resolves.toBe(true);
                await expect(result2).rejects.toThrow(UnauthorizedException);
            });
        });
    });
});
