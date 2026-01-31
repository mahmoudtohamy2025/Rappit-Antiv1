/**
 * EncryptionService Unit Tests (OAUTH-01)
 * 
 * Tests AES-256-GCM encryption:
 * - Encryption produces different output each time (unique IV)
 * - Decryption returns original plaintext
 * - Wrong key fails decryption with clear error
 * - Tampered ciphertext fails authentication
 * - Missing encryption key fails startup
 * - Invalid key format fails startup
 */

import { ConfigService } from '@nestjs/config';
import {
    EncryptionService,
    EncryptionError,
    DecryptionError
} from '../../src/common/encryption/encryption.service';

describe('EncryptionService', () => {
    // Valid 256-bit key (64 hex characters)
    const validKey = 'a'.repeat(64);
    const anotherValidKey = 'b'.repeat(64);

    let service: EncryptionService;
    let mockConfigService: Partial<ConfigService>;

    describe('Initialization', () => {
        it('should fail startup if CREDENTIALS_ENCRYPTION_KEY is missing', () => {
            mockConfigService = {
                get: jest.fn().mockReturnValue(undefined),
            };

            service = new EncryptionService(mockConfigService as ConfigService);

            expect(() => service.onModuleInit()).toThrow(EncryptionError);
            expect(() => service.onModuleInit()).toThrow(
                'CREDENTIALS_ENCRYPTION_KEY environment variable is required'
            );
        });

        it('should fail startup if key format is invalid (too short)', () => {
            mockConfigService = {
                get: jest.fn().mockReturnValue('abc123'), // Too short
            };

            service = new EncryptionService(mockConfigService as ConfigService);

            expect(() => service.onModuleInit()).toThrow(EncryptionError);
            expect(() => service.onModuleInit()).toThrow(
                'must be a 64-character hex string'
            );
        });

        it('should fail startup if key contains non-hex characters', () => {
            mockConfigService = {
                get: jest.fn().mockReturnValue('g'.repeat(64)), // 'g' is not hex
            };

            service = new EncryptionService(mockConfigService as ConfigService);

            expect(() => service.onModuleInit()).toThrow(EncryptionError);
        });

        it('should initialize successfully with valid key', () => {
            mockConfigService = {
                get: jest.fn().mockReturnValue(validKey),
            };

            service = new EncryptionService(mockConfigService as ConfigService);

            expect(() => service.onModuleInit()).not.toThrow();
            expect(service.isConfigured()).toBe(true);
        });
    });

    describe('Encryption', () => {
        beforeEach(() => {
            mockConfigService = {
                get: jest.fn().mockReturnValue(validKey),
            };
            service = new EncryptionService(mockConfigService as ConfigService);
            service.onModuleInit();
        });

        it('should produce different output each time (unique IV)', () => {
            const plaintext = 'my secret token';

            const result1 = service.encrypt(plaintext);
            const result2 = service.encrypt(plaintext);

            // Ciphertext should be different due to unique IV
            expect(result1.ciphertext).not.toBe(result2.ciphertext);
            expect(result1.iv).not.toBe(result2.iv);
            expect(result1.tag).not.toBe(result2.tag);
        });

        it('should return base64-encoded output', () => {
            const plaintext = 'test';
            const result = service.encrypt(plaintext);

            // All outputs should be valid base64
            expect(Buffer.from(result.ciphertext, 'base64').toString('base64')).toBe(result.ciphertext);
            expect(Buffer.from(result.iv, 'base64').toString('base64')).toBe(result.iv);
            expect(Buffer.from(result.tag, 'base64').toString('base64')).toBe(result.tag);
        });

        it('should generate correct IV length (12 bytes)', () => {
            const result = service.encrypt('test');
            const ivBuffer = Buffer.from(result.iv, 'base64');

            expect(ivBuffer.length).toBe(12);
        });

        it('should generate correct tag length (16 bytes)', () => {
            const result = service.encrypt('test');
            const tagBuffer = Buffer.from(result.tag, 'base64');

            expect(tagBuffer.length).toBe(16);
        });
    });

    describe('Decryption', () => {
        beforeEach(() => {
            mockConfigService = {
                get: jest.fn().mockReturnValue(validKey),
            };
            service = new EncryptionService(mockConfigService as ConfigService);
            service.onModuleInit();
        });

        it('should return original plaintext', () => {
            const plaintext = 'sk_live_1234567890abcdef';

            const encrypted = service.encrypt(plaintext);
            const decrypted = service.decrypt(
                encrypted.ciphertext,
                encrypted.iv,
                encrypted.tag
            );

            expect(decrypted).toBe(plaintext);
        });

        it('should handle unicode characters', () => {
            const plaintext = 'مفتاح سري 🔐';

            const encrypted = service.encrypt(plaintext);
            const decrypted = service.decrypt(
                encrypted.ciphertext,
                encrypted.iv,
                encrypted.tag
            );

            expect(decrypted).toBe(plaintext);
        });

        it('should handle empty string', () => {
            const plaintext = '';

            const encrypted = service.encrypt(plaintext);
            const decrypted = service.decrypt(
                encrypted.ciphertext,
                encrypted.iv,
                encrypted.tag
            );

            expect(decrypted).toBe(plaintext);
        });

        it('should handle long strings', () => {
            const plaintext = 'a'.repeat(10000);

            const encrypted = service.encrypt(plaintext);
            const decrypted = service.decrypt(
                encrypted.ciphertext,
                encrypted.iv,
                encrypted.tag
            );

            expect(decrypted).toBe(plaintext);
        });
    });

    describe('Wrong Key', () => {
        it('should fail decryption with wrong key and clear error', () => {
            // Encrypt with first key
            mockConfigService = {
                get: jest.fn().mockReturnValue(validKey),
            };
            const service1 = new EncryptionService(mockConfigService as ConfigService);
            service1.onModuleInit();

            const encrypted = service1.encrypt('secret');

            // Try to decrypt with different key
            mockConfigService = {
                get: jest.fn().mockReturnValue(anotherValidKey),
            };
            const service2 = new EncryptionService(mockConfigService as ConfigService);
            service2.onModuleInit();

            expect(() =>
                service2.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.tag)
            ).toThrow(DecryptionError);
        });
    });

    describe('Tampered Data', () => {
        beforeEach(() => {
            mockConfigService = {
                get: jest.fn().mockReturnValue(validKey),
            };
            service = new EncryptionService(mockConfigService as ConfigService);
            service.onModuleInit();
        });

        it('should fail authentication with tampered ciphertext', () => {
            const encrypted = service.encrypt('secret');

            // Tamper with ciphertext
            const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64');
            tamperedCiphertext[0] ^= 0xff; // Flip bits

            expect(() =>
                service.decrypt(
                    tamperedCiphertext.toString('base64'),
                    encrypted.iv,
                    encrypted.tag
                )
            ).toThrow(DecryptionError);
        });

        it('should fail authentication with tampered IV', () => {
            const encrypted = service.encrypt('secret');

            // Tamper with IV
            const tamperedIv = Buffer.from(encrypted.iv, 'base64');
            tamperedIv[0] ^= 0xff;

            expect(() =>
                service.decrypt(
                    encrypted.ciphertext,
                    tamperedIv.toString('base64'),
                    encrypted.tag
                )
            ).toThrow(DecryptionError);
        });

        it('should fail authentication with tampered tag', () => {
            const encrypted = service.encrypt('secret');

            // Tamper with tag
            const tamperedTag = Buffer.from(encrypted.tag, 'base64');
            tamperedTag[0] ^= 0xff;

            expect(() =>
                service.decrypt(
                    encrypted.ciphertext,
                    encrypted.iv,
                    tamperedTag.toString('base64')
                )
            ).toThrow(DecryptionError);
        });
    });

    describe('String Format Helpers', () => {
        beforeEach(() => {
            mockConfigService = {
                get: jest.fn().mockReturnValue(validKey),
            };
            service = new EncryptionService(mockConfigService as ConfigService);
            service.onModuleInit();
        });

        it('should encrypt and decrypt using string format', () => {
            const plaintext = 'oauth_token_12345';

            const encryptedString = service.encryptToString(plaintext);
            const decrypted = service.decryptFromString(encryptedString);

            expect(decrypted).toBe(plaintext);
        });

        it('should produce string with correct format (iv:tag:ciphertext)', () => {
            const encryptedString = service.encryptToString('test');
            const parts = encryptedString.split(':');

            expect(parts.length).toBe(3);
        });

        it('should fail with invalid string format', () => {
            expect(() => service.decryptFromString('invalid')).toThrow(DecryptionError);
            expect(() => service.decryptFromString('a:b')).toThrow(DecryptionError);
        });
    });
});
