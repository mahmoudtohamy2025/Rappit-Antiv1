/**
 * OAuth Callback Security Service (OAUTH-06)
 * 
 * Provides security measures for OAuth callbacks:
 * 1. State Parameter: Cryptographically random (32+ bytes), Redis storage, 10-min TTL
 * 2. Rate Limiting: 10 callbacks per minute per IP
 * 3. HTTPS Enforcement: Reject HTTP in production
 * 4. Redirect Validation: Only allowed origins
 * 
 * Protects against:
 * - CSRF attacks (state parameter)
 * - Replay attacks (state deleted after use)
 * - Brute force (rate limiting)
 * - Man-in-the-middle (HTTPS enforcement)
 * - Open redirect (origin validation)
 */

import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { getRedisConnection } from '../../queues/redis-connection';
import * as crypto from 'crypto';

// State data stored in Redis
export interface OAuthStateData {
    organizationId: string;
    provider: 'shopify' | 'woocommerce' | 'fedex' | 'dhl';
    redirectUrl?: string;
    metadata?: Record<string, string>;
    createdAt: number;
    ip?: string;
}

// Rate limit configuration
interface RateLimitConfig {
    maxRequests: number;
    windowSeconds: number;
}

@Injectable()
export class OAuthCallbackSecurityService {
    private readonly logger = new Logger(OAuthCallbackSecurityService.name);
    private redis: Redis | null = null;

    // State TTL: 10 minutes
    static readonly STATE_TTL_SECONDS = 600;

    // State size: 32 bytes = 64 hex chars
    static readonly STATE_SIZE_BYTES = 32;

    // Rate limit: 10 callbacks per minute per IP
    static readonly RATE_LIMIT: RateLimitConfig = {
        maxRequests: 10,
        windowSeconds: 60,
    };

    // Allowed redirect origins (configured via environment)
    private allowedOrigins: string[] = [];

    constructor(private readonly configService: ConfigService) {
        this.loadAllowedOrigins();
    }

    /**
     * Load allowed redirect origins from config
     */
    private loadAllowedOrigins(): void {
        const originsEnv = this.configService.get<string>('OAUTH_ALLOWED_ORIGINS');
        const frontendUrl = this.configService.get<string>('FRONTEND_URL');
        const appUrl = this.configService.get<string>('APP_URL');

        this.allowedOrigins = [];

        if (originsEnv) {
            this.allowedOrigins.push(...originsEnv.split(',').map(o => o.trim()));
        }

        if (frontendUrl) {
            this.allowedOrigins.push(frontendUrl);
        }

        if (appUrl) {
            this.allowedOrigins.push(appUrl);
        }

        // Always allow localhost in development
        const nodeEnv = this.configService.get<string>('NODE_ENV');
        if (nodeEnv !== 'production') {
            this.allowedOrigins.push(
                'http://localhost:3000',
                'http://localhost:3001',
                'http://127.0.0.1:3000',
            );
        }

        this.logger.log(`Allowed OAuth redirect origins: ${this.allowedOrigins.join(', ')}`);
    }

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

    // =========================================================================
    // STATE MANAGEMENT
    // =========================================================================

    /**
     * Generate a cryptographically secure random state (32 bytes = 64 hex chars)
     */
    generateState(): string {
        const stateBuffer = crypto.randomBytes(OAuthCallbackSecurityService.STATE_SIZE_BYTES);
        return stateBuffer.toString('hex');
    }

    /**
     * Get the Redis key for a state
     */
    private getStateKey(state: string): string {
        return `oauth:state:${state}`;
    }

    /**
     * Store state in Redis with 10-minute TTL
     */
    async storeState(state: string, data: OAuthStateData): Promise<void> {
        const key = this.getStateKey(state);
        const redis = this.getRedis();

        try {
            await redis.setex(
                key,
                OAuthCallbackSecurityService.STATE_TTL_SECONDS,
                JSON.stringify(data)
            );
            this.logger.debug(`State stored: ${state.substring(0, 8)}... (TTL: ${OAuthCallbackSecurityService.STATE_TTL_SECONDS}s)`);
        } catch (error) {
            this.logger.error(`Failed to store state: ${error}`);
            throw new Error('Failed to store OAuth state');
        }
    }

