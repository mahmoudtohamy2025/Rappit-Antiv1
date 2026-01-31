import {
    Injectable,
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService, RateLimitConfig } from './rate-limit.service';
import { RATE_LIMIT_CONFIGS } from './rate-limit.constants';

/**
 * Rate Limit Type Decorator Key
 */
export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Rate Limit Types
 */
export enum RateLimitType {
    AUTH_IP = 'AUTH_IP',
    AUTH_EMAIL = 'AUTH_EMAIL',
    WEBHOOK_PROVIDER_IP = 'WEBHOOK_PROVIDER_IP',
    WEBHOOK_ORG = 'WEBHOOK_ORG',
    API_USER = 'API_USER',
    RESEND_INVITE = 'RESEND_INVITE',
    NONE = 'NONE',
}

/**
 * Rate Limit Guard
 * 
 * SEC-02: Applies rate limiting to endpoints
 * 
 * Usage:
 * @RateLimit(RateLimitType.AUTH_IP)
 * @Post('login')
 * async login() {}
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
    private readonly logger = new Logger('RateLimitGuard');

    constructor(
        private readonly reflector: Reflector,
        private readonly rateLimitService: RateLimitService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Get rate limit type from decorator
        const rateLimitType = this.reflector.get<RateLimitType>(
            RATE_LIMIT_KEY,
            context.getHandler(),
        );

        // No rate limit decorator = skip
        if (!rateLimitType || rateLimitType === RateLimitType.NONE) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        // Get the appropriate config and identifier
        const { config, identifier } = this.getConfigAndIdentifier(
            rateLimitType,
            request,
        );

        if (!config || !identifier) {
            this.logger.warn(`Missing config or identifier for ${rateLimitType}`);
            return true;
        }

        // Check rate limit
        const result = await this.rateLimitService.checkRateLimit(config, identifier);

        // Set rate limit headers
        response.setHeader('X-RateLimit-Limit', config.limit);
        response.setHeader('X-RateLimit-Remaining', result.remaining);
        response.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) +
            this.rateLimitService.calculateRetryAfter(config));

        if (!result.allowed) {
            response.setHeader('Retry-After', result.retryAfterSeconds);

            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    message: 'Rate limit exceeded',
                    retryAfter: result.retryAfterSeconds,
                },
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        return true;
    }

    /**
     * Get rate limit config and identifier based on type
     */
    private getConfigAndIdentifier(
        type: RateLimitType,
        request: any,
    ): { config: RateLimitConfig | null; identifier: string | null } {
        switch (type) {
            case RateLimitType.AUTH_IP:
                return {
                    config: RATE_LIMIT_CONFIGS.AUTH_IP,
                    identifier: this.getClientIp(request),
                };

            case RateLimitType.AUTH_EMAIL:
                const email = request.body?.email?.toLowerCase();
                if (!email) {
                    return { config: null, identifier: null };
                }
                return {
                    config: RATE_LIMIT_CONFIGS.AUTH_EMAIL,
                    identifier: email,
                };

            case RateLimitType.WEBHOOK_PROVIDER_IP:
                return {
                    config: RATE_LIMIT_CONFIGS.WEBHOOK_PROVIDER_IP,
                    identifier: this.getClientIp(request),
                };

            case RateLimitType.WEBHOOK_ORG:
                const orgId = request.params?.organizationId || request.headers['x-organization-id'];
                if (!orgId) {
                    return { config: null, identifier: null };
                }
                return {
                    config: RATE_LIMIT_CONFIGS.WEBHOOK_ORG,
                    identifier: orgId,
                };

            case RateLimitType.API_USER:
                const userId = request.user?.userId || request.user?.id;
                if (!userId) {
                    // Fall back to IP if no user
                    return {
                        config: RATE_LIMIT_CONFIGS.API_USER,
                        identifier: this.getClientIp(request),
                    };
                }
                return {
                    config: RATE_LIMIT_CONFIGS.API_USER,
                    identifier: userId,
                };

            case RateLimitType.RESEND_INVITE:
                // Rate limit resend by user ID + target user ID
                const resendUserId = request.user?.userId || request.user?.id || request.user?.sub;
                const targetUserId = request.params?.id;
                if (!resendUserId || !targetUserId) {
                    return { config: null, identifier: null };
                }
                return {
                    config: RATE_LIMIT_CONFIGS.RESEND_INVITE,
                    identifier: `${resendUserId}:${targetUserId}`,
                };

            default:
                return { config: null, identifier: null };
        }
    }

    /**
     * Extract client IP from request
     */
    private getClientIp(request: any): string {
        // Check for forwarded IP (behind proxy/load balancer)
        const forwarded = request.headers['x-forwarded-for'];
        if (forwarded) {
            // x-forwarded-for can be comma-separated list, take first one
            return forwarded.split(',')[0].trim();
        }

        // Check for real IP header (nginx)
        const realIp = request.headers['x-real-ip'];
        if (realIp) {
            return realIp;
        }

        // Fall back to socket IP
        return request.ip || request.connection?.remoteAddress || 'unknown';
    }
}
