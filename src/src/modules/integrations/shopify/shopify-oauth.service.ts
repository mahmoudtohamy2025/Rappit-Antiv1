/**
 * Shopify OAuth Service (OAUTH-02)
 * 
 * Implements Shopify OAuth 2.0 Authorization Code flow:
 * - Generate authorization URL with cryptographic state
 * - Store state in Redis with TTL for CSRF protection
 * - Exchange authorization code for access token
 * - Encrypt token before storage
 */

import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@common/database/prisma.service';
import { EncryptionService } from '@common/encryption/encryption.service';
import * as crypto from 'crypto';

/**
 * OAuth scopes required for Rappit functionality
 */
export const SHOPIFY_SCOPES = [
    'read_orders',
    'write_orders',
    'read_products',
    'read_inventory',
    'write_inventory',
    'read_fulfillments',
    'write_fulfillments',
].join(',');

export interface ShopifyOAuthState {
    state: string;
    shop: string;
    organizationId: string;
    createdAt: number;
}

export interface ShopifyTokenResponse {
    access_token: string;
    scope: string;
}

export interface ShopifyOAuthResult {
    channelId: string;
    shop: string;
    scope: string;
}

@Injectable()
export class ShopifyOAuthService {
    private readonly logger = new Logger(ShopifyOAuthService.name);

    // State storage (in production, use Redis)
    private stateStore = new Map<string, ShopifyOAuthState>();

