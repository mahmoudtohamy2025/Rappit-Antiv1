import {
    parseAllowedOrigins,
    isLocalhostOrigin,
    isOriginAllowed,
    validateCorsConfig,
    corsOriginCallback,
} from '../../src/middleware/cors.middleware';

/**
 * CORS Middleware Unit Tests
 * Task: SEC-01 - Restrict CORS to Allowed Origins
 * 
 * Tests:
 * 1. CORS middleware allows configured origin
 * 2. CORS middleware rejects non-configured origin
 * 3. Multiple origins parsed correctly from env
 */

describe('CORS Middleware', () => {
    // Store original env
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset env before each test
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        // Restore original env
        process.env = originalEnv;
    });

    describe('parseAllowedOrigins', () => {
        it('should parse comma-separated origins correctly', () => {
            const origins = parseAllowedOrigins('https://app.rappit.com,https://admin.rappit.com');
            expect(origins).toEqual(['https://app.rappit.com', 'https://admin.rappit.com']);
        });

        it('should handle single origin', () => {
            const origins = parseAllowedOrigins('https://app.rappit.com');
            expect(origins).toEqual(['https://app.rappit.com']);
        });

        it('should trim whitespace from origins', () => {
            const origins = parseAllowedOrigins('  https://app.rappit.com , https://admin.rappit.com  ');
            expect(origins).toEqual(['https://app.rappit.com', 'https://admin.rappit.com']);
        });

        it('should return empty array for undefined input', () => {
            const origins = parseAllowedOrigins(undefined);
            expect(origins).toEqual([]);
        });

        it('should return empty array for empty string', () => {
            const origins = parseAllowedOrigins('');
            expect(origins).toEqual([]);
        });

        it('should return empty array for whitespace-only string', () => {
            const origins = parseAllowedOrigins('   ');
            expect(origins).toEqual([]);
        });

        it('should filter out empty entries from comma separation', () => {
            const origins = parseAllowedOrigins('https://app.rappit.com,,https://admin.rappit.com');
            expect(origins).toEqual(['https://app.rappit.com', 'https://admin.rappit.com']);
        });
    });

    describe('isLocalhostOrigin', () => {
        it('should match http://localhost', () => {
            expect(isLocalhostOrigin('http://localhost')).toBe(true);
        });

        it('should match http://localhost:3000', () => {
            expect(isLocalhostOrigin('http://localhost:3000')).toBe(true);
        });

        it('should match http://localhost:5173', () => {
            expect(isLocalhostOrigin('http://localhost:5173')).toBe(true);
        });

        it('should match http://127.0.0.1:3000', () => {
            expect(isLocalhostOrigin('http://127.0.0.1:3000')).toBe(true);
        });

        it('should match http://[::1]:3000', () => {
            expect(isLocalhostOrigin('http://[::1]:3000')).toBe(true);
        });

        it('should not match https://localhost (HTTPS)', () => {
            // Localhost typically uses HTTP
            expect(isLocalhostOrigin('https://localhost:3000')).toBe(false);
        });

        it('should not match production domain', () => {
            expect(isLocalhostOrigin('https://app.rappit.com')).toBe(false);
        });

        it('should not match random domain', () => {
            expect(isLocalhostOrigin('https://evil.com')).toBe(false);
        });
    });

    describe('isOriginAllowed', () => {
        const allowedOrigins = ['https://app.rappit.com', 'https://admin.rappit.com'];

        it('should return true for allowed origin', () => {
            expect(isOriginAllowed('https://app.rappit.com', allowedOrigins)).toBe(true);
        });

        it('should return true for second allowed origin', () => {
            expect(isOriginAllowed('https://admin.rappit.com', allowedOrigins)).toBe(true);
        });

        it('should return false for non-allowed origin', () => {
            expect(isOriginAllowed('https://evil.com', allowedOrigins)).toBe(false);
        });

        it('should return false for similar but different origin', () => {
            expect(isOriginAllowed('https://app.rappit.com.evil.com', allowedOrigins)).toBe(false);
        });

        it('should return false for empty allowed list', () => {
            expect(isOriginAllowed('https://app.rappit.com', [])).toBe(false);
        });

        it('should be case-sensitive', () => {
            expect(isOriginAllowed('HTTPS://APP.RAPPIT.COM', allowedOrigins)).toBe(false);
        });
    });

    describe('validateCorsConfig', () => {
        it('should pass in development without CORS_ORIGIN', () => {
            process.env.NODE_ENV = 'development';
            delete process.env.CORS_ORIGIN;

            expect(() => validateCorsConfig()).not.toThrow();
        });

        it('should pass in development with CORS_ORIGIN', () => {
            process.env.NODE_ENV = 'development';
            process.env.CORS_ORIGIN = 'https://app.rappit.com';

            expect(() => validateCorsConfig()).not.toThrow();
        });

        it('should throw in production without CORS_ORIGIN', () => {
            process.env.NODE_ENV = 'production';
            delete process.env.CORS_ORIGIN;

            expect(() => validateCorsConfig()).toThrow('CORS_ORIGIN environment variable is required in production');
        });

        it('should throw in production with empty CORS_ORIGIN', () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = '';

            expect(() => validateCorsConfig()).toThrow('CORS_ORIGIN environment variable is required in production');
        });

        it('should throw in production with whitespace-only CORS_ORIGIN', () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = '   ';

            expect(() => validateCorsConfig()).toThrow('CORS_ORIGIN environment variable is required in production');
        });

        it('should pass in production with valid CORS_ORIGIN', () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = 'https://app.rappit.com';

            expect(() => validateCorsConfig()).not.toThrow();
        });
    });

    describe('corsOriginCallback', () => {
        describe('production mode', () => {
            beforeEach(() => {
                process.env.NODE_ENV = 'production';
                process.env.CORS_ORIGIN = 'https://app.rappit.com,https://admin.rappit.com';
            });

            it('should allow configured origin', (done) => {
                corsOriginCallback('https://app.rappit.com', (error, allowed) => {
                    expect(error).toBeNull();
                    expect(allowed).toBe(true);
                    done();
                });
            });

            it('should allow second configured origin', (done) => {
                corsOriginCallback('https://admin.rappit.com', (error, allowed) => {
                    expect(error).toBeNull();
                    expect(allowed).toBe(true);
                    done();
                });
            });

            it('should reject non-configured origin', (done) => {
                corsOriginCallback('https://evil.com', (error, allowed) => {
                    expect(error).toBeInstanceOf(Error);
                    expect(error?.message).toBe('CORS origin not allowed');
                    expect(allowed).toBe(false);
                    done();
                });
            });

            it('should reject localhost in production', (done) => {
                corsOriginCallback('http://localhost:3000', (error, allowed) => {
                    expect(error).toBeInstanceOf(Error);
                    expect(allowed).toBe(false);
                    done();
                });
            });

            it('should allow request with no origin header', (done) => {
                corsOriginCallback(undefined, (error, allowed) => {
                    expect(error).toBeNull();
                    expect(allowed).toBe(true);
                    done();
                });
            });
        });

        describe('development mode', () => {
            beforeEach(() => {
                process.env.NODE_ENV = 'development';
                process.env.CORS_ORIGIN = 'https://app.rappit.com';
            });

            it('should allow configured origin', (done) => {
                corsOriginCallback('https://app.rappit.com', (error, allowed) => {
                    expect(error).toBeNull();
                    expect(allowed).toBe(true);
                    done();
                });
            });

            it('should allow localhost in development', (done) => {
                corsOriginCallback('http://localhost:3000', (error, allowed) => {
                    expect(error).toBeNull();
                    expect(allowed).toBe(true);
                    done();
                });
            });

            it('should allow localhost:5173 (Vite default)', (done) => {
                corsOriginCallback('http://localhost:5173', (error, allowed) => {
                    expect(error).toBeNull();
                    expect(allowed).toBe(true);
                    done();
                });
            });

            it('should allow 127.0.0.1', (done) => {
                corsOriginCallback('http://127.0.0.1:3000', (error, allowed) => {
                    expect(error).toBeNull();
                    expect(allowed).toBe(true);
                    done();
                });
            });

            it('should reject random external origin', (done) => {
                corsOriginCallback('https://evil.com', (error, allowed) => {
                    expect(error).toBeInstanceOf(Error);
                    expect(allowed).toBe(false);
                    done();
                });
            });
        });
    });
});
