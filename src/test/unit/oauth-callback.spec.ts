/**
 * OAuth Callback Security Service Unit Tests (OAUTH-06)
 * 
 * Tests cover:
 * - State generation produces 32+ bytes
 * - State stored in Redis with 10-minute TTL
 * - State validation succeeds with matching state
 * - State validation fails with mismatched state
 * - State deleted after use (no replay possible)
 * - Rate limiting applied (10/min per IP)
 * - HTTPS enforced in production
 * - Redirect only to allowed origins
 * - Edge cases and failure scenarios
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
    OAuthCallbackSecurityService,
    OAuthStateData
} from '../../src/common/security/oauth-callback-security.service';

describe('OAuthCallbackSecurityService', () => {
    let service: OAuthCallbackSecurityService;
    let configService: jest.Mocked<ConfigService>;

    // Mock Redis
    const mockRedis = {
        get: jest.fn(),
        setex: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        incr: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
    };

    // Sample state data
    const sampleStateData: OAuthStateData = {
        organizationId: 'org-123',
        provider: 'shopify',
        redirectUrl: 'http://localhost:3000/callback',
        createdAt: Date.now(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        configService = {
            get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                    'NODE_ENV': 'test',
                    'FRONTEND_URL': 'http://localhost:3000',
                    'OAUTH_ALLOWED_ORIGINS': 'http://localhost:3000,http://localhost:3001',
                };
                return config[key];
            }),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OAuthCallbackSecurityService,
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        service = module.get<OAuthCallbackSecurityService>(OAuthCallbackSecurityService);

        // Mock Redis connection
        (service as any).redis = mockRedis;
        (service as any).getRedis = () => mockRedis;
    });

    // =========================================================================
    // STATE GENERATION TESTS
    // =========================================================================
    describe('generateState', () => {
        it('should generate state of 32 bytes (64 hex characters)', () => {
            const state = service.generateState();
            expect(state).toHaveLength(64); // 32 bytes = 64 hex chars
        });

        it('should generate cryptographically random state', () => {
            const states = new Set<string>();

            // Generate 100 states and ensure all are unique
            for (let i = 0; i < 100; i++) {
                states.add(service.generateState());
            }

            expect(states.size).toBe(100);
        });

        it('should generate valid hex string', () => {
            const state = service.generateState();
            expect(state).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should return state size of 32 bytes', () => {
            expect(service.getStateSizeBytes()).toBe(32);
        });
    });

    // =========================================================================
    // STATE STORAGE TESTS
    // =========================================================================
    describe('storeState', () => {
        it('should store state in Redis with 10-minute TTL', async () => {
            const state = 'a'.repeat(64);

            await service.storeState(state, sampleStateData);

            expect(mockRedis.setex).toHaveBeenCalledWith(
                `oauth:state:${state}`,
                600, // 10 minutes
                expect.any(String)
            );
        });

        it('should store correct data structure', async () => {
            const state = 'b'.repeat(64);

            await service.storeState(state, sampleStateData);

            const storedData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
            expect(storedData.organizationId).toBe('org-123');
            expect(storedData.provider).toBe('shopify');
        });

        it('should throw error when Redis fails', async () => {
            mockRedis.setex.mockRejectedValueOnce(new Error('Redis error'));

            await expect(service.storeState('c'.repeat(64), sampleStateData))
                .rejects.toThrow('Failed to store OAuth state');
        });
    });

    // =========================================================================
    // STATE VALIDATION TESTS
    // =========================================================================
    describe('validateAndConsumeState', () => {
        it('should return state data when state is valid', async () => {
            const state = 'd'.repeat(64);
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(sampleStateData));
            mockRedis.del.mockResolvedValueOnce(1);

            const result = await service.validateAndConsumeState(state);

            expect(result.organizationId).toBe('org-123');
            expect(result.provider).toBe('shopify');
        });

        it('should delete state after successful validation (prevent replay)', async () => {
            const state = 'e'.repeat(64);
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(sampleStateData));
            mockRedis.del.mockResolvedValueOnce(1);

            await service.validateAndConsumeState(state);

            expect(mockRedis.del).toHaveBeenCalledWith(`oauth:state:${state}`);
        });

        it('should throw BadRequestException for missing state', async () => {
            await expect(service.validateAndConsumeState(''))
                .rejects.toThrow(BadRequestException);

            await expect(service.validateAndConsumeState(null as any))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException for invalid state format', async () => {
            // Too short
            await expect(service.validateAndConsumeState('abc'))
                .rejects.toThrow(BadRequestException);

            // Invalid characters
            await expect(service.validateAndConsumeState('g'.repeat(64)))
                .rejects.toThrow(BadRequestException);

            // Too long
            await expect(service.validateAndConsumeState('a'.repeat(65)))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException for non-existent state', async () => {
            const state = 'f'.repeat(64);
            mockRedis.get.mockResolvedValueOnce(null);

            await expect(service.validateAndConsumeState(state))
                .rejects.toThrow('Invalid or expired state');
        });

        it('should throw BadRequestException for expired state', async () => {
            const state = 'a1'.repeat(32);
            const expiredData = {
                ...sampleStateData,
                createdAt: Date.now() - (11 * 60 * 1000), // 11 minutes ago
            };
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(expiredData));

            await expect(service.validateAndConsumeState(state))
                .rejects.toThrow('State has expired');
        });
    });

    // =========================================================================
    // REPLAY ATTACK PREVENTION TESTS
    // =========================================================================
    describe('replay attack prevention', () => {
        it('should fail on second use of same state', async () => {
            const state = 'a2'.repeat(32);

            // First use - succeeds
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(sampleStateData));
            mockRedis.del.mockResolvedValueOnce(1);
            await service.validateAndConsumeState(state);

            // Second use - state was deleted, should fail
            mockRedis.get.mockResolvedValueOnce(null);

            await expect(service.validateAndConsumeState(state))
                .rejects.toThrow('Invalid or expired state');
        });
    });

    // =========================================================================
    // RATE LIMITING TESTS
    // =========================================================================
    describe('checkRateLimit', () => {
        it('should allow requests under the limit', async () => {
            mockRedis.incr.mockResolvedValueOnce(1);
            mockRedis.expire.mockResolvedValueOnce(1);

            const result = await service.checkRateLimit('192.168.1.1');
            expect(result).toBe(true);
        });

        it('should set expiry on first request', async () => {
            mockRedis.incr.mockResolvedValueOnce(1);
            mockRedis.expire.mockResolvedValueOnce(1);

            await service.checkRateLimit('192.168.1.2');

            expect(mockRedis.expire).toHaveBeenCalledWith(
                'oauth:ratelimit:192.168.1.2',
                60
            );
        });

        it('should throw ForbiddenException when limit exceeded', async () => {
            mockRedis.incr.mockResolvedValueOnce(11); // Over limit
            mockRedis.ttl.mockResolvedValueOnce(45);

            await expect(service.checkRateLimit('192.168.1.3'))
                .rejects.toThrow(ForbiddenException);
        });

        it('should allow exactly 10 requests per minute', async () => {
            mockRedis.incr.mockResolvedValueOnce(10);

            const result = await service.checkRateLimit('192.168.1.4');
            expect(result).toBe(true);
        });

        it('should block 11th request', async () => {
            mockRedis.incr.mockResolvedValueOnce(11);
            mockRedis.ttl.mockResolvedValueOnce(30);

            await expect(service.checkRateLimit('192.168.1.5'))
                .rejects.toThrow('Rate limit exceeded');
        });

        it('should fail open when Redis is unavailable', async () => {
            mockRedis.incr.mockRejectedValueOnce(new Error('Redis error'));

            const result = await service.checkRateLimit('192.168.1.6');
            expect(result).toBe(true); // Fail open
        });

        it('should skip rate limiting for empty IP', async () => {
            const result = await service.checkRateLimit('');
            expect(result).toBe(true);
        });
    });

    // =========================================================================
    // HTTPS ENFORCEMENT TESTS
    // =========================================================================
    describe('validateHttps', () => {
        it('should allow HTTP in non-production environment', () => {
            configService.get = jest.fn((key) => key === 'NODE_ENV' ? 'development' : undefined);

            expect(() => service.validateHttps('http')).not.toThrow();
        });

        it('should allow HTTPS in production', () => {
            configService.get = jest.fn((key) => key === 'NODE_ENV' ? 'production' : undefined);

            // Need to recreate service to pick up new NODE_ENV
            (service as any).configService = configService;

            expect(() => service.validateHttps('https')).not.toThrow();
        });

        it('should reject HTTP in production', () => {
            configService.get = jest.fn((key) => key === 'NODE_ENV' ? 'production' : undefined);
            (service as any).configService = configService;

            expect(() => service.validateHttps('http'))
                .toThrow('HTTPS required');
        });

        it('should respect X-Forwarded-Proto header', () => {
            configService.get = jest.fn((key) => key === 'NODE_ENV' ? 'production' : undefined);
            (service as any).configService = configService;

            // HTTP protocol but HTTPS forwarded - should pass
            expect(() => service.validateHttps('http', 'https')).not.toThrow();
        });

        it('should reject when X-Forwarded-Proto is HTTP in production', () => {
            configService.get = jest.fn((key) => key === 'NODE_ENV' ? 'production' : undefined);
            (service as any).configService = configService;

            expect(() => service.validateHttps('https', 'http'))
                .toThrow('HTTPS required');
        });
    });

    // =========================================================================
    // REDIRECT VALIDATION TESTS
    // =========================================================================
    describe('validateRedirectUrl', () => {
        it('should allow redirect to localhost in non-production', () => {
            expect(() => service.validateRedirectUrl('http://localhost:3000/callback'))
                .not.toThrow();
        });

        it('should allow redirect to configured FRONTEND_URL', () => {
            expect(() => service.validateRedirectUrl('http://localhost:3000/dashboard'))
                .not.toThrow();
        });

        it('should block redirect to unauthorized origin', () => {
            expect(() => service.validateRedirectUrl('https://evil.com/steal'))
                .toThrow('Redirect URL not in allowed origins');
        });

        it('should block redirect with invalid URL format', () => {
            expect(() => service.validateRedirectUrl('not-a-valid-url'))
                .toThrow('Invalid redirect URL format');
        });

        it('should allow empty redirect URL', () => {
            expect(() => service.validateRedirectUrl('')).not.toThrow();
        });
    });

    // =========================================================================
    // SAFE REDIRECT TESTS
    // =========================================================================
    describe('getSafeRedirectUrl', () => {
        it('should return allowed URL unchanged', () => {
            const result = service.getSafeRedirectUrl('http://localhost:3000/callback');
            expect(result).toBe('http://localhost:3000/callback');
        });

        it('should return fallback for unauthorized URL', () => {
            const result = service.getSafeRedirectUrl('https://evil.com/steal');
            expect(result).toBe('http://localhost:3000');
        });

        it('should return default URL when not provided', () => {
            const result = service.getSafeRedirectUrl(undefined);
            expect(result).toBe('http://localhost:3000');
        });

        it('should return custom default when provided', () => {
            const result = service.getSafeRedirectUrl(undefined, '/dashboard');
            expect(result).toBe('/dashboard');
        });
    });

    // =========================================================================
    // COMBINED VALIDATION TESTS
    // =========================================================================
    describe('validateCallback', () => {
        it('should perform all validations and return state data', async () => {
            const state = 'a3'.repeat(32);
            mockRedis.incr.mockResolvedValueOnce(1);
            mockRedis.expire.mockResolvedValueOnce(1);
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(sampleStateData));
            mockRedis.del.mockResolvedValueOnce(1);

            const result = await service.validateCallback({
                state,
                ip: '192.168.1.10',
                protocol: 'https',
                redirectUrl: 'http://localhost:3000/callback',
            });

            expect(result.organizationId).toBe('org-123');
        });

        it('should fail on rate limit exceeded', async () => {
            mockRedis.incr.mockResolvedValueOnce(15);
            mockRedis.ttl.mockResolvedValueOnce(30);

            await expect(service.validateCallback({
                state: 'a4'.repeat(32),
                ip: '192.168.1.11',
                protocol: 'https',
            })).rejects.toThrow(ForbiddenException);
        });

        it('should fail on invalid state', async () => {
            mockRedis.incr.mockResolvedValueOnce(1);
            mockRedis.expire.mockResolvedValueOnce(1);
            mockRedis.get.mockResolvedValueOnce(null);

            await expect(service.validateCallback({
                state: 'a5'.repeat(32),
                ip: '192.168.1.12',
                protocol: 'https',
            })).rejects.toThrow(BadRequestException);
        });
    });

    // =========================================================================
    // CREATE STATE HELPER TESTS
    // =========================================================================
    describe('createState', () => {
        it('should create state with generated ID and store it', async () => {
            mockRedis.setex.mockResolvedValueOnce('OK');

            const state = await service.createState({
                organizationId: 'org-456',
                provider: 'woocommerce',
            });

            expect(state).toHaveLength(64);
            expect(mockRedis.setex).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // STATE EXISTS CHECK TESTS
    // =========================================================================
    describe('stateExists', () => {
        it('should return true when state exists', async () => {
            mockRedis.exists.mockResolvedValueOnce(1);

            const result = await service.stateExists('a6'.repeat(32));
            expect(result).toBe(true);
        });

        it('should return false when state does not exist', async () => {
            mockRedis.exists.mockResolvedValueOnce(0);

            const result = await service.stateExists('a7'.repeat(32));
            expect(result).toBe(false);
        });

        it('should return false for empty state', async () => {
            const result = await service.stateExists('');
            expect(result).toBe(false);
        });
    });

    // =========================================================================
    // DELETE STATE TESTS
    // =========================================================================
    describe('deleteState', () => {
        it('should delete state from Redis', async () => {
            mockRedis.del.mockResolvedValueOnce(1);

            await service.deleteState('a8'.repeat(32));

            expect(mockRedis.del).toHaveBeenCalledWith('oauth:state:' + 'a8'.repeat(32));
        });

        it('should not throw when deletion fails', async () => {
            mockRedis.del.mockRejectedValueOnce(new Error('Redis error'));

            await expect(service.deleteState('a9'.repeat(32))).resolves.not.toThrow();
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================
    describe('edge cases', () => {
        it('should handle IPv6 addresses in rate limiting', async () => {
            mockRedis.incr.mockResolvedValueOnce(1);
            mockRedis.expire.mockResolvedValueOnce(1);

            const result = await service.checkRateLimit('::1');
            expect(result).toBe(true);
        });

        it('should handle special characters in IP', async () => {
            mockRedis.incr.mockResolvedValueOnce(1);
            mockRedis.expire.mockResolvedValueOnce(1);

            const result = await service.checkRateLimit('192.168.1.1:8080');
            expect(result).toBe(true);
        });

        it('should return correct TTL seconds', () => {
            expect(service.getStateTtlSeconds()).toBe(600);
        });

        it('should report if request is secure', () => {
            expect(service.isSecureRequest('https')).toBe(true);
            expect(service.isSecureRequest('http')).toBe(false);
            expect(service.isSecureRequest('http', 'https')).toBe(true);
        });
    });
});
