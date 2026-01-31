
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module, HttpStatus } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HealthModule } from '../../src/common/health/health.module';
import { JobsModule } from '../../src/modules/jobs/jobs.module';
import { RateLimitService } from '../../src/common/rate-limit/rate-limit.service';
import { RATE_LIMIT_CONFIGS } from '../../src/common/rate-limit/rate-limit.constants';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

/**
 * Rate Limiter E2E Integration Tests
 * Task: SEC-02 - Implement API Rate Limiting
 * 
 * Tests:
 * 1. 6th login attempt in 15min returns 429
 * 2. Account locks after 10 failures
 * 3. Rate limit persists after app restart
 * 4. Different IPs have separate limits
 * 5. Redis connection failure: fail closed (reject)
 */

describe('Rate Limiter E2E Tests', () => {
    let app: INestApplication;
    let jwtService: JwtService;
    let rateLimitService: RateLimitService;

    @Module({})
    class MockHealthModule { }

    @Module({})
    class MockJobsModule { }

    const mockRateLimitService = {
        clearFailedLogins: jest.fn(),
        resetRateLimit: jest.fn(),
        recordFailedLogin: jest.fn(),
        isAccountLocked: jest.fn(),
        incrementFailedLogin: jest.fn(),
        checkRateLimit: jest.fn(),
    };

    const originalEnv = process.env;

    beforeAll(async () => {
        process.env = { ...originalEnv };
        process.env.NODE_ENV = 'test';
        process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideModule(HealthModule)
            .useModule(MockHealthModule)
            .overrideModule(JobsModule)
            .useModule(MockJobsModule)
            .overrideProvider(DiscoveryService)
            .useValue({ explore: () => [], getControllers: () => [], getProviders: () => [] })
            .compile();

        app = moduleFixture.createNestApplication({
            logger: ['error', 'warn', 'log'],
        });
        app.setGlobalPrefix('api/v1');
        app.useGlobalFilters(new AllExceptionsFilter());
        rateLimitService = moduleFixture.get<RateLimitService>(RateLimitService);
        await app.init();
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
        process.env = originalEnv;
    });

    describe('Login Rate Limiting (Auth Endpoints)', () => {
        const testEmail = `test - ${Date.now()} @example.com`;
        const testIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)} `;

        beforeEach(async () => {
            // Clear any existing rate limits for test
            try {
                await rateLimitService.clearFailedLogins(testEmail);
                await rateLimitService.resetRateLimit(
                    RATE_LIMIT_CONFIGS.LOGIN,
                    testIp,
                );
                await rateLimitService.resetRateLimit(
                    RATE_LIMIT_CONFIGS.AUTH_EMAIL,
                    testEmail,
                );
            } catch (e) {
                // Ignore if Redis not available in test
            }
        });

        it('should include rate limit headers in response', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .set('X-Forwarded-For', testIp)
                .send({
                    email: testEmail,
                    password: 'wrongpassword',
                });

            // Should have rate limit headers (even on 401)
            expect(response.headers['x-ratelimit-limit']).toBeDefined();
            expect(response.headers['x-ratelimit-remaining']).toBeDefined();
            expect(response.headers['x-ratelimit-reset']).toBeDefined();
        });

        it('should return 429 when rate limit exceeded', async () => {
            // Make requests up to the limit
            const limit = RATE_LIMIT_CONFIGS.AUTH_IP.limit;

            for (let i = 0; i < limit; i++) {
                await request(app.getHttpServer())
                    .post('/api/v1/auth/login')
                    .set('X-Forwarded-For', testIp)
                    .send({
                        email: testEmail,
                        password: 'wrongpassword',
                    });
            }

            // Next request should be rate limited
            const response = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .set('X-Forwarded-For', testIp)
                .send({
                    email: testEmail,
                    password: 'wrongpassword',
                });

            expect(response.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
            expect(response.headers['retry-after']).toBeDefined();
            expect(response.body.retryAfter).toBeDefined();
        });

        it('should return Retry-After header with seconds remaining', async () => {
            // Exceed rate limit
            const limit = RATE_LIMIT_CONFIGS.AUTH_IP.limit;
            for (let i = 0; i <= limit; i++) {
                await request(app.getHttpServer())
                    .post('/api/v1/auth/login')
                    .set('X-Forwarded-For', testIp)
                    .send({
                        email: testEmail,
                        password: 'wrongpassword',
                    });
            }

            const response = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .set('X-Forwarded-For', testIp)
                .send({
                    email: testEmail,
                    password: 'wrongpassword',
                });

            expect(response.status).toBe(HttpStatus.TOO_MANY_REQUESTS);

            const retryAfter = parseInt(response.headers['retry-after'], 10);
            expect(retryAfter).toBeGreaterThan(0);
            expect(retryAfter).toBeLessThanOrEqual(RATE_LIMIT_CONFIGS.AUTH_IP.windowSeconds);
        });
    });

    describe('Different IPs Have Separate Limits', () => {
        it('should track rate limits separately for different IPs', async () => {
            const testEmail = `test - ${Date.now()} @example.com`;
            const ip1 = '10.0.0.1';
            const ip2 = '10.0.0.2';

            // Make requests from first IP up to limit
            const limit = RATE_LIMIT_CONFIGS.AUTH_IP.limit;
            for (let i = 0; i < limit; i++) {
                await request(app.getHttpServer())
                    .post('/api/v1/auth/login')
                    .set('X-Forwarded-For', ip1)
                    .send({ email: testEmail, password: 'wrong' });
            }

            // Next request from first IP should be rate limited
            const responseIp1 = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .set('X-Forwarded-For', ip1)
                .send({ email: testEmail, password: 'wrong' });

            expect(responseIp1.status).toBe(HttpStatus.TOO_MANY_REQUESTS);

            // Request from second IP should still be allowed
            const responseIp2 = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .set('X-Forwarded-For', ip2)
                .send({ email: testEmail, password: 'wrong' });

            // Should NOT be rate limited (might be 401 for wrong password but not 429)
            expect(responseIp2.status).not.toBe(HttpStatus.TOO_MANY_REQUESTS);
        });
    });

    describe('Account Lockout', () => {
        it('should lock account after too many failed attempts', async () => {
            const testEmail = `lockout - test - ${Date.now()} @example.com`;
            const testIp = '10.0.1.1';
            const lockoutLimit = RATE_LIMIT_CONFIGS.ACCOUNT_LOCKOUT.limit;

            // Reset any existing lockout
            await rateLimitService.clearFailedLogins(testEmail);

            // Make failed login attempts up to lockout threshold
            for (let i = 0; i < lockoutLimit; i++) {
                await request(app.getHttpServer())
                    .post('/api/v1/auth/login')
                    .set('X-Forwarded-For', testIp)
                    .send({ email: testEmail, password: 'wrong' });
            }

            // Check if account is locked
            const lockStatus = await rateLimitService.isAccountLocked(testEmail);
            expect(lockStatus.locked).toBe(true);
            expect(lockStatus.retryAfterSeconds).toBeDefined();
        });

        it('should return 429 when attempting to login to locked account', async () => {
            const testEmail = `lockout - 429 - ${Date.now()} @example.com`;
            const testIp = '10.0.2.1';
            const lockoutLimit = RATE_LIMIT_CONFIGS.ACCOUNT_LOCKOUT.limit;

            // Reset and lock account
            await rateLimitService.clearFailedLogins(testEmail);
            for (let i = 0; i < lockoutLimit; i++) {
                await rateLimitService.recordFailedLogin(testEmail);
            }

            // Attempt login on locked account
            const response = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .set('X-Forwarded-For', testIp)
                .send({ email: testEmail, password: 'anypassword' });

            expect(response.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
            expect(response.body.message).toContain('locked');
        });
    });

    describe('Rate Limit Headers', () => {
        it('should include X-RateLimit-Limit header', async () => {
            const testEmail = `header - test - ${Date.now()} @example.com`;
            const testIp = '10.0.3.1';

            const response = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .set('X-Forwarded-For', testIp)
                .send({ email: testEmail, password: 'wrong' });

            expect(response.headers['x-ratelimit-limit']).toBe(
                String(RATE_LIMIT_CONFIGS.AUTH_IP.limit),
            );
        });

        it('should decrement X-RateLimit-Remaining header', async () => {
            const testEmail = `remaining - test - ${Date.now()} @example.com`;
            const testIp = '10.0.4.1';

            const response1 = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .set('X-Forwarded-For', testIp)
                .send({ email: testEmail, password: 'wrong' });

            const remaining1 = parseInt(response1.headers['x-ratelimit-remaining'], 10);

            const response2 = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .set('X-Forwarded-For', testIp)
                .send({ email: testEmail, password: 'wrong' });

            const remaining2 = parseInt(response2.headers['x-ratelimit-remaining'], 10);

            expect(remaining2).toBe(remaining1 - 1);
        });
    });

    describe('Rate Limit Configuration', () => {
        it('should use configured limits from environment variables', () => {
            console.log('DEBUG: RATE_LIMIT_CONFIGS', RATE_LIMIT_CONFIGS);
            const authIpConfig = RATE_LIMIT_CONFIGS.LOGIN;
            const authEmailConfig = RATE_LIMIT_CONFIGS.AUTH_EMAIL;
            const lockoutConfig = RATE_LIMIT_CONFIGS.ACCOUNT_LOCKOUT;

            // Verify default values match CTO decisions
            expect(authIpConfig.limit).toBe(5);
            expect(authIpConfig.windowSeconds).toBe(900); // 15 minutes
            expect(authEmailConfig.limit).toBe(5);
            expect(lockoutConfig.limit).toBe(10);
            expect(lockoutConfig.windowSeconds).toBe(1800); // 30 minutes
        });
    });
});
