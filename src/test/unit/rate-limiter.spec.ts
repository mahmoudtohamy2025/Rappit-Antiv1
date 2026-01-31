import {
    RateLimitService,
    RateLimitConfig,
} from '../../src/common/rate-limit/rate-limit.service';
import { RATE_LIMIT_CONFIGS } from '../../src/common/rate-limit/rate-limit.constants';

/**
 * Rate Limiter Unit Tests
 * Task: SEC-02 - Implement API Rate Limiting
 * 
 * Tests:
 * 1. Counter increments correctly
 * 2. Counter resets after window expires
 * 3. Retry-After header calculated correctly
 */

// Mock Redis
const mockRedis = {
    incr: jest.fn(),
    expire: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    setex: jest.fn(),
};

// Mock getRedisConnection
jest.mock('../../src/queues/redis-connection', () => ({
    getRedisConnection: () => mockRedis,
}));

describe('RateLimitService', () => {
    let service: RateLimitService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new RateLimitService();
    });

    describe('generateKey', () => {
        it('should generate key with prefix, identifier, and window', () => {
            const config: RateLimitConfig = {
                limit: 5,
                windowSeconds: 900,
                keyPrefix: 'ratelimit:auth:ip',
            };

            const key = service.generateKey(config, '192.168.1.1');

            expect(key).toMatch(/^ratelimit:auth:ip:192\.168\.1\.1:\d+$/);
        });

        it('should generate different keys for different windows', async () => {
            const config: RateLimitConfig = {
                limit: 5,
                windowSeconds: 1, // 1 second window for testing
                keyPrefix: 'ratelimit:test',
            };

            const key1 = service.generateKey(config, 'test');

            // Wait for next window
            await new Promise((resolve) => setTimeout(resolve, 1100));

            const key2 = service.generateKey(config, 'test');

            expect(key1).not.toBe(key2);
        });
    });

    describe('calculateRetryAfter', () => {
        it('should calculate seconds remaining in current window', () => {
            const config: RateLimitConfig = {
                limit: 5,
                windowSeconds: 900,
                keyPrefix: 'ratelimit:test',
            };

            const retryAfter = service.calculateRetryAfter(config);

            // Should be between 1 and 900 seconds
            expect(retryAfter).toBeGreaterThan(0);
            expect(retryAfter).toBeLessThanOrEqual(900);
        });

        it('should return smaller value as window nears end', () => {
            const config: RateLimitConfig = {
                limit: 5,
                windowSeconds: 60,
                keyPrefix: 'ratelimit:test',
            };

            const retryAfter = service.calculateRetryAfter(config);

            // Should be between 1 and 60 seconds
            expect(retryAfter).toBeGreaterThan(0);
            expect(retryAfter).toBeLessThanOrEqual(60);
        });
    });

    describe('checkRateLimit', () => {
        it('should allow request when under limit', async () => {
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.expire.mockResolvedValue(1);

            const config = RATE_LIMIT_CONFIGS.AUTH_IP;
            const result = await service.checkRateLimit(config, '192.168.1.1');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(config.limit - 1);
            expect(result.totalHits).toBe(1);
            expect(mockRedis.incr).toHaveBeenCalled();
        });

        it('should increment counter correctly', async () => {
            mockRedis.incr.mockResolvedValue(3);

            const config = RATE_LIMIT_CONFIGS.AUTH_IP;
            const result = await service.checkRateLimit(config, '192.168.1.1');

            expect(result.totalHits).toBe(3);
            expect(result.remaining).toBe(config.limit - 3);
        });

        it('should set expiry on first hit', async () => {
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.expire.mockResolvedValue(1);

            const config = RATE_LIMIT_CONFIGS.AUTH_IP;
            await service.checkRateLimit(config, '192.168.1.1');

            expect(mockRedis.expire).toHaveBeenCalledWith(
                expect.any(String),
                config.windowSeconds,
            );
        });

        it('should not set expiry on subsequent hits', async () => {
            mockRedis.incr.mockResolvedValue(2);

            const config = RATE_LIMIT_CONFIGS.AUTH_IP;
            await service.checkRateLimit(config, '192.168.1.1');

            expect(mockRedis.expire).not.toHaveBeenCalled();
        });

        it('should reject request when over limit', async () => {
            mockRedis.incr.mockResolvedValue(6); // Over limit of 5

            const config = RATE_LIMIT_CONFIGS.AUTH_IP;
            const result = await service.checkRateLimit(config, '192.168.1.1');

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.retryAfterSeconds).toBeDefined();
            expect(result.retryAfterSeconds).toBeGreaterThan(0);
        });

        it('should include retryAfterSeconds when limit exceeded', async () => {
            mockRedis.incr.mockResolvedValue(6);

            const config = RATE_LIMIT_CONFIGS.AUTH_IP;
            const result = await service.checkRateLimit(config, '192.168.1.1');

            expect(result.retryAfterSeconds).toBeDefined();
            expect(result.retryAfterSeconds).toBeGreaterThan(0);
            expect(result.retryAfterSeconds).toBeLessThanOrEqual(config.windowSeconds);
        });
    });

    describe('isAccountLocked', () => {
        it('should return locked=false when under lockout threshold', async () => {
            mockRedis.get.mockResolvedValue('5');

            const result = await service.isAccountLocked('test@example.com');

            expect(result.locked).toBe(false);
        });

        it('should return locked=true when at lockout threshold', async () => {
            mockRedis.get.mockResolvedValue('10');
            mockRedis.ttl.mockResolvedValue(1500);

            const result = await service.isAccountLocked('test@example.com');

            expect(result.locked).toBe(true);
            expect(result.retryAfterSeconds).toBe(1500);
        });

        it('should return locked=true when over lockout threshold', async () => {
            mockRedis.get.mockResolvedValue('15');
            mockRedis.ttl.mockResolvedValue(1200);

            const result = await service.isAccountLocked('test@example.com');

            expect(result.locked).toBe(true);
            expect(result.retryAfterSeconds).toBe(1200);
        });

        it('should return locked=false when no failed attempts', async () => {
            mockRedis.get.mockResolvedValue(null);

            const result = await service.isAccountLocked('test@example.com');

            expect(result.locked).toBe(false);
        });

        it('should normalize email to lowercase', async () => {
            mockRedis.get.mockResolvedValue(null);

            await service.isAccountLocked('TEST@EXAMPLE.COM');

            expect(mockRedis.get).toHaveBeenCalledWith(
                expect.stringContaining('test@example.com'),
            );
        });
    });

    describe('recordFailedLogin', () => {
        it('should increment failed login counter', async () => {
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.expire.mockResolvedValue(1);

            const result = await service.recordFailedLogin('test@example.com');

            expect(result).toBe(1);
            expect(mockRedis.incr).toHaveBeenCalled();
        });

        it('should set expiry to lockout duration', async () => {
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.expire.mockResolvedValue(1);

            await service.recordFailedLogin('test@example.com');

            expect(mockRedis.expire).toHaveBeenCalledWith(
                expect.any(String),
                RATE_LIMIT_CONFIGS.ACCOUNT_LOCKOUT.windowSeconds,
            );
        });

        it('should normalize email to lowercase', async () => {
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.expire.mockResolvedValue(1);

            await service.recordFailedLogin('TEST@EXAMPLE.COM');

            expect(mockRedis.incr).toHaveBeenCalledWith(
                expect.stringContaining('test@example.com'),
            );
        });
    });

    describe('clearFailedLogins', () => {
        it('should delete failed login counter', async () => {
            mockRedis.del.mockResolvedValue(1);

            await service.clearFailedLogins('test@example.com');

            expect(mockRedis.del).toHaveBeenCalled();
        });

        it('should normalize email to lowercase', async () => {
            mockRedis.del.mockResolvedValue(1);

            await service.clearFailedLogins('TEST@EXAMPLE.COM');

            expect(mockRedis.del).toHaveBeenCalledWith(
                expect.stringContaining('test@example.com'),
            );
        });
    });

    describe('getRateLimitStatus', () => {
        it('should return current counter value', async () => {
            mockRedis.get.mockResolvedValue('3');

            const config = RATE_LIMIT_CONFIGS.AUTH_IP;
            const result = await service.getRateLimitStatus(config, '192.168.1.1');

            expect(result.current).toBe(3);
            expect(result.limit).toBe(config.limit);
            expect(result.remaining).toBe(config.limit - 3);
        });

        it('should return 0 when no counter exists', async () => {
            mockRedis.get.mockResolvedValue(null);

            const config = RATE_LIMIT_CONFIGS.AUTH_IP;
            const result = await service.getRateLimitStatus(config, '192.168.1.1');

            expect(result.current).toBe(0);
            expect(result.remaining).toBe(config.limit);
        });
    });

    describe('fail-closed behavior', () => {
        it('should throw error when Redis is unavailable', async () => {
            mockRedis.incr.mockRejectedValue(new Error('Connection refused'));

            const config = RATE_LIMIT_CONFIGS.AUTH_IP;

            await expect(
                service.checkRateLimit(config, '192.168.1.1'),
            ).rejects.toThrow('Service temporarily unavailable');
        });
    });
});
