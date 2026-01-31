/**
 * Shopify OAuth Service Unit Tests (OAUTH-02)
 * 
 * Tests for Shopify OAuth 2.0 flow:
 * - Authorization URL contains correct scopes
 * - State parameter is cryptographically random
 * - Token exchange payload formatted correctly
 * - Invalid state returns error
 * - State replay fails
 */

import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
    ShopifyOAuthService,
    SHOPIFY_SCOPES
} from '../../src/modules/integrations/shopify/shopify-oauth.service';
import { EncryptionService } from '../../src/common/encryption/encryption.service';

// Mock PrismaService
const mockPrisma = {
    channel: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
    },
};

// Mock fetch
global.fetch = jest.fn();

describe('ShopifyOAuthService', () => {
    let service: ShopifyOAuthService;
    let mockConfigService: Partial<ConfigService>;
    let mockEncryptionService: Partial<EncryptionService>;

    const validConfig = {
        SHOPIFY_CLIENT_ID: 'test-client-id',
        SHOPIFY_CLIENT_SECRET: 'test-client-secret',
        SHOPIFY_REDIRECT_URI: 'https://app.rappit.com/oauth/shopify/callback',
        CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(64),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfigService = {
            get: jest.fn().mockImplementation((key: string) => validConfig[key as keyof typeof validConfig]),
        };

        mockEncryptionService = {
            encryptToString: jest.fn().mockReturnValue('encrypted-token'),
            decryptFromString: jest.fn().mockReturnValue('decrypted-token'),
        };

        service = new ShopifyOAuthService(
            mockConfigService as ConfigService,
            mockPrisma as any,
            mockEncryptionService as EncryptionService,
        );
    });

    describe('generateState', () => {
        it('should generate cryptographically random state (32 bytes = 64 hex chars)', () => {
            const state1 = service.generateState();
            const state2 = service.generateState();

            // Should be 64 hex characters (32 bytes)
            expect(state1).toMatch(/^[a-f0-9]{64}$/);
            expect(state2).toMatch(/^[a-f0-9]{64}$/);

            // Should be different each time
            expect(state1).not.toBe(state2);
        });

        it('should generate cryptographically random values', () => {
            // Generate 100 states and ensure no duplicates
            const states = new Set<string>();
            for (let i = 0; i < 100; i++) {
                states.add(service.generateState());
            }
            expect(states.size).toBe(100);
        });
    });

    describe('generateAuthUrl', () => {
        const shop = 'teststore.myshopify.com';
        const organizationId = 'org-123';

        it('should contain correct scopes', async () => {
            const url = await service.generateAuthUrl(shop, organizationId);
            const parsedUrl = new URL(url);

            expect(parsedUrl.searchParams.get('scope')).toBe(SHOPIFY_SCOPES);
        });

        it('should contain required OAuth parameters', async () => {
            const url = await service.generateAuthUrl(shop, organizationId);
            const parsedUrl = new URL(url);

            expect(parsedUrl.searchParams.get('client_id')).toBe('test-client-id');
            expect(parsedUrl.searchParams.get('redirect_uri')).toBe(validConfig.SHOPIFY_REDIRECT_URI);
            expect(parsedUrl.searchParams.get('state')).toBeTruthy();
        });

        it('should generate unique state for each call', async () => {
            const url1 = await service.generateAuthUrl(shop, organizationId);
            const url2 = await service.generateAuthUrl(shop, organizationId);

            const state1 = new URL(url1).searchParams.get('state');
            const state2 = new URL(url2).searchParams.get('state');

            expect(state1).not.toBe(state2);
        });

        it('should throw for invalid shop domain', async () => {
            await expect(
                service.generateAuthUrl('invalid-shop', organizationId)
            ).rejects.toThrow(BadRequestException);
        });

        it('should accept valid myshopify.com domains', async () => {
            const validShops = [
                'store.myshopify.com',
                'my-store.myshopify.com',
                'store123.myshopify.com',
            ];

            for (const shop of validShops) {
                await expect(
                    service.generateAuthUrl(shop, organizationId)
                ).resolves.toBeTruthy();
            }
        });
    });

    describe('isValidShopDomain', () => {
        it('should accept valid Shopify domains', () => {
            expect(service.isValidShopDomain('store.myshopify.com')).toBe(true);
            expect(service.isValidShopDomain('my-store.myshopify.com')).toBe(true);
            expect(service.isValidShopDomain('store123.myshopify.com')).toBe(true);
        });

        it('should reject invalid domains', () => {
            expect(service.isValidShopDomain('store.com')).toBe(false);
            expect(service.isValidShopDomain('myshopify.com')).toBe(false);
            expect(service.isValidShopDomain('store.fakeshopify.com')).toBe(false);
            expect(service.isValidShopDomain('-store.myshopify.com')).toBe(false);
        });
    });

    describe('validateState', () => {
        const shop = 'teststore.myshopify.com';
        const organizationId = 'org-123';

        it('should validate correct state', async () => {
            // Generate state first
            const url = await service.generateAuthUrl(shop, organizationId);
            const state = new URL(url).searchParams.get('state')!;

            // Validate should succeed
            const result = await service.validateState(state, shop);
            expect(result.shop).toBe(shop);
            expect(result.organizationId).toBe(organizationId);
        });

        it('should throw for invalid state', async () => {
            await expect(
                service.validateState('invalid-state', shop)
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw for shop mismatch', async () => {
            const url = await service.generateAuthUrl(shop, organizationId);
            const state = new URL(url).searchParams.get('state')!;

            await expect(
                service.validateState(state, 'different.myshopify.com')
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should prevent state replay (same state twice fails)', async () => {
            const url = await service.generateAuthUrl(shop, organizationId);
            const state = new URL(url).searchParams.get('state')!;

            // First validation should succeed
            await service.validateState(state, shop);

            // Second validation should fail (state was deleted)
            await expect(
                service.validateState(state, shop)
            ).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('buildTokenExchangePayload', () => {
        it('should format payload correctly', () => {
            const code = 'auth-code-123';
            const payload = service.buildTokenExchangePayload(code);

            expect(payload).toEqual({
                client_id: 'test-client-id',
                client_secret: 'test-client-secret',
                code: 'auth-code-123',
            });
        });
    });

    describe('exchangeCodeForToken', () => {
        const shop = 'teststore.myshopify.com';
        const code = 'auth-code-123';

        it('should call Shopify API with correct parameters', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    access_token: 'shpat_xxx',
                    scope: SHOPIFY_SCOPES,
                }),
            });

            await service.exchangeCodeForToken(shop, code);

            expect(global.fetch).toHaveBeenCalledWith(
                `https://${shop}/admin/oauth/access_token`,
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: expect.stringContaining(code),
                })
            );
        });

        it('should return token response on success', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    access_token: 'shpat_xxx',
                    scope: SHOPIFY_SCOPES,
                }),
            });

            const result = await service.exchangeCodeForToken(shop, code);

            expect(result.access_token).toBe('shpat_xxx');
            expect(result.scope).toBe(SHOPIFY_SCOPES);
        });

        it('should throw on invalid code', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                text: () => Promise.resolve('invalid_grant'),
            });

            await expect(
                service.exchangeCodeForToken(shop, 'invalid-code')
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('handleCallback', () => {
        const shop = 'teststore.myshopify.com';
        const organizationId = 'org-123';

        beforeEach(() => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    access_token: 'shpat_xxx',
                    scope: SHOPIFY_SCOPES,
                }),
            });

            mockPrisma.channel.upsert.mockResolvedValue({
                id: 'channel-123',
                name: `Shopify - ${shop}`,
                type: 'SHOPIFY',
            });
        });

        it('should encrypt token before storage', async () => {
            const url = await service.generateAuthUrl(shop, organizationId);
            const state = new URL(url).searchParams.get('state')!;

            await service.handleCallback(shop, 'code-123', state);

            expect(mockEncryptionService.encryptToString).toHaveBeenCalledWith('shpat_xxx');
        });

        it('should create channel with encrypted credentials', async () => {
            const url = await service.generateAuthUrl(shop, organizationId);
            const state = new URL(url).searchParams.get('state')!;

            await service.handleCallback(shop, 'code-123', state);

            expect(mockPrisma.channel.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({
                        config: expect.objectContaining({
                            accessToken: 'encrypted-token',
                        }),
                    }),
                })
            );
        });

        it('should return channel info on success', async () => {
            const url = await service.generateAuthUrl(shop, organizationId);
            const state = new URL(url).searchParams.get('state')!;

            const result = await service.handleCallback(shop, 'code-123', state);

            expect(result.channelId).toBe('channel-123');
            expect(result.shop).toBe(shop);
        });
    });

    describe('handleUserDenial', () => {
        it('should throw BadRequestException with clear message', () => {
            expect(() => service.handleUserDenial()).toThrow(BadRequestException);
            expect(() => service.handleUserDenial()).toThrow('Access denied');
        });
    });

    describe('Required scopes', () => {
        it('should include all required scopes', () => {
            expect(SHOPIFY_SCOPES).toContain('read_orders');
            expect(SHOPIFY_SCOPES).toContain('write_orders');
            expect(SHOPIFY_SCOPES).toContain('read_products');
            expect(SHOPIFY_SCOPES).toContain('read_inventory');
            expect(SHOPIFY_SCOPES).toContain('write_inventory');
            expect(SHOPIFY_SCOPES).toContain('read_fulfillments');
            expect(SHOPIFY_SCOPES).toContain('write_fulfillments');
        });
    });
});
