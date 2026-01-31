import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HealthModule } from '../../src/common/health/health.module';
import { JobsModule } from '../../src/modules/jobs/jobs.module';
import { validateCorsConfig, getCorsConfig } from '../../src/middleware/cors.middleware';

/**
 * CORS E2E Integration Tests
 * Task: SEC-01 - Restrict CORS to Allowed Origins
 * 
 * Tests:
 * 1. API request from allowed origin succeeds
 * 2. API request from disallowed origin returns 403
 * 3. Missing CORS_ORIGIN in production throws error
 * 4. Empty CORS_ORIGIN throws error
 */

describe('CORS E2E Tests (cors.e2e-spec)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('Production Environment Configuration Validation', () => {
        it('should throw error when CORS_ORIGIN is missing in production', () => {
            process.env.NODE_ENV = 'production';
            delete process.env.CORS_ORIGIN;

            expect(() => validateCorsConfig()).toThrow(
                'CORS_ORIGIN environment variable is required in production'
            );
        });

        it('should throw error when CORS_ORIGIN is empty in production', () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = '';

            expect(() => validateCorsConfig()).toThrow(
                'CORS_ORIGIN environment variable is required in production'
            );
        });

        it('should throw error when CORS_ORIGIN contains only whitespace in production', () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = '   ';

            expect(() => validateCorsConfig()).toThrow(
                'CORS_ORIGIN environment variable is required in production'
            );
        });

        it('should not throw when CORS_ORIGIN is properly configured in production', () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = 'https://app.rappit.com';

            expect(() => validateCorsConfig()).not.toThrow();
        });
    });

    describe('CORS Request Handling (Integration)', () => {
        let app: INestApplication;

        @Module({})
        class MockHealthModule { }

        @Module({})
        class MockJobsModule { }

        beforeAll(async () => {
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

            app = moduleFixture.createNestApplication();
            app.enableCors(getCorsConfig());
            await app.init();
        });

        beforeEach(() => {
            // Set up test environment variables for EACH test (since outer beforeEach resets them)
            process.env.NODE_ENV = 'test';
            process.env.CORS_ORIGIN = 'https://app.rappit.com,https://admin.rappit.com';
            process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
            process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
        });

        afterAll(async () => {
            if (app) {
                await app.close();
            }
        });

        it('should return CORS headers for allowed origin', async () => {
            const response = await request(app.getHttpServer())
                .options('/api/v1/health')
                .set('Origin', 'https://app.rappit.com')
                .set('Access-Control-Request-Method', 'GET');

            expect(response.headers['access-control-allow-origin']).toBe('https://app.rappit.com');
            expect(response.headers['access-control-allow-credentials']).toBe('true');
        });

        it('should return CORS headers for second allowed origin', async () => {
            const response = await request(app.getHttpServer())
                .options('/api/v1/health')
                .set('Origin', 'https://admin.rappit.com')
                .set('Access-Control-Request-Method', 'GET');

            expect(response.headers['access-control-allow-origin']).toBe('https://admin.rappit.com');
        });

        it('should reject request from disallowed origin', async () => {
            const response = await request(app.getHttpServer())
                .options('/api/v1/health')
                .set('Origin', 'https://evil.com')
                .set('Access-Control-Request-Method', 'GET');

            // When origin is rejected, the access-control-allow-origin header should not be set
            // or the request should fail
            expect(response.headers['access-control-allow-origin']).not.toBe('https://evil.com');
        });

        it('should allow request with no origin header (same-origin/server)', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/health');

            // Request should succeed (not be blocked by CORS)
            expect(response.status).not.toBe(403);
        });

        it('should allow localhost in test/development mode', async () => {
            const response = await request(app.getHttpServer())
                .options('/api/v1/health')
                .set('Origin', 'http://localhost:3000')
                .set('Access-Control-Request-Method', 'GET');

            expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
        });
    });

    describe('CORS Header Configuration', () => {
        it('should include credentials in CORS config', () => {
            const config = getCorsConfig();
            expect(config.credentials).toBe(true);
        });

        it('should include required HTTP methods', () => {
            const config = getCorsConfig();
            expect(config.methods).toContain('GET');
            expect(config.methods).toContain('POST');
            expect(config.methods).toContain('PUT');
            expect(config.methods).toContain('PATCH');
            expect(config.methods).toContain('DELETE');
            expect(config.methods).toContain('OPTIONS');
        });

        it('should include Authorization in allowed headers', () => {
            const config = getCorsConfig();
            expect(config.allowedHeaders).toContain('Authorization');
        });

        it('should include Content-Type in allowed headers', () => {
            const config = getCorsConfig();
            expect(config.allowedHeaders).toContain('Content-Type');
        });

        it('should include X-Correlation-ID in allowed and exposed headers', () => {
            const config = getCorsConfig();
            expect(config.allowedHeaders).toContain('X-Correlation-ID');
            expect(config.exposedHeaders).toContain('X-Correlation-ID');
        });

        it('should set max age for preflight caching', () => {
            const config = getCorsConfig();
            expect(config.maxAge).toBe(86400); // 24 hours
        });
    });
});
