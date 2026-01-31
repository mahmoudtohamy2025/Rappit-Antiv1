import { Injectable, Logger, HttpException, HttpStatus, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { getRedisConnection } from '../../queues/redis-connection';
import { RATE_LIMIT_CONFIGS, RateLimitConfig, RateLimitResult } from './rate-limit.constants';

/**
 * Rate Limit Service
 * ...
 */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
    private readonly logger = new Logger('RateLimitService');
    private redis: Redis | null = null;

    /**
     * Get Redis connection with error handling
     */
    private getRedis(): Redis {
        if (!this.redis) {
            try {
                this.redis = getRedisConnection();
            } catch (error) {
                this.logger.error(`Failed to get Redis connection: ${error.message}`);
                throw new HttpException(
                    'Service temporarily unavailable',
                    HttpStatus.SERVICE_UNAVAILABLE,
                );
            }
        }
        return this.redis;
    }

    /**
     * Generate Redis key for rate limit
     */
    generateKey(config: RateLimitConfig, identifier: string): string {
        const window = Math.floor(Date.now() / 1000 / config.windowSeconds);
        return `${config.keyPrefix}:${identifier}:${window}`;
    }

    /**
     * Calculate seconds remaining in current window
     */
    calculateRetryAfter(config: RateLimitConfig): number {
        const now = Math.floor(Date.now() / 1000);
        const windowStart = Math.floor(now / config.windowSeconds) * config.windowSeconds;
        const windowEnd = windowStart + config.windowSeconds;
        return windowEnd - now;
    }

    /**
     * Check and increment rate limit counter
     * 
     * @param config - Rate limit configuration
     * @param identifier - Unique identifier (IP, email, userId, etc.)
     * @returns Rate limit result
     */
    async checkRateLimit(
        config: RateLimitConfig,
        identifier: string,
    ): Promise<RateLimitResult> {
        const redis = this.getRedis();
        const key = this.generateKey(config, identifier);

        try {
            // Increment counter atomically
            const hits = await redis.incr(key);

            // Set expiry on first hit
            if (hits === 1) {
                await redis.expire(key, config.windowSeconds);
            }

            const remaining = Math.max(0, config.limit - hits);
            const allowed = hits <= config.limit;

            if (!allowed) {
                const retryAfterSeconds = this.calculateRetryAfter(config);
                this.logger.warn(
                    `Rate limit exceeded for ${config.keyPrefix}: ${identifier}, ` +
                    `hits: ${hits}/${config.limit}, retry after: ${retryAfterSeconds}s`,
                );

                return {
                    allowed: false,
                    remaining: 0,
                    retryAfterSeconds,
                    totalHits: hits,
                };
            }

            return {
                allowed: true,
                remaining,
                totalHits: hits,
            };
        } catch (error) {
            // Fail closed: if Redis is down, reject requests (security-first)
            this.logger.error(`Rate limit check failed: ${error.message}`);
            throw new HttpException(
                'Service temporarily unavailable',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    /**
     * Check if an account is locked out
     */
    async isAccountLocked(email: string): Promise<{ locked: boolean; retryAfterSeconds?: number }> {
        const redis = this.getRedis();
        const key = `${RATE_LIMIT_CONFIGS.ACCOUNT_LOCKOUT.keyPrefix}:${email.toLowerCase()}`;

        try {
            const failedAttempts = await redis.get(key);
            const attempts = parseInt(failedAttempts || '0', 10);

            if (attempts >= RATE_LIMIT_CONFIGS.ACCOUNT_LOCKOUT.limit) {
                const ttl = await redis.ttl(key);
                return {
                    locked: true,
                    retryAfterSeconds: ttl > 0 ? ttl : RATE_LIMIT_CONFIGS.ACCOUNT_LOCKOUT.windowSeconds,
                };
            }

            return { locked: false };
        } catch (error) {
            this.logger.error(`Account lockout check failed: ${error.message}`);
            // Fail closed
            throw new HttpException(
                'Service temporarily unavailable',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    /**
     * Record a failed login attempt for account lockout
     */
    async recordFailedLogin(email: string): Promise<number> {
        const redis = this.getRedis();
        const key = `${RATE_LIMIT_CONFIGS.ACCOUNT_LOCKOUT.keyPrefix}:${email.toLowerCase()}`;

        try {
            const attempts = await redis.incr(key);

            // Set or reset expiry
            await redis.expire(key, RATE_LIMIT_CONFIGS.ACCOUNT_LOCKOUT.windowSeconds);

            if (attempts >= RATE_LIMIT_CONFIGS.ACCOUNT_LOCKOUT.limit) {
                this.logger.warn(`Account locked due to failed attempts: ${email}`);
            }

            return attempts;
        } catch (error) {
            this.logger.error(`Failed to record login attempt: ${error.message}`);
            throw new HttpException(
                'Service temporarily unavailable',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    /**
     * Clear failed login attempts on successful login
     */
    async clearFailedLogins(email: string): Promise<void> {
        const redis = this.getRedis();
        const key = `${RATE_LIMIT_CONFIGS.ACCOUNT_LOCKOUT.keyPrefix}:${email.toLowerCase()}`;

        try {
            await redis.del(key);
        } catch (error) {
            // Non-critical, just log
            this.logger.warn(`Failed to clear login attempts: ${error.message}`);
        }
    }

    /**
     * Get current rate limit status without incrementing
     */
    async getRateLimitStatus(
        config: RateLimitConfig,
        identifier: string,
    ): Promise<{ current: number; limit: number; remaining: number }> {
        const redis = this.getRedis();
        const key = this.generateKey(config, identifier);

        try {
            const current = parseInt((await redis.get(key)) || '0', 10);
            return {
                current,
                limit: config.limit,
                remaining: Math.max(0, config.limit - current),
            };
        } catch (error) {
            this.logger.error(`Failed to get rate limit status: ${error.message}`);
            return {
                current: 0,
                limit: config.limit,
                remaining: config.limit,
            };
        }
    }

    /**
     * Reset rate limit for an identifier (admin function)
     */
    async resetRateLimit(config: RateLimitConfig, identifier: string): Promise<void> {
        const redis = this.getRedis();
        const key = this.generateKey(config, identifier);

        try {
            await redis.del(key);
            this.logger.log(`Rate limit reset for ${config.keyPrefix}:${identifier}`);
        } catch (error) {
            this.logger.error(`Failed to reset rate limit: ${error.message}`);
            throw error;
        }
    }
    async onModuleDestroy() {
        if (this.redis) {
            this.logger.log('Disconnecting Redis client');
            await this.redis.quit();
        }
    }
}