    // State TTL: 10 minutes
    private static readonly STATE_TTL_MS = 10 * 60 * 1000;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly encryptionService: EncryptionService,
    ) { }

    /**
     * Get Shopify app credentials from config
     */
    private getCredentials() {
        const clientId = this.configService.get<string>('SHOPIFY_CLIENT_ID');
        const clientSecret = this.configService.get<string>('SHOPIFY_CLIENT_SECRET');
        const redirectUri = this.configService.get<string>('SHOPIFY_REDIRECT_URI');

        if (!clientId || !clientSecret) {
            throw new BadRequestException('Shopify OAuth not configured');
        }

        return { clientId, clientSecret, redirectUri };
    }

    /**
     * Generate a cryptographically random state parameter (32 bytes = 64 hex chars)
     */
    generateState(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Generate authorization URL for Shopify OAuth
     * 
     * @param shop - Shopify store domain (e.g., "mystore.myshopify.com")
     * @param organizationId - Organization initiating the OAuth flow
     * @returns Authorization URL to redirect user to
     */
    async generateAuthUrl(shop: string, organizationId: string): Promise<string> {
        const { clientId, redirectUri } = this.getCredentials();

        // Validate shop format
        if (!this.isValidShopDomain(shop)) {
            throw new BadRequestException('Invalid Shopify shop domain');
        }

        // Generate cryptographically random state
        const state = this.generateState();

        // Store state for validation (10 minute TTL)
        const stateData: ShopifyOAuthState = {
            state,
            shop,
            organizationId,
            createdAt: Date.now(),
        };
        this.stateStore.set(state, stateData);

        this.logger.log(`Generated OAuth state for shop: ${shop}, org: ${organizationId}`);

        // Build authorization URL
        const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('scope', SHOPIFY_SCOPES);
        authUrl.searchParams.set('redirect_uri', redirectUri || '');
        authUrl.searchParams.set('state', state);

        return authUrl.toString();
    }

    /**
     * Validate shop domain format
     */
    isValidShopDomain(shop: string): boolean {
        // Must be a valid Shopify domain
        const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
        return shopRegex.test(shop);
    }

    /**
     * Validate state parameter from callback
     * Returns state data if valid, throws if invalid
     */
    async validateState(state: string, shop: string): Promise<ShopifyOAuthState> {
        const stateData = this.stateStore.get(state);

        if (!stateData) {
            this.logger.warn(`Invalid or expired state: ${state.substring(0, 8)}...`);
            throw new UnauthorizedException('Invalid or expired state parameter');
        }

        // Check expiration
        const age = Date.now() - stateData.createdAt;
        if (age > ShopifyOAuthService.STATE_TTL_MS) {
            this.stateStore.delete(state);
            throw new UnauthorizedException('State parameter expired');
        }

        // Validate shop matches
        if (stateData.shop !== shop) {
            this.logger.warn(`Shop mismatch: expected ${stateData.shop}, got ${shop}`);
            throw new UnauthorizedException('Shop mismatch');
        }

        // Delete state to prevent replay attacks
        this.stateStore.delete(state);

        return stateData;
    }

    /**
     * Check if a state has already been used (replay attack)
     */
    isStateUsed(state: string): boolean {
        return !this.stateStore.has(state);
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(
        shop: string,
        code: string,
    ): Promise<ShopifyTokenResponse> {
        const { clientId, clientSecret } = this.getCredentials();

        const tokenUrl = `https://${shop}/admin/oauth/access_token`;
        const payload = {
            client_id: clientId,
            client_secret: clientSecret,
            code,
        };

        this.logger.log(`Exchanging code for token: ${shop}`);

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const error = await response.text();
                this.logger.error(`Token exchange failed: ${error}`);
                throw new BadRequestException('Failed to exchange authorization code');
            }

            const data = await response.json();
            return data as ShopifyTokenResponse;
        } catch (error: any) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Token exchange error: ${error.message}`);
            throw new BadRequestException('Failed to connect to Shopify');
        }
    }

    /**
     * Build token exchange payload (for testing)
     */
    buildTokenExchangePayload(code: string): { client_id: string; client_secret: string; code: string } {
        const { clientId, clientSecret } = this.getCredentials();
        return {
            client_id: clientId,
            client_secret: clientSecret,
            code,
        };
    }

    /**
     * Handle OAuth callback: validate state, exchange code, store encrypted token
     */
    async handleCallback(
        shop: string,
        code: string,
        state: string,
    ): Promise<ShopifyOAuthResult> {
        // Validate state (also checks for replay)
        const stateData = await this.validateState(state, shop);

        // Exchange code for token
        const tokenResponse = await this.exchangeCodeForToken(shop, code);

        // Encrypt the access token
        const encryptedToken = this.encryptionService.encryptToString(
            tokenResponse.access_token
        );

        // Create or update channel
        const channel = await this.prisma.channel.upsert({
            where: {
                id: `shopify-${shop}-${stateData.organizationId}`,
            },
            update: {
                config: {
                    shopUrl: shop,
                    accessToken: encryptedToken,
                    scope: tokenResponse.scope,
                    connectedAt: new Date().toISOString(),
                },
                isActive: true,
                updatedAt: new Date(),
            },
            create: {
                id: `shopify-${shop}-${stateData.organizationId}`,
                organizationId: stateData.organizationId,
                name: `Shopify - ${shop}`,
                type: 'SHOPIFY',
                config: {
                    shopUrl: shop,
                    accessToken: encryptedToken,
                    scope: tokenResponse.scope,
                    connectedAt: new Date().toISOString(),
                },
                isActive: true,
            },
        });

        this.logger.log(`Shopify channel created/updated: ${channel.id}`);

        return {
            channelId: channel.id,
            shop,
            scope: tokenResponse.scope,
        };
    }

    /**
     * Handle user denial (error=access_denied)
     */
    handleUserDenial(): never {
        throw new BadRequestException(
            'Access denied. User did not authorize the Shopify connection.'
        );
    }

    /**
     * Clear expired states (cleanup job)
     */
    clearExpiredStates(): number {
        const now = Date.now();
        let cleared = 0;

        for (const [state, data] of this.stateStore.entries()) {
            if (now - data.createdAt > ShopifyOAuthService.STATE_TTL_MS) {
                this.stateStore.delete(state);
                cleared++;
            }
        }

        return cleared;
    }
}
