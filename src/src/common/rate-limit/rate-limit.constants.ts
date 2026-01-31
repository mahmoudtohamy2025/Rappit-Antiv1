
// Mapped for backward compatibility with tests
export const RATE_LIMIT_CONFIGS = {
    LOGIN: {
        windowSeconds: 15 * 60, // 15 minutes
        limit: 5,
        keyPrefix: 'auth:login',
    },
    // Alias for tests
    AUTH_IP: {
        windowSeconds: 15 * 60,
        limit: 5,
        keyPrefix: 'auth:login',
    },
    AUTH_EMAIL: {
        windowSeconds: 15 * 60,
        limit: 5,
        keyPrefix: 'auth:email',
    },
    WEBHOOK_PROVIDER_IP: {
        windowSeconds: 60,
        limit: 60,
        keyPrefix: 'webhook:ip',
    },
    WEBHOOK_ORG: {
        windowSeconds: 60,
        limit: 60,
        keyPrefix: 'webhook:org',
    },
    API_USER: {
        windowSeconds: 60,
        limit: 1000,
        keyPrefix: 'api:user',
    },
    RESEND_INVITE: {
        windowSeconds: 60 * 60, // 1 hour
        limit: 3,
        keyPrefix: 'auth:resend',
    },
    API: {
        windowSeconds: 60,
        limit: 100,
        keyPrefix: 'api:general',
    },
    ACCOUNT_LOCKOUT: {
        windowSeconds: 30 * 60, // 30 minutes
        limit: 10,
        keyPrefix: 'auth:lockout',
    },
};

export interface RateLimitConfig {
    windowSeconds: number;
    limit: number;
    keyPrefix: string;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds?: number;
    totalHits: number;
}