    /**
     * Validate and consume state from callback
     * Returns state data if valid, throws if invalid
     * State is DELETED after successful validation (prevents replay)
     */
    async validateAndConsumeState(state: string): Promise<OAuthStateData> {
        if (!state || state.length === 0) {
            throw new BadRequestException('Missing state parameter');
        }

        // Validate state format (should be 64 hex characters)
        if (!/^[a-f0-9]{64}$/i.test(state)) {
            throw new BadRequestException('Invalid state format');
        }

        const key = this.getStateKey(state);
        const redis = this.getRedis();

        try {
            // Get and delete atomically using GETDEL (Redis 6.2+) or GET then DEL
            const dataJson = await redis.get(key);

            if (!dataJson) {
                throw new BadRequestException('Invalid or expired state');
            }

            // Delete state immediately to prevent replay attacks
            await redis.del(key);

            const data: OAuthStateData = JSON.parse(dataJson);

            // Double-check expiry (shouldn't happen due to TTL, but defense in depth)
            const now = Date.now();
            const age = (now - data.createdAt) / 1000;
            if (age > OAuthCallbackSecurityService.STATE_TTL_SECONDS) {
                throw new BadRequestException('State has expired');
            }

            this.logger.debug(`State validated and consumed: ${state.substring(0, 8)}...`);
            return data;

        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Failed to validate state: ${error}`);
            throw new BadRequestException('Failed to validate OAuth state');
        }
    }

    /**
     * Check if a state exists (without consuming it)
     */
    async stateExists(state: string): Promise<boolean> {
        if (!state) return false;

        const key = this.getStateKey(state);
        const redis = this.getRedis();

        try {
            const exists = await redis.exists(key);
            return exists === 1;
        } catch {
            return false;
        }
    }

    /**
     * Delete a state (for cleanup or manual invalidation)
     */
    async deleteState(state: string): Promise<void> {
        const key = this.getStateKey(state);
        const redis = this.getRedis();

        try {
            await redis.del(key);
        } catch (error) {
            this.logger.warn(`Failed to delete state: ${error}`);
        }
    }

    // =========================================================================
    // RATE LIMITING
    // =========================================================================

    /**
     * Get the rate limit key for an IP
     */
    private getRateLimitKey(ip: string): string {
        // Sanitize IP for Redis key
        const sanitizedIp = ip.replace(/[^a-zA-Z0-9:.]/g, '_');
        return `oauth:ratelimit:${sanitizedIp}`;
    }

    /**
     * Check and increment rate limit for an IP
     * Returns true if request is allowed, throws if rate limited
     */
    async checkRateLimit(ip: string): Promise<boolean> {
        if (!ip) {
            return true; // Skip rate limiting if no IP
        }

        const key = this.getRateLimitKey(ip);
        const redis = this.getRedis();
        const { maxRequests, windowSeconds } = OAuthCallbackSecurityService.RATE_LIMIT;

        try {
            // Increment counter and set TTL if new
            const current = await redis.incr(key);

            if (current === 1) {
                // First request in window, set expiry
                await redis.expire(key, windowSeconds);
            }

            if (current > maxRequests) {
                const ttl = await redis.ttl(key);
                this.logger.warn(`Rate limit exceeded for IP ${ip} (${current}/${maxRequests})`);
                throw new ForbiddenException(
                    `Rate limit exceeded. Try again in ${ttl} seconds.`
                );
            }

            this.logger.debug(`Rate limit check passed: ${ip} (${current}/${maxRequests})`);
            return true;

        } catch (error) {
            if (error instanceof ForbiddenException) {
                throw error;
            }
            // If Redis fails, allow the request (fail open for availability)
            this.logger.warn(`Rate limit check failed: ${error}`);
            return true;
        }
    }

    /**
     * Get current rate limit status for an IP
     */
    async getRateLimitStatus(ip: string): Promise<{
        current: number;
        max: number;
        remaining: number;
        resetIn: number;
    }> {
        const key = this.getRateLimitKey(ip);
        const redis = this.getRedis();

        try {
            const [current, ttl] = await Promise.all([
                redis.get(key),
                redis.ttl(key),
            ]);

            const count = current ? parseInt(current, 10) : 0;
            const { maxRequests, windowSeconds } = OAuthCallbackSecurityService.RATE_LIMIT;

            return {
                current: count,
                max: maxRequests,
                remaining: Math.max(0, maxRequests - count),
                resetIn: ttl > 0 ? ttl : windowSeconds,
            };
        } catch {
            return {
                current: 0,
                max: OAuthCallbackSecurityService.RATE_LIMIT.maxRequests,
                remaining: OAuthCallbackSecurityService.RATE_LIMIT.maxRequests,
                resetIn: OAuthCallbackSecurityService.RATE_LIMIT.windowSeconds,
            };
        }
    }

    // =========================================================================
    // HTTPS ENFORCEMENT
    // =========================================================================

    /**
     * Validate that the request is using HTTPS in production
     */
    validateHttps(protocol: string, forwardedProto?: string): boolean {
        const nodeEnv = this.configService.get<string>('NODE_ENV');

        // Only enforce in production
        if (nodeEnv !== 'production') {
            return true;
        }

        // Check X-Forwarded-Proto header (common for proxies/load balancers)
        const effectiveProtocol = forwardedProto || protocol;

        if (effectiveProtocol !== 'https') {
            this.logger.warn(`HTTP request rejected in production: ${effectiveProtocol}`);
            throw new BadRequestException('HTTPS required for OAuth callbacks in production');
        }

        return true;
    }

    /**
     * Check if request is secure (for informational purposes)
     */
    isSecureRequest(protocol: string, forwardedProto?: string): boolean {
        const effectiveProtocol = forwardedProto || protocol;
        return effectiveProtocol === 'https';
    }

    // =========================================================================
    // REDIRECT VALIDATION
    // =========================================================================

    /**
     * Validate that the redirect URL is in the allowed origins list
     */
    validateRedirectUrl(redirectUrl: string): boolean {
        if (!redirectUrl) {
            return true; // No redirect URL, nothing to validate
        }

        try {
            const url = new URL(redirectUrl);
            const origin = url.origin;

            if (!this.allowedOrigins.includes(origin)) {
                this.logger.warn(`Redirect to unauthorized origin blocked: ${origin}`);
                throw new BadRequestException('Redirect URL not in allowed origins');
            }

            return true;
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Invalid redirect URL format');
        }
    }

    /**
     * Get safe redirect URL (returns default if invalid)
     */
    getSafeRedirectUrl(redirectUrl?: string, defaultUrl?: string): string {
        const fallback = defaultUrl || this.configService.get<string>('FRONTEND_URL') || '/';

        if (!redirectUrl) {
            return fallback;
        }

        try {
            const url = new URL(redirectUrl);
            const origin = url.origin;

            if (this.allowedOrigins.includes(origin)) {
                return redirectUrl;
            }
        } catch {
            // Invalid URL format
        }

        this.logger.warn(`Using fallback redirect URL instead of: ${redirectUrl}`);
        return fallback;
    }

    /**
     * Get list of allowed origins
     */
    getAllowedOrigins(): string[] {
        return [...this.allowedOrigins];
    }

    /**
     * Add an allowed origin (for testing or dynamic configuration)
     */
    addAllowedOrigin(origin: string): void {
        if (!this.allowedOrigins.includes(origin)) {
            this.allowedOrigins.push(origin);
        }
    }

    // =========================================================================
    // COMBINED VALIDATION
    // =========================================================================

    /**
     * Perform all callback security validations
     * Use this in OAuth callback handlers for comprehensive security
     */
    async validateCallback(params: {
        state: string;
        ip: string;
        protocol: string;
        forwardedProto?: string;
        redirectUrl?: string;
    }): Promise<OAuthStateData> {
        const { state, ip, protocol, forwardedProto, redirectUrl } = params;

        // 1. Rate limit check
        await this.checkRateLimit(ip);

        // 2. HTTPS enforcement
        this.validateHttps(protocol, forwardedProto);

        // 3. Redirect URL validation
        if (redirectUrl) {
            this.validateRedirectUrl(redirectUrl);
        }

        // 4. State validation and consumption (also prevents replay)
        const stateData = await this.validateAndConsumeState(state);

        return stateData;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Create a new state with all required data
     */
    async createState(data: Omit<OAuthStateData, 'createdAt'>): Promise<string> {
        const state = this.generateState();
        const stateData: OAuthStateData = {
            ...data,
            createdAt: Date.now(),
        };

        await this.storeState(state, stateData);
        return state;
    }

    /**
     * Get state size in bytes
     */
    getStateSizeBytes(): number {
        return OAuthCallbackSecurityService.STATE_SIZE_BYTES;
    }

    /**
     * Get state TTL in seconds
     */
    getStateTtlSeconds(): number {
        return OAuthCallbackSecurityService.STATE_TTL_SECONDS;
    }
}
