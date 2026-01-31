import { SetMetadata } from '@nestjs/common';
import { RateLimitType, RATE_LIMIT_KEY } from './rate-limit.guard';

/**
 * Rate Limit Decorator
 * 
 * SEC-02: Apply rate limiting to endpoints
 * 
 * Usage:
 * @RateLimit(RateLimitType.AUTH_IP)
 * @Post('login')
 * async login() {}
 * 
 * Types:
 * - AUTH_IP: 5 requests per 15 min per IP
 * - AUTH_EMAIL: 10 requests per 15 min per email
 * - WEBHOOK_PROVIDER_IP: 100 requests per min per provider IP
 * - WEBHOOK_ORG: 500 requests per min per organization
 * - API_USER: 100 requests per min per user
 */
export const RateLimit = (type: RateLimitType) =>
    SetMetadata(RATE_LIMIT_KEY, type);

/**
 * Skip Rate Limiting Decorator
 * 
 * Explicitly skip rate limiting for an endpoint
 */
export const SkipRateLimit = () =>
    SetMetadata(RATE_LIMIT_KEY, RateLimitType.NONE);
