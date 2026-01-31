/**
 * DHL OAuth 2.0 Service (OAUTH-05)
 * 
 * Implements DHL OAuth 2.0 Client Credentials flow:
 * 1. Store client_id and client_secret (encrypted) in ShippingAccount
 * 2. On first API call, request access token
 * 3. Cache token in Redis with TTL = expires_in - 300 (refresh 5 min early)
 * 4. Before each API call, check cache; refresh if expired
 * 5. On 401 response, clear cache, refresh token, retry once
 * 
 * Production Endpoint: https://api.dhl.com/auth/accesstoken
 * 
 * Same pattern as FedEx OAuth (OAUTH-04)
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '@common/encryption';
import { PrismaService } from '@common/database/prisma.service';
import { Redis } from 'ioredis';
import { getRedisConnection } from '../../../queues/redis-connection';

// DHL OAuth endpoints
const DHL_OAUTH_ENDPOINTS = {
    production: 'https://api.dhl.com/auth/accesstoken',
    sandbox: 'https://api-sandbox.dhl.com/auth/accesstoken',
};

// Token response from DHL
interface DHLTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

// Shipping account with credentials
export interface DHLShippingAccount {
    id: string;
    organizationId: string;
    carrier: string;
    accountNumber: string;
    testMode: boolean;
    credentials: {
        clientId?: string;      // Encrypted
        clientSecret?: string;  // Encrypted
        apiKey?: string;        // Legacy - still supported
        secretKey?: string;     // Legacy - still supported
    };
    status?: 'ACTIVE' | 'NEEDS_REAUTH' | 'INACTIVE';
}

// Lock for preventing token stampede
interface TokenLock {
    promise: Promise<string>;
    timestamp: number;
}

@Injectable()
export class DHLOAuthService {
    private readonly logger = new Logger(DHLOAuthService.name);
    private redis: Redis | null = null;

    // In-memory locks to prevent concurrent token requests (stampede protection)
    private tokenLocks = new Map<string, TokenLock>();

    // Cache TTL buffer (5 minutes = 300 seconds)
    static readonly TTL_BUFFER_SECONDS = 300;

    // Lock expiry (prevent deadlocks)
    static readonly LOCK_EXPIRY_MS = 30000;

    // Request timeout (15 seconds)
    static readonly REQUEST_TIMEOUT_MS = 15000;

    constructor(
        private readonly configService: ConfigService,
        private readonly encryptionService: EncryptionService,
        private readonly prisma: PrismaService,
    ) { }

    /**
     * Get Redis connection (lazy initialization)
     */
    private getRedis(): Redis {
        if (!this.redis) {
            try {
                this.redis = getRedisConnection();
            } catch (error) {
                this.logger.error('Failed to get Redis connection', error);
                throw error;
            }
        }
        return this.redis;
    }

    /**
     * Get the OAuth endpoint based on test mode
     */
    getOAuthEndpoint(testMode: boolean): string {
        return testMode
            ? DHL_OAUTH_ENDPOINTS.sandbox
            : DHL_OAUTH_ENDPOINTS.production;
    }

    /**
     * Generate cache key for a shipping account
     */
    private getCacheKey(shippingAccountId: string): string {
        return `dhl:token:${shippingAccountId}`;
    }

    /**
     * Get access token with caching and stampede protection
     */
    async getAccessToken(shippingAccount: DHLShippingAccount): Promise<string> {
        const cacheKey = this.getCacheKey(shippingAccount.id);

        // First, try to get from cache
        let token = await this.getTokenFromCache(cacheKey);
        if (token) {
            this.logger.debug(`Token retrieved from cache for account ${shippingAccount.id}`);
            return token;
        }

        // Not in cache - need to fetch new token with stampede protection
        token = await this.fetchTokenWithStampedeProtection(shippingAccount);

        return token;
    }

    /**
     * Get token from Redis cache
     */
    async getTokenFromCache(cacheKey: string): Promise<string | null> {
        try {
            const redis = this.getRedis();
            const token = await redis.get(cacheKey);
            return token;
        } catch (error) {
            this.logger.warn(`Failed to get token from cache: ${error}`);
            return null;
        }
    }

    /**
     * Fetch token with stampede protection
     */
    private async fetchTokenWithStampedeProtection(
        shippingAccount: DHLShippingAccount
    ): Promise<string> {
        const lockKey = shippingAccount.id;

        // Check if there's already a request in progress
        const existingLock = this.tokenLocks.get(lockKey);
        if (existingLock) {
            if (Date.now() - existingLock.timestamp < DHLOAuthService.LOCK_EXPIRY_MS) {
                this.logger.debug(`Waiting for existing token request for account ${shippingAccount.id}`);
                return existingLock.promise;
            }
            this.tokenLocks.delete(lockKey);
        }

        // Create new lock and fetch token
        const fetchPromise = this.fetchNewToken(shippingAccount);
        this.tokenLocks.set(lockKey, {
            promise: fetchPromise,
            timestamp: Date.now(),
        });

        try {
            const token = await fetchPromise;
            return token;
        } finally {
            this.tokenLocks.delete(lockKey);
        }
    }

    /**
     * Fetch new token from DHL OAuth endpoint
     */
    async fetchNewToken(shippingAccount: DHLShippingAccount): Promise<string> {
        const endpoint = this.getOAuthEndpoint(shippingAccount.testMode);

        // Get decrypted credentials
        const { clientId, clientSecret } = this.getDecryptedCredentials(shippingAccount);

        if (!clientId || !clientSecret) {
            throw new DHLAuthError(
                'Missing DHL OAuth credentials',
                'MISSING_CREDENTIALS',
                0
            );
        }

        this.logger.log(`Fetching new token from DHL for account ${shippingAccount.id}`);

        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), DHLOAuthService.REQUEST_TIMEOUT_MS);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: clientId,
                    client_secret: clientSecret,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text().catch(() => 'No error body');

                if (response.status === 401 || response.status === 403) {
                    await this.markAccountNeedsReauth(shippingAccount.id);
                    throw new DHLAuthError(
                        'Invalid DHL credentials',
                        'NEEDS_REAUTH',
                        response.status
                    );
                }

                if (response.status === 429) {
                    throw new DHLAuthError(
                        'Rate limited by DHL API',
                        'RATE_LIMITED',
                        response.status
                    );
                }

                if (response.status >= 500) {
                    throw new DHLAuthError(
                        `DHL server error: ${errorBody}`,
                        'SERVER_ERROR',
                        response.status
                    );
                }

                throw new DHLAuthError(
                    `DHL OAuth failed: ${errorBody}`,
                    'TOKEN_REQUEST_FAILED',
                    response.status
                );
            }

            // Parse and validate response
            const responseText = await response.text();
            let tokenResponse: DHLTokenResponse;

            try {
                tokenResponse = JSON.parse(responseText);
            } catch {
                throw new DHLAuthError(
                    'Invalid JSON response from DHL',
                    'INVALID_RESPONSE',
                    0
                );
            }

            // Validate token in response
            if (!tokenResponse.access_token) {
                throw new DHLAuthError(
                    'Empty access_token in DHL response',
                    'EMPTY_TOKEN',
                    0
                );
            }

            if (!tokenResponse.expires_in || tokenResponse.expires_in <= 0) {
                // Default to 1 hour if not provided
                tokenResponse.expires_in = 3600;
            }

            // Cache the token with TTL = expires_in - 300 (refresh 5 min early)
            await this.cacheToken(
                shippingAccount.id,
                tokenResponse.access_token,
                tokenResponse.expires_in
            );

            this.logger.log(`Token obtained and cached for account ${shippingAccount.id}`);

            return tokenResponse.access_token;

        } catch (error: any) {
            if (error instanceof DHLAuthError) {
                throw error;
            }

            // Handle timeout
            if (error.name === 'AbortError') {
                throw new DHLAuthError(
                    'Request timeout: DHL API did not respond',
                    'TIMEOUT',
                    0
                );
            }

            // Network or other error
            this.logger.error(`Failed to fetch DHL token: ${error.message}`);
            throw new DHLAuthError(
                `Network error: ${error.message}`,
                'NETWORK_ERROR',
                0
            );
        }
    }

    /**
     * Cache token in Redis with calculated TTL
     */
    async cacheToken(
        shippingAccountId: string,
        accessToken: string,
        expiresIn: number
    ): Promise<void> {
        const cacheKey = this.getCacheKey(shippingAccountId);

        // TTL = expires_in - 300 (refresh 5 minutes early)
        const ttl = Math.max(expiresIn - DHLOAuthService.TTL_BUFFER_SECONDS, 60);

        try {
            const redis = this.getRedis();
            await redis.setex(cacheKey, ttl, accessToken);
            this.logger.debug(`Token cached with TTL ${ttl}s for account ${shippingAccountId}`);
        } catch (error) {
            this.logger.warn(`Failed to cache token: ${error}`);
            // Don't throw - token was obtained successfully
        }
    }

    /**
     * Clear cached token (used on 401 responses)
     */
    async clearCachedToken(shippingAccountId: string): Promise<void> {
        const cacheKey = this.getCacheKey(shippingAccountId);

        try {
            const redis = this.getRedis();
            await redis.del(cacheKey);
            this.logger.debug(`Cleared cached token for account ${shippingAccountId}`);
        } catch (error) {
            this.logger.warn(`Failed to clear cached token: ${error}`);
        }
    }

    /**
     * Handle 401 response from DHL API
     * Clears cache, refreshes token, and provides the new token for retry
     */
    async handleUnauthorized(shippingAccount: DHLShippingAccount): Promise<string> {
        this.logger.warn(`401 received for account ${shippingAccount.id}, refreshing token`);

        await this.clearCachedToken(shippingAccount.id);
        const newToken = await this.fetchNewToken(shippingAccount);

        return newToken;
    }

    /**
     * Get decrypted credentials from shipping account
     */
    getDecryptedCredentials(shippingAccount: DHLShippingAccount): {
        clientId: string | undefined;
        clientSecret: string | undefined;
    } {
        const credentials = shippingAccount.credentials;

        let clientId = credentials.clientId;
        let clientSecret = credentials.clientSecret;

        // Fall back to apiKey/secretKey (legacy format)
        if (!clientId) clientId = credentials.apiKey;
        if (!clientSecret) clientSecret = credentials.secretKey;

        // Decrypt if encrypted
        if (clientId && this.isEncrypted(clientId)) {
            clientId = this.encryptionService.decryptFromString(clientId);
        }
        if (clientSecret && this.isEncrypted(clientSecret)) {
            clientSecret = this.encryptionService.decryptFromString(clientSecret);
        }

        return { clientId, clientSecret };
    }

    /**
     * Check if a value appears to be encrypted (contains colon separators)
     */
    private isEncrypted(value: string): boolean {
        return value.includes(':') && value.split(':').length === 3;
    }

    /**
     * Mark shipping account as needing re-authentication
     */
    async markAccountNeedsReauth(shippingAccountId: string): Promise<void> {
        this.logger.warn(`Marking account ${shippingAccountId} as NEEDS_REAUTH`);

        try {
            await this.prisma.shippingAccount.update({
                where: { id: shippingAccountId },
                data: { status: 'NEEDS_REAUTH' },
            });
            this.logger.log(`Account ${shippingAccountId} marked as NEEDS_REAUTH in database`);
        } catch (error) {
            this.logger.error(`Failed to update account status in database: ${error}`);
        }
    }

    /**
     * Encrypt credentials for storage
     */
    encryptCredentials(clientId: string, clientSecret: string): {
        encryptedClientId: string;
        encryptedClientSecret: string;
    } {
        return {
            encryptedClientId: this.encryptionService.encryptToString(clientId),
            encryptedClientSecret: this.encryptionService.encryptToString(clientSecret),
        };
    }

    /**
     * Create a shipping account with encrypted credentials
     */
    createShippingAccountCredentials(
        clientId: string,
        clientSecret: string,
        accountNumber: string,
        testMode: boolean = true
    ): Omit<DHLShippingAccount, 'id' | 'organizationId'> {
        const encrypted = this.encryptCredentials(clientId, clientSecret);

        return {
            carrier: 'DHL',
            accountNumber,
            testMode,
            credentials: {
                clientId: encrypted.encryptedClientId,
                clientSecret: encrypted.encryptedClientSecret,
            },
            status: 'ACTIVE',
        };
    }

    /**
     * Check if account needs re-authentication
     */
    async checkAccountStatus(shippingAccountId: string): Promise<'ACTIVE' | 'NEEDS_REAUTH' | 'INACTIVE' | null> {
        try {
            const account = await this.prisma.shippingAccount.findUnique({
                where: { id: shippingAccountId },
                select: { status: true },
            });
            return account?.status as any || null;
        } catch {
            return null;
        }
    }
}

/**
 * Custom error class for DHL authentication errors
 */
export class DHLAuthError extends Error {
    constructor(
        message: string,
        public readonly code:
            | 'NEEDS_REAUTH'
            | 'TOKEN_REQUEST_FAILED'
            | 'NETWORK_ERROR'
            | 'TIMEOUT'
            | 'RATE_LIMITED'
            | 'SERVER_ERROR'
            | 'INVALID_RESPONSE'
            | 'EMPTY_TOKEN'
            | 'MISSING_CREDENTIALS',
        public readonly statusCode: number
    ) {
        super(message);
        this.name = 'DHLAuthError';
    }
}
