/**
 * FedEx OAuth 2.0 Service (OAUTH-04)
 * 
 * Implements FedEx OAuth 2.0 Client Credentials flow:
 * 1. Store client_id and client_secret (encrypted) in ShippingAccount
 * 2. On first API call, request access token
 * 3. Cache token in Redis with TTL = expires_in - 300 (refresh 5 min early)
 * 4. Before each API call, check cache; refresh if expired
 * 5. On 401 response, clear cache, refresh token, retry once
 * 
 * Endpoints:
 * - Production: https://apis.fedex.com/oauth/token
 * - Sandbox: https://apis-sandbox.fedex.com/oauth/token
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '@common/encryption';
import { PrismaService } from '@common/database/prisma.service';
import { Redis } from 'ioredis';
import { getRedisConnection } from '../../../queues/redis-connection';

// FedEx OAuth endpoints
const FEDEX_OAUTH_ENDPOINTS = {
    production: 'https://apis.fedex.com/oauth/token',
    sandbox: 'https://apis-sandbox.fedex.com/oauth/token',
};

// Token response from FedEx
interface FedExTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

// Shipping account with credentials
export interface ShippingAccount {
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
export class FedExOAuthService {
    private readonly logger = new Logger(FedExOAuthService.name);
    private redis: Redis | null = null;

    // In-memory locks to prevent concurrent token requests (stampede protection)
    private tokenLocks = new Map<string, TokenLock>();

    // Cache TTL buffer (5 minutes = 300 seconds)
    static readonly TTL_BUFFER_SECONDS = 300;

    // Lock expiry (prevent deadlocks)
    static readonly LOCK_EXPIRY_MS = 30000;

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
            ? FEDEX_OAUTH_ENDPOINTS.sandbox
            : FEDEX_OAUTH_ENDPOINTS.production;
    }

    /**
     * Generate cache key for a shipping account
     */
    private getCacheKey(shippingAccountId: string): string {
        return `fedex:token:${shippingAccountId}`;
    }

    /**
     * Get access token with caching and stampede protection
     * 
     * This is the main entry point for getting a FedEx access token.
     * It handles:
     * - Checking Redis cache
     * - Preventing concurrent token requests (stampede)
     * - Refreshing tokens when expired
     */
    async getAccessToken(shippingAccount: ShippingAccount): Promise<string> {
        const cacheKey = this.getCacheKey(shippingAccount.id);

        // First, try to get from cache
        let token = await this.getTokenFromCache(cacheKey);
        if (token) {
            this.logger.debug(`Token retrieved from cache for account ${shippingAccount.id}`);
            return token;
        }

        // Not in cache - need to fetch new token
        // Use stampede protection to prevent concurrent requests
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
     * 
     * Prevents multiple concurrent requests from all trying to refresh
     * the token at the same time (thundering herd problem)
     */
    private async fetchTokenWithStampedeProtection(
        shippingAccount: ShippingAccount
    ): Promise<string> {
        const lockKey = shippingAccount.id;

        // Check if there's already a request in progress
        const existingLock = this.tokenLocks.get(lockKey);
        if (existingLock) {
            // Check if lock is still valid
            if (Date.now() - existingLock.timestamp < FedExOAuthService.LOCK_EXPIRY_MS) {
                this.logger.debug(`Waiting for existing token request for account ${shippingAccount.id}`);
                return existingLock.promise;
            }
            // Lock expired, remove it
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
            // Clean up lock after fetch completes
            this.tokenLocks.delete(lockKey);
        }
    }

    /**
     * Fetch new token from FedEx OAuth endpoint
     */
    async fetchNewToken(shippingAccount: ShippingAccount): Promise<string> {
        const endpoint = this.getOAuthEndpoint(shippingAccount.testMode);

        // Get decrypted credentials
        const { clientId, clientSecret } = this.getDecryptedCredentials(shippingAccount);

        if (!clientId || !clientSecret) {
            throw new Error('Missing FedEx OAuth credentials');
        }

        this.logger.log(`Fetching new token from FedEx for account ${shippingAccount.id}`);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: clientId,
                    client_secret: clientSecret,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();

                if (response.status === 401 || response.status === 403) {
                    // Invalid credentials - mark account as NEEDS_REAUTH
                    await this.markAccountNeedsReauth(shippingAccount.id);
                    throw new FedExAuthError(
                        'Invalid FedEx credentials',
                        'NEEDS_REAUTH',
                        response.status
                    );
                }

                throw new FedExAuthError(
                    `FedEx OAuth failed: ${errorBody}`,
                    'TOKEN_REQUEST_FAILED',
                    response.status
                );
            }

            const tokenResponse: FedExTokenResponse = await response.json();

            // Cache the token with TTL = expires_in - 300 (refresh 5 min early)
            await this.cacheToken(
                shippingAccount.id,
                tokenResponse.access_token,
                tokenResponse.expires_in
            );

            this.logger.log(`Token obtained and cached for account ${shippingAccount.id}`);

            return tokenResponse.access_token;

        } catch (error: any) {
            if (error instanceof FedExAuthError) {
                throw error;
            }

            // Network or other error
            this.logger.error(`Failed to fetch FedEx token: ${error.message}`);
            throw new FedExAuthError(
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
        const ttl = Math.max(expiresIn - FedExOAuthService.TTL_BUFFER_SECONDS, 60);

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
     * Handle 401 response from FedEx API
     * Clears cache, refreshes token, and provides the new token for retry
     */
    async handleUnauthorized(shippingAccount: ShippingAccount): Promise<string> {
        this.logger.warn(`401 received for account ${shippingAccount.id}, refreshing token`);

        // Clear the cached token
        await this.clearCachedToken(shippingAccount.id);

        // Fetch a new token
        const newToken = await this.fetchNewToken(shippingAccount);

        return newToken;
    }

    /**
     * Get decrypted credentials from shipping account
     */
    getDecryptedCredentials(shippingAccount: ShippingAccount): {
        clientId: string | undefined;
        clientSecret: string | undefined;
    } {
        const credentials = shippingAccount.credentials;

        // Try client_id/client_secret first (new OAuth format)
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
        // Our encryption format: IV:Ciphertext:AuthTag (base64 values separated by colons)
        return value.includes(':') && value.split(':').length === 3;
    }

    /**
     * Mark shipping account as needing re-authentication
     * Updates the database status to NEEDS_REAUTH
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
            // Log but don't throw - token operation should still fail with auth error
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
    ): Omit<ShippingAccount, 'id' | 'organizationId'> {
        const encrypted = this.encryptCredentials(clientId, clientSecret);

        return {
            carrier: 'FEDEX',
            accountNumber,
            testMode,
            credentials: {
                clientId: encrypted.encryptedClientId,
                clientSecret: encrypted.encryptedClientSecret,
            },
            status: 'ACTIVE',
        };
    }
}

/**
 * Custom error class for FedEx authentication errors
 */
export class FedExAuthError extends Error {
    constructor(
        message: string,
        public readonly code: 'NEEDS_REAUTH' | 'TOKEN_REQUEST_FAILED' | 'NETWORK_ERROR',
        public readonly statusCode: number
    ) {
        super(message);
        this.name = 'FedExAuthError';
    }
}
