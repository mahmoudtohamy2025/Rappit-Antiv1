/**
 * DHL OAuth 2.0 Service Unit Tests (OAUTH-05)
 * 
 * Tests cover:
 * - Token request formatted correctly
 * - Cache TTL calculation (expires_in - 300)
 * - Token reuse from cache
 * - Stampede protection
 * - Invalid credentials handled (NEEDS_REAUTH)
 * - Network error handling
 * - Timeout handling
 * - Rate limiting (429)
 * - Server errors (5xx)
 * - Invalid JSON response
 * - Empty token response
 * - Edge cases and failure scenarios
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DHLOAuthService, DHLAuthError, DHLShippingAccount } from '../../src/modules/integrations/dhl/dhl-oauth.service';
import { EncryptionService } from '../../src/common/encryption/encryption.service';
import { PrismaService } from '../../src/common/database/prisma.service';

describe('DHLOAuthService', () => {
    let service: DHLOAuthService;
    let configService: jest.Mocked<ConfigService>;
    let encryptionService: jest.Mocked<EncryptionService>;
    let prismaService: jest.Mocked<PrismaService>;

    // Mock fetch globally
    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Mock Redis
    const mockRedis = {
        get: jest.fn(),
        setex: jest.fn(),
        del: jest.fn(),
    };

    // Mock shipping account
    const mockShippingAccount: DHLShippingAccount = {
        id: 'test-account-123',
        organizationId: 'org-123',
        carrier: 'DHL',
        accountNumber: '123456789',
        testMode: true,
        credentials: {
            clientId: 'test_client_id',
            clientSecret: 'test_client_secret',
        },
        status: 'ACTIVE',
    };

    // Mock token response from DHL
    const mockTokenResponse = {
        access_token: 'mock_dhl_access_token_12345',
        token_type: 'Bearer',
        expires_in: 3600,
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        configService = {
            get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                    'DHL_CLIENT_ID': 'default_client_id',
                    'DHL_CLIENT_SECRET': 'default_client_secret',
                };
                return config[key];
            }),
        } as any;

        encryptionService = {
            encryptToString: jest.fn((data: string) => `encrypted:${data}`),
            decryptFromString: jest.fn((data: string) => data.replace('encrypted:', '')),
        } as any;

        prismaService = {
            shippingAccount: {
                update: jest.fn().mockResolvedValue({ id: 'test-account-123', status: 'NEEDS_REAUTH' }),
                findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
            },
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DHLOAuthService,
                { provide: ConfigService, useValue: configService },
                { provide: EncryptionService, useValue: encryptionService },
                { provide: PrismaService, useValue: prismaService },
            ],
        }).compile();

        service = module.get<DHLOAuthService>(DHLOAuthService);

        // Mock the getRedis method
        (service as any).redis = mockRedis;
        (service as any).getRedis = () => mockRedis;
    });

    // =========================================================================
    // OAUTH ENDPOINT TESTS
    // =========================================================================
    describe('getOAuthEndpoint', () => {
        it('should return sandbox URL when testMode is true', () => {
            const endpoint = service.getOAuthEndpoint(true);
            expect(endpoint).toBe('https://api-sandbox.dhl.com/auth/accesstoken');
        });

        it('should return production URL when testMode is false', () => {
            const endpoint = service.getOAuthEndpoint(false);
            expect(endpoint).toBe('https://api.dhl.com/auth/accesstoken');
        });
    });

    // =========================================================================
    // TOKEN REQUEST FORMAT TESTS
    // =========================================================================
    describe('fetchNewToken - Request Format', () => {
        it('should include correct grant_type in request', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify(mockTokenResponse),
            });

            await service.fetchNewToken(mockShippingAccount);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json',
                    },
                })
            );

            const fetchCall = mockFetch.mock.calls[0];
            const body = fetchCall[1].body;
            expect(body.get('grant_type')).toBe('client_credentials');
        });

        it('should include client_id and client_secret in request', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify(mockTokenResponse),
            });

            await service.fetchNewToken(mockShippingAccount);

            const fetchCall = mockFetch.mock.calls[0];
            const body = fetchCall[1].body;
            expect(body.get('client_id')).toBe('test_client_id');
            expect(body.get('client_secret')).toBe('test_client_secret');
        });

        it('should use sandbox URL when testMode is true', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify(mockTokenResponse),
            });

            await service.fetchNewToken(mockShippingAccount);

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api-sandbox.dhl.com/auth/accesstoken',
                expect.any(Object)
            );
        });

        it('should use production URL when testMode is false', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify(mockTokenResponse),
            });

            const productionAccount = { ...mockShippingAccount, testMode: false };
            await service.fetchNewToken(productionAccount);

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.dhl.com/auth/accesstoken',
                expect.any(Object)
            );
        });

        it('should return access_token from response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify(mockTokenResponse),
            });

            const token = await service.fetchNewToken(mockShippingAccount);
            expect(token).toBe('mock_dhl_access_token_12345');
        });
    });

    // =========================================================================
    // ERROR HANDLING TESTS - AUTHENTICATION ERRORS
    // =========================================================================
    describe('fetchNewToken - Authentication Errors', () => {
        it('should throw NEEDS_REAUTH error on 401', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Invalid credentials',
            });

            try {
                await service.fetchNewToken(mockShippingAccount);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DHLAuthError);
                expect((error as DHLAuthError).code).toBe('NEEDS_REAUTH');
                expect((error as DHLAuthError).statusCode).toBe(401);
            }
        });

        it('should throw NEEDS_REAUTH error on 403', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                text: async () => 'Forbidden',
            });

            try {
                await service.fetchNewToken(mockShippingAccount);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DHLAuthError);
                expect((error as DHLAuthError).code).toBe('NEEDS_REAUTH');
            }
        });

        it('should update database on 401/403', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Invalid credentials',
            });

            try {
                await service.fetchNewToken(mockShippingAccount);
            } catch {
                // Expected
            }

            expect(prismaService.shippingAccount.update).toHaveBeenCalledWith({
                where: { id: 'test-account-123' },
                data: { status: 'NEEDS_REAUTH' },
            });
        });
    });

    // =========================================================================
    // ERROR HANDLING TESTS - RATE LIMITING
    // =========================================================================
    describe('fetchNewToken - Rate Limiting', () => {
        it('should throw RATE_LIMITED error on 429', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                text: async () => 'Too many requests',
            });

            try {
                await service.fetchNewToken(mockShippingAccount);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DHLAuthError);
                expect((error as DHLAuthError).code).toBe('RATE_LIMITED');
                expect((error as DHLAuthError).statusCode).toBe(429);
            }
        });
    });

    // =========================================================================
    // ERROR HANDLING TESTS - SERVER ERRORS
    // =========================================================================
    describe('fetchNewToken - Server Errors', () => {
        it('should throw SERVER_ERROR on 500', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            });

            try {
                await service.fetchNewToken(mockShippingAccount);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DHLAuthError);
                expect((error as DHLAuthError).code).toBe('SERVER_ERROR');
                expect((error as DHLAuthError).statusCode).toBe(500);
            }
        });

        it('should throw SERVER_ERROR on 503', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 503,
                text: async () => 'Service Unavailable',
            });

            try {
                await service.fetchNewToken(mockShippingAccount);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DHLAuthError);
                expect((error as DHLAuthError).code).toBe('SERVER_ERROR');
            }
        });
    });

    // =========================================================================
    // ERROR HANDLING TESTS - NETWORK ERRORS
    // =========================================================================
    describe('fetchNewToken - Network Errors', () => {
        it('should throw NETWORK_ERROR on network failure', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            try {
                await service.fetchNewToken(mockShippingAccount);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DHLAuthError);
                expect((error as DHLAuthError).code).toBe('NETWORK_ERROR');
            }
        });

        it('should throw TIMEOUT on abort', async () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            mockFetch.mockRejectedValueOnce(abortError);

            try {
                await service.fetchNewToken(mockShippingAccount);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DHLAuthError);
                expect((error as DHLAuthError).code).toBe('TIMEOUT');
            }
        });
    });

    // =========================================================================
    // ERROR HANDLING TESTS - INVALID RESPONSES
    // =========================================================================
    describe('fetchNewToken - Invalid Responses', () => {
        it('should throw INVALID_RESPONSE on non-JSON response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => 'not valid json',
            });

            try {
                await service.fetchNewToken(mockShippingAccount);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DHLAuthError);
                expect((error as DHLAuthError).code).toBe('INVALID_RESPONSE');
            }
        });

        it('should throw EMPTY_TOKEN when access_token is missing', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ token_type: 'Bearer', expires_in: 3600 }),
            });

            try {
                await service.fetchNewToken(mockShippingAccount);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DHLAuthError);
                expect((error as DHLAuthError).code).toBe('EMPTY_TOKEN');
            }
        });

        it('should throw EMPTY_TOKEN when access_token is empty string', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ access_token: '', expires_in: 3600 }),
            });

            try {
                await service.fetchNewToken(mockShippingAccount);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DHLAuthError);
                expect((error as DHLAuthError).code).toBe('EMPTY_TOKEN');
            }
        });

        it('should default expires_in to 3600 when not provided', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ access_token: 'token' }),
            });

            await service.fetchNewToken(mockShippingAccount);

            // Should cache with TTL = 3600 - 300 = 3300
            expect(mockRedis.setex).toHaveBeenCalledWith(
                'dhl:token:test-account-123',
                3300,
                'token'
            );
        });
    });

    // =========================================================================
    // ERROR HANDLING TESTS - MISSING CREDENTIALS
    // =========================================================================
    describe('fetchNewToken - Missing Credentials', () => {
        it('should throw MISSING_CREDENTIALS when clientId is missing', async () => {
            const accountWithoutId: DHLShippingAccount = {
                ...mockShippingAccount,
                credentials: { clientSecret: 'secret' },
            };

            try {
                await service.fetchNewToken(accountWithoutId);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DHLAuthError);
                expect((error as DHLAuthError).code).toBe('MISSING_CREDENTIALS');
            }
        });

        it('should throw MISSING_CREDENTIALS when clientSecret is missing', async () => {
            const accountWithoutSecret: DHLShippingAccount = {
                ...mockShippingAccount,
                credentials: { clientId: 'id' },
            };

            try {
                await service.fetchNewToken(accountWithoutSecret);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DHLAuthError);
                expect((error as DHLAuthError).code).toBe('MISSING_CREDENTIALS');
            }
        });
    });

    // =========================================================================
    // CACHE TTL TESTS
    // =========================================================================
    describe('cacheToken', () => {
        it('should cache token with TTL = expires_in - 300', async () => {
            await service.cacheToken('account-123', 'token_value', 3600);

            expect(mockRedis.setex).toHaveBeenCalledWith(
                'dhl:token:account-123',
                3300, // 3600 - 300
                'token_value'
            );
        });

        it('should ensure minimum TTL of 60 seconds', async () => {
            await service.cacheToken('account-123', 'token_value', 200);

            expect(mockRedis.setex).toHaveBeenCalledWith(
                'dhl:token:account-123',
                60, // minimum TTL
                'token_value'
            );
        });

        it('should handle negative expires_in gracefully', async () => {
            await service.cacheToken('account-123', 'token_value', -100);

            expect(mockRedis.setex).toHaveBeenCalledWith(
                'dhl:token:account-123',
                60, // minimum TTL
                'token_value'
            );
        });

        it('should use correct cache key format', async () => {
            await service.cacheToken('my-account-456', 'token', 3600);

            expect(mockRedis.setex).toHaveBeenCalledWith(
                'dhl:token:my-account-456',
                expect.any(Number),
                expect.any(String)
            );
        });
    });

    // =========================================================================
    // TOKEN REUSE FROM CACHE TESTS
    // =========================================================================
    describe('getAccessToken', () => {
        it('should return cached token if available', async () => {
            mockRedis.get.mockResolvedValueOnce('cached_token_abc');

            const token = await service.getAccessToken(mockShippingAccount);

            expect(token).toBe('cached_token_abc');
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should fetch new token if cache is empty', async () => {
            mockRedis.get.mockResolvedValueOnce(null);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify(mockTokenResponse),
            });

            const token = await service.getAccessToken(mockShippingAccount);

            expect(token).toBe('mock_dhl_access_token_12345');
            expect(mockFetch).toHaveBeenCalled();
        });

        it('should cache the newly fetched token', async () => {
            mockRedis.get.mockResolvedValueOnce(null);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify(mockTokenResponse),
            });

            await service.getAccessToken(mockShippingAccount);

            expect(mockRedis.setex).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // STAMPEDE PROTECTION TESTS
    // =========================================================================
    describe('stampede protection', () => {
        it('should share token fetch for concurrent requests', async () => {
            mockRedis.get.mockResolvedValue(null);
            mockFetch.mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(mockTokenResponse),
            });

            // Make 3 concurrent requests
            const promises = [
                service.getAccessToken(mockShippingAccount),
                service.getAccessToken(mockShippingAccount),
                service.getAccessToken(mockShippingAccount),
            ];

            const tokens = await Promise.all(promises);

            // All should get the same token
            expect(tokens[0]).toBe(tokens[1]);
            expect(tokens[1]).toBe(tokens[2]);

            // Should be called fewer times due to stampede protection
            expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(2);
        });
    });

    // =========================================================================
    // 401 HANDLING TESTS
    // =========================================================================
    describe('handleUnauthorized', () => {
        it('should clear cached token', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify(mockTokenResponse),
            });

            await service.handleUnauthorized(mockShippingAccount);

            expect(mockRedis.del).toHaveBeenCalledWith('dhl:token:test-account-123');
        });

        it('should fetch and return new token', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ ...mockTokenResponse, access_token: 'new_token_xyz' }),
            });

            const newToken = await service.handleUnauthorized(mockShippingAccount);

            expect(newToken).toBe('new_token_xyz');
        });
    });

    // =========================================================================
    // CLEAR CACHE TESTS
    // =========================================================================
    describe('clearCachedToken', () => {
        it('should delete token from Redis', async () => {
            await service.clearCachedToken('account-789');

            expect(mockRedis.del).toHaveBeenCalledWith('dhl:token:account-789');
        });
    });

    // =========================================================================
    // CREDENTIAL DECRYPTION TESTS
    // =========================================================================
    describe('getDecryptedCredentials', () => {
        it('should return credentials as-is if not encrypted', () => {
            const result = service.getDecryptedCredentials(mockShippingAccount);

            expect(result.clientId).toBe('test_client_id');
            expect(result.clientSecret).toBe('test_client_secret');
        });

        it('should decrypt credentials if encrypted', () => {
            const encryptedAccount: DHLShippingAccount = {
                ...mockShippingAccount,
                credentials: {
                    clientId: 'AAAAAAAAAA==:BBBBBBBBBB==:encrypted_client_id',
                    clientSecret: 'AAAAAAAAAA==:BBBBBBBBBB==:encrypted_client_secret',
                },
            };

            service.getDecryptedCredentials(encryptedAccount);

            expect(encryptionService.decryptFromString).toHaveBeenCalledTimes(2);
        });

        it('should fall back to apiKey/secretKey if clientId/clientSecret not present', () => {
            const legacyAccount: DHLShippingAccount = {
                ...mockShippingAccount,
                credentials: {
                    apiKey: 'legacy_api_key',
                    secretKey: 'legacy_secret_key',
                },
            };

            const result = service.getDecryptedCredentials(legacyAccount);

            expect(result.clientId).toBe('legacy_api_key');
            expect(result.clientSecret).toBe('legacy_secret_key');
        });
    });

    // =========================================================================
    // CREDENTIAL ENCRYPTION TESTS
    // =========================================================================
    describe('encryptCredentials', () => {
        it('should encrypt clientId and clientSecret', () => {
            const result = service.encryptCredentials('my_client_id', 'my_client_secret');

            expect(result.encryptedClientId).toBe('encrypted:my_client_id');
            expect(result.encryptedClientSecret).toBe('encrypted:my_client_secret');
            expect(encryptionService.encryptToString).toHaveBeenCalledTimes(2);
        });
    });

    // =========================================================================
    // CREATE SHIPPING ACCOUNT TESTS
    // =========================================================================
    describe('createShippingAccountCredentials', () => {
        it('should create account with encrypted credentials', () => {
            const account = service.createShippingAccountCredentials(
                'client_id',
                'client_secret',
                'ACC123',
                true
            );

            expect(account.carrier).toBe('DHL');
            expect(account.accountNumber).toBe('ACC123');
            expect(account.testMode).toBe(true);
            expect(account.credentials.clientId).toBe('encrypted:client_id');
            expect(account.credentials.clientSecret).toBe('encrypted:client_secret');
            expect(account.status).toBe('ACTIVE');
        });

        it('should default testMode to true', () => {
            const account = service.createShippingAccountCredentials(
                'client_id',
                'client_secret',
                'ACC123'
            );

            expect(account.testMode).toBe(true);
        });
    });

    // =========================================================================
    // GET TOKEN FROM CACHE TESTS
    // =========================================================================
    describe('getTokenFromCache', () => {
        it('should return token from Redis', async () => {
            mockRedis.get.mockResolvedValueOnce('cached_token');

            const token = await service.getTokenFromCache('dhl:token:account');

            expect(token).toBe('cached_token');
        });

        it('should return null if token not in cache', async () => {
            mockRedis.get.mockResolvedValueOnce(null);

            const token = await service.getTokenFromCache('dhl:token:account');

            expect(token).toBeNull();
        });

        it('should return null on Redis error', async () => {
            mockRedis.get.mockRejectedValueOnce(new Error('Redis error'));

            const token = await service.getTokenFromCache('dhl:token:account');

            expect(token).toBeNull();
        });
    });

    // =========================================================================
    // CHECK ACCOUNT STATUS TESTS
    // =========================================================================
    describe('checkAccountStatus', () => {
        it('should return account status from database', async () => {
            prismaService.shippingAccount.findUnique = jest.fn().mockResolvedValueOnce({ status: 'NEEDS_REAUTH' });

            const status = await service.checkAccountStatus('account-123');

            expect(status).toBe('NEEDS_REAUTH');
        });

        it('should return null if account not found', async () => {
            prismaService.shippingAccount.findUnique = jest.fn().mockResolvedValueOnce(null);

            const status = await service.checkAccountStatus('account-123');

            expect(status).toBeNull();
        });

        it('should return null on database error', async () => {
            prismaService.shippingAccount.findUnique = jest.fn().mockRejectedValueOnce(new Error('DB error'));

            const status = await service.checkAccountStatus('account-123');

            expect(status).toBeNull();
        });
    });
});
