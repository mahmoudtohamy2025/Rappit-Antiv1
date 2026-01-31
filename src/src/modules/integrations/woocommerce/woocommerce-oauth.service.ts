/**
 * WooCommerce OAuth Service (OAUTH-03)
 * 
 * Implements WooCommerce REST API auto-authorization flow:
 * 1. User enters WooCommerce store URL
 * 2. System validates URL is reachable
 * 3. System generates authorization URL with callback and permissions
 * 4. User redirected to WooCommerce, clicks Approve
 * 5. WooCommerce POSTs consumer_key and consumer_secret to callback
 * 6. Keys encrypted and stored in Channel.credentials
 */

import {
    Injectable,
    Logger,
    BadRequestException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@common/database/prisma.service';
import { EncryptionService } from '@common/encryption';
import * as crypto from 'crypto';

// WooCommerce OAuth state stored temporarily
interface WooCommerceOAuthState {
    state: string;
    storeUrl: string;
    organizationId: string;
    createdAt: number;
}

// Permissions requested from WooCommerce
const WOOCOMMERCE_SCOPE = 'read_write'; // Orders, Products, Webhooks

// WooCommerce callback payload
export interface WooCommerceCallbackPayload {
    key_id: number;
    user_id: number;
    consumer_key: string;
    consumer_secret: string;
    key_permissions: string;
}

@Injectable()
export class WooCommerceOAuthService {
    private readonly logger = new Logger(WooCommerceOAuthService.name);

    // Temporary state storage (in production, use Redis)
    private stateStore = new Map<string, WooCommerceOAuthState>();

    // State TTL: 10 minutes
    static readonly STATE_TTL_MS = 10 * 60 * 1000;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly encryptionService: EncryptionService,
    ) { }

    /**
     * Generate cryptographically random state parameter
     */
    generateState(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Validate WooCommerce store URL format
     * Must be a valid HTTPS URL (or HTTP for local testing)
     */
    validateStoreUrl(storeUrl: string): { valid: boolean; error?: string; normalizedUrl?: string } {
        if (!storeUrl) {
            return { valid: false, error: 'Store URL is required' };
        }

        // Normalize URL
        let normalizedUrl = storeUrl.trim().toLowerCase();

        // Add https:// if no protocol specified
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = `https://${normalizedUrl}`;
        }

        // Validate URL format
        try {
            const url = new URL(normalizedUrl);

            // Remove trailing slash
            normalizedUrl = url.origin + url.pathname.replace(/\/$/, '');

            // Check for localhost (allowed for testing)
            const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

            // For production, require HTTPS (except localhost)
            if (!isLocalhost && url.protocol !== 'https:') {
                return { valid: false, error: 'Store URL must use HTTPS' };
            }

            return { valid: true, normalizedUrl };
        } catch {
            return { valid: false, error: 'Invalid URL format' };
        }
    }

    /**
     * Check if WooCommerce store is reachable
     * Tests the WooCommerce REST API endpoint
     */
    async checkStoreReachable(storeUrl: string): Promise<{ reachable: boolean; error?: string }> {
        try {
            const testUrl = `${storeUrl}/wp-json/wc/v3/`;

            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            // WooCommerce returns 401 if no auth, but that means it's reachable
            if (response.ok || response.status === 401) {
                return { reachable: true };
            }

            // Check if it's a WordPress site but WooCommerce isn't installed
            if (response.status === 404) {
                return { reachable: false, error: 'WooCommerce API not found. Is WooCommerce installed and enabled?' };
            }

            return { reachable: false, error: `Store responded with status ${response.status}` };
        } catch (error: any) {
            if (error.name === 'TimeoutError') {
                return { reachable: false, error: 'Connection timed out' };
            }
            if (error.code === 'ENOTFOUND') {
                return { reachable: false, error: 'Store URL not found (DNS error)' };
            }
            return { reachable: false, error: `Network error: ${error.message}` };
        }
    }

    /**
     * Generate WooCommerce authorization URL
     * Uses the WooCommerce REST API Authentication endpoint
     * 
     * @see https://woocommerce.github.io/woocommerce-rest-api-docs/#rest-api-keys
     */
    async generateAuthUrl(storeUrl: string, organizationId: string): Promise<string> {
        // Validate URL
        const validation = this.validateStoreUrl(storeUrl);
        if (!validation.valid) {
            throw new BadRequestException(validation.error);
        }
        const normalizedUrl = validation.normalizedUrl!;

        // Generate state for CSRF protection
        const state = this.generateState();

        // Store state for validation
        const stateData: WooCommerceOAuthState = {
            state,
            storeUrl: normalizedUrl,
            organizationId,
            createdAt: Date.now(),
        };
        this.stateStore.set(state, stateData);

        // Get callback URL from config
        const callbackUrl = this.configService.get<string>('WOOCOMMERCE_REDIRECT_URI') ||
            `${this.configService.get<string>('APP_URL')}/api/v1/oauth/woocommerce/callback`;

        // Get return URL (where user goes after approval)
        const returnUrl = this.configService.get<string>('FRONTEND_URL') ||
            this.configService.get<string>('APP_URL') || 'http://localhost:3000';

        // Build WooCommerce authorization URL
        // Format: {store_url}/wc-auth/v1/authorize
        const authUrl = new URL(`${normalizedUrl}/wc-auth/v1/authorize`);
        authUrl.searchParams.set('app_name', 'Rappit');
        authUrl.searchParams.set('scope', WOOCOMMERCE_SCOPE);
        authUrl.searchParams.set('user_id', organizationId);
        authUrl.searchParams.set('return_url', `${returnUrl}/settings/channels?state=${state}`);
        authUrl.searchParams.set('callback_url', callbackUrl);

        this.logger.log(`Generated WooCommerce auth URL for store: ${normalizedUrl}`);

        return authUrl.toString();
    }

    /**
     * Validate state parameter from callback
     * Protects against CSRF attacks
     */
    validateState(state: string, storeUrl?: string): WooCommerceOAuthState {
        const stateData = this.stateStore.get(state);

        if (!stateData) {
            this.logger.warn(`Invalid or expired state: ${state.substring(0, 8)}...`);
            throw new UnauthorizedException('Invalid or expired state parameter');
        }

        // Check expiration
        const age = Date.now() - stateData.createdAt;
        if (age > WooCommerceOAuthService.STATE_TTL_MS) {
            this.stateStore.delete(state);
            throw new UnauthorizedException('State parameter expired');
        }

        // Optionally validate store URL matches
        if (storeUrl) {
            const normalizedInput = this.validateStoreUrl(storeUrl).normalizedUrl;
            if (normalizedInput !== stateData.storeUrl) {
                this.logger.warn(`Store URL mismatch: expected ${stateData.storeUrl}, got ${normalizedInput}`);
                throw new UnauthorizedException('Store URL mismatch');
            }
        }

        // Delete state to prevent replay attacks
        this.stateStore.delete(state);

        return stateData;
    }

    /**
     * Handle callback from WooCommerce
     * WooCommerce POSTs the consumer_key and consumer_secret
     */
    async handleCallback(
        payload: WooCommerceCallbackPayload,
        userId: string, // This is the organizationId we passed
    ): Promise<{ channelId: string; storeName: string }> {
        this.logger.log(`Processing WooCommerce callback for user_id: ${userId}`);

        // Validate payload
        if (!payload.consumer_key || !payload.consumer_secret) {
            throw new BadRequestException('Missing consumer credentials');
        }

        // Find the state by organizationId (user_id from WooCommerce)
        let stateData: WooCommerceOAuthState | undefined;
        for (const [key, value] of this.stateStore.entries()) {
            if (value.organizationId === userId) {
                stateData = value;
                this.stateStore.delete(key);
                break;
            }
        }

        if (!stateData) {
            // If no state found, try to find existing channel for this organization
            this.logger.warn(`No state found for user_id: ${userId}, but proceeding with callback`);
        }

        const organizationId = userId;
        const storeUrl = stateData?.storeUrl || 'unknown';

        // Encrypt the consumer credentials
        const encryptedKey = this.encryptionService.encryptToString(payload.consumer_key);
        const encryptedSecret = this.encryptionService.encryptToString(payload.consumer_secret);

        // Create or update channel
        const channelId = `woocommerce-${storeUrl.replace(/https?:\/\//, '').replace(/\//g, '-')}-${organizationId}`;

        const channel = await this.prisma.channel.upsert({
            where: { id: channelId },
            update: {
                config: {
                    storeUrl,
                    consumerKey: encryptedKey,
                    consumerSecret: encryptedSecret,
                    keyId: payload.key_id,
                    permissions: payload.key_permissions,
                    connectedAt: new Date().toISOString(),
                },
                isActive: true,
                updatedAt: new Date(),
            },
            create: {
                id: channelId,
                organizationId,
                name: `WooCommerce - ${storeUrl.replace(/https?:\/\//, '')}`,
                type: 'WOOCOMMERCE',
                config: {
                    storeUrl,
                    consumerKey: encryptedKey,
                    consumerSecret: encryptedSecret,
                    keyId: payload.key_id,
                    permissions: payload.key_permissions,
                    connectedAt: new Date().toISOString(),
                },
                isActive: true,
            },
        });

        this.logger.log(`WooCommerce channel created/updated: ${channel.id}`);

        return {
            channelId: channel.id,
            storeName: storeUrl.replace(/https?:\/\//, ''),
        };
    }

    /**
     * Handle user denial (if WooCommerce returns an error)
     */
    handleDenial(state: string, error: string): void {
        // Clean up state
        this.stateStore.delete(state);
        this.logger.warn(`User denied WooCommerce access: ${error}`);
    }

    /**
     * Get decrypted credentials for a channel
     * Used when making API calls to WooCommerce
     */
    async getDecryptedCredentials(channelId: string): Promise<{
        storeUrl: string;
        consumerKey: string;
        consumerSecret: string;
    }> {
        const channel = await this.prisma.channel.findUnique({
            where: { id: channelId },
        });

        if (!channel || channel.type !== 'WOOCOMMERCE') {
            throw new BadRequestException('Invalid WooCommerce channel');
        }

        const config = channel.config as any;

        return {
            storeUrl: config.storeUrl,
            consumerKey: this.encryptionService.decryptFromString(config.consumerKey),
            consumerSecret: this.encryptionService.decryptFromString(config.consumerSecret),
        };
    }

    /**
     * Initiate OAuth flow - validates URL and returns auth URL
     */
    async initiateOAuth(storeUrl: string, organizationId: string): Promise<{
        authUrl: string;
        storeUrl: string;
    }> {
        // Validate URL format
        const validation = this.validateStoreUrl(storeUrl);
        if (!validation.valid) {
            throw new BadRequestException(validation.error);
        }

        // Check if store is reachable
        const reachability = await this.checkStoreReachable(validation.normalizedUrl!);
        if (!reachability.reachable) {
            throw new BadRequestException(reachability.error);
        }

        // Generate auth URL
        const authUrl = await this.generateAuthUrl(validation.normalizedUrl!, organizationId);

        return {
            authUrl,
            storeUrl: validation.normalizedUrl!,
        };
    }
}
