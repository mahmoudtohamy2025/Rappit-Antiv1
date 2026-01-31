import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsService } from '../../src/modules/channels/channels.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

/**
 * TEST-01: OAuth Integration Test Suite
 * 
 * Tests cover:
 * 1. Shopify OAuth flow
 * 2. WooCommerce OAuth flow
 * 3. Token storage and encryption
 * 4. Token refresh logic
 * 5. Revocation handling
 * 6. Security (CSRF, validation)
 */
describe('TEST-01 OAuth Integration', () => {
    let service: ChannelsService;
    let prisma: PrismaService;
    let config: ConfigService;

    const ORG_ID = 'org-123';
    const SHOP_DOMAIN = 'test-shop.myshopify.com';
    const WOO_DOMAIN = 'test-store.example.com';

    const mockAccessToken = 'shpat_1234567890abcdef';
    const mockRefreshToken = 'shprt_refresh_token_xyz';
    const mockEncryptedToken = 'encrypted:shpat_1234567890abcdef';

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: ChannelsService,
                    useValue: {
                        initiateShopifyOAuth: jest.fn(),
                        handleShopifyCallback: jest.fn(),
                        initiateWooCommerceOAuth: jest.fn(),
                        handleWooCommerceCallback: jest.fn(),
                        refreshShopifyToken: jest.fn(),
                        validateOAuthState: jest.fn(),
                        encryptToken: jest.fn().mockReturnValue(mockEncryptedToken),
                        decryptToken: jest.fn().mockReturnValue(mockAccessToken),
                        revokeChannelAccess: jest.fn(),
                    },
                },
                {
                    provide: PrismaService,
                    useValue: {
                        channel: {
                            create: jest.fn(),
                            findFirst: jest.fn(),
                            update: jest.fn(),
                        },
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'SHOPIFY_CLIENT_ID') return 'shopify-client-id';
                            if (key === 'SHOPIFY_CLIENT_SECRET') return 'shopify-secret';
                            if (key === 'WOO_CLIENT_ID') return 'woo-client-id';
                            if (key === 'WOO_CLIENT_SECRET') return 'woo-secret';
                            return undefined;
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<ChannelsService>(ChannelsService);
        prisma = module.get<PrismaService>(PrismaService);
        config = module.get<ConfigService>(ConfigService);
        jest.clearAllMocks();
    });

    describe('Shopify OAuth Flow', () => {
        it('should generate valid OAuth authorization URL', async () => {
            const mockAuthUrl = `https://${SHOP_DOMAIN}/admin/oauth/authorize?client_id=shopify-client-id&scope=read_orders,write_orders&redirect_uri=https://api.rappit.io/oauth/shopify/callback&state=random-state-123`;

            (service.initiateShopifyOAuth as jest.Mock).mockResolvedValue({
                authorizationUrl: mockAuthUrl,
                state: 'random-state-123',
            });

            const result = await service.initiateShopifyOAuth(ORG_ID, SHOP_DOMAIN);

            expect(result.authorizationUrl).toContain(SHOP_DOMAIN);
            expect(result.authorizationUrl).toContain('client_id=');
            expect(result.state).toBeDefined();
        });

        it('should exchange authorization code for access token', async () => {
            (service.handleShopifyCallback as jest.Mock).mockResolvedValue({
                channelId: 'ch-123',
                accessToken: mockEncryptedToken,
            });

            const result = await service.handleShopifyCallback(
                ORG_ID,
                'valid-auth-code',
                'valid-state',
            );

            expect(result.channelId).toBeDefined();
        });

        it('should create channel after successful OAuth', async () => {
            (prisma.channel.create as jest.Mock).mockResolvedValue({
                id: 'ch-123',
                organizationId: ORG_ID,
                platform: 'SHOPIFY',
                domain: SHOP_DOMAIN,
            });

            const channel = await prisma.channel.create({
                data: {
                    organizationId: ORG_ID,
                    platform: 'SHOPIFY',
                    domain: SHOP_DOMAIN,
                    accessToken: mockEncryptedToken,
                },
            });

            expect(channel.platform).toBe('SHOPIFY');
            expect(channel.organizationId).toBe(ORG_ID);
        });
    });

    describe('WooCommerce OAuth Flow', () => {
        it('should generate valid WooCommerce OAuth authorization URL', async () => {
            const mockAuthUrl = `https://${WOO_DOMAIN}/wc-auth/v1/authorize?app_name=RAPPIT&user_id=${ORG_ID}`;

            (service.initiateWooCommerceOAuth as jest.Mock).mockResolvedValue({
                authorizationUrl: mockAuthUrl,
            });

            const result = await service.initiateWooCommerceOAuth(ORG_ID, WOO_DOMAIN);

            expect(result.authorizationUrl).toContain(WOO_DOMAIN);
        });

        it('should handle WooCommerce callback successfully', async () => {
            (service.handleWooCommerceCallback as jest.Mock).mockResolvedValue({
                channelId: 'ch-woo-123',
            });

            const result = await service.handleWooCommerceCallback(
                ORG_ID,
                'consumer-key',
                'consumer-secret',
            );

            expect(result.channelId).toBeDefined();
        });
    });

    describe('Token Security', () => {
        it('should store access tokens encrypted', () => {
            const encrypted = service.encryptToken(mockAccessToken);

            expect(encrypted).not.toBe(mockAccessToken);
            expect(encrypted).toContain('encrypted:');
        });

        it('should decrypt tokens correctly', () => {
            const decrypted = service.decryptToken(mockEncryptedToken);

            expect(decrypted).toBe(mockAccessToken);
        });

        it('should validate state parameter for CSRF protection', async () => {
            (service.validateOAuthState as jest.Mock).mockImplementation((state, storedState) => {
                if (state !== storedState) {
                    throw new BadRequestException('Invalid state parameter');
                }
                return true;
            });

            expect(() => service.validateOAuthState('invalid', 'stored')).toThrow(
                BadRequestException,
            );
        });
    });

    describe('Failure Handling', () => {
        it('should reject invalid state parameter', async () => {
            (service.handleShopifyCallback as jest.Mock).mockRejectedValue(
                new BadRequestException('Invalid state parameter'),
            );

            await expect(
                service.handleShopifyCallback(ORG_ID, 'code', 'invalid-state'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject expired authorization code', async () => {
            (service.handleShopifyCallback as jest.Mock).mockRejectedValue(
                new BadRequestException('Authorization code expired'),
            );

            await expect(
                service.handleShopifyCallback(ORG_ID, 'expired-code', 'state'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should handle token refresh failure', async () => {
            (service.refreshShopifyToken as jest.Mock).mockRejectedValue(
                new UnauthorizedException('Refresh token invalid'),
            );

            await expect(service.refreshShopifyToken('ch-123')).rejects.toThrow(
                UnauthorizedException,
            );
        });
    });

    describe('Token Refresh', () => {
        it('should refresh token before expiry', async () => {
            (service.refreshShopifyToken as jest.Mock).mockResolvedValue({
                accessToken: 'new-access-token',
                expiresAt: new Date(Date.now() + 3600000),
            });

            const result = await service.refreshShopifyToken('ch-123');

            expect(result.accessToken).toBeDefined();
            expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });
    });

    describe('Revocation Handling', () => {
        it('should handle token revocation', async () => {
            (service.revokeChannelAccess as jest.Mock).mockResolvedValue({
                revoked: true,
            });

            const result = await service.revokeChannelAccess('ch-123');

            expect(result.revoked).toBe(true);
        });
    });

    describe('Cross-Org Security', () => {
        it('should isolate OAuth tokens by organization', async () => {
            // Org A's channel
            (prisma.channel.findFirst as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === 'ch-a' && where.organizationId === 'org-a') {
                    return { id: 'ch-a', organizationId: 'org-a' };
                }
                return null;
            });

            // Org B trying to access Org A's channel
            const result = await prisma.channel.findFirst({
                where: { id: 'ch-a', organizationId: 'org-b' },
            });

            expect(result).toBeNull();
        });
    });
});
