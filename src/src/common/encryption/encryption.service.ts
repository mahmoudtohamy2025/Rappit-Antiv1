/**
 * Encryption Service (OAUTH-01)
 * 
 * AES-256-GCM encryption for OAuth tokens and API credentials.
 * 
 * Specification:
 * - Algorithm: AES-256-GCM (FIPS 140-2 validated)
 * - Key: 32 bytes from CREDENTIALS_ENCRYPTION_KEY env var
 * - IV: Unique 12 bytes (96 bits) per encryption
 * - Auth Tag: 16 bytes (128 bits)
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface EncryptedData {
    /** Base64-encoded ciphertext */
    ciphertext: string;
    /** Base64-encoded initialization vector (12 bytes) */
    iv: string;
    /** Base64-encoded authentication tag (16 bytes) */
    tag: string;
}

export class EncryptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EncryptionError';
    }
}

export class DecryptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DecryptionError';
    }
}

@Injectable()
export class EncryptionService implements OnModuleInit {
    private readonly logger = new Logger(EncryptionService.name);
    private encryptionKey: Buffer | null = null;

    // AES-256-GCM constants
    private static readonly ALGORITHM = 'aes-256-gcm';
    private static readonly IV_LENGTH = 12; // 96 bits recommended for GCM
    private static readonly TAG_LENGTH = 16; // 128 bits
    private static readonly KEY_LENGTH = 32; // 256 bits

    constructor(private readonly configService: ConfigService) { }

    /**
     * Validate encryption key on module initialization.
     * Fails startup if key is missing or invalid.
     */
    onModuleInit(): void {
        const keyHex = this.configService.get<string>('CREDENTIALS_ENCRYPTION_KEY');

        if (!keyHex) {
            const error = 'CREDENTIALS_ENCRYPTION_KEY environment variable is required for secure credential storage';
            this.logger.error(error);
            throw new EncryptionError(error);
        }

        // Validate key format (must be 64 hex characters = 32 bytes)
        if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
            const error = 'CREDENTIALS_ENCRYPTION_KEY must be a 64-character hex string (256 bits)';
            this.logger.error(error);
            throw new EncryptionError(error);
        }

        this.encryptionKey = Buffer.from(keyHex, 'hex');
        this.logger.log('Encryption service initialized with AES-256-GCM');
    }

    /**
     * Check if encryption service is properly configured
     */
    isConfigured(): boolean {
        return this.encryptionKey !== null;
    }

    /**
     * Encrypt plaintext using AES-256-GCM.
     * 
     * Each encryption uses a unique random IV, ensuring the same plaintext
     * produces different ciphertext each time.
     * 
     * @param plaintext - The string to encrypt
     * @returns Object containing base64-encoded ciphertext, iv, and tag
     * @throws EncryptionError if encryption key is not configured
     */
    encrypt(plaintext: string): EncryptedData {
        if (!this.encryptionKey) {
            throw new EncryptionError('Encryption key not configured');
        }

        // Generate unique random IV for each encryption
        const iv = crypto.randomBytes(EncryptionService.IV_LENGTH);

        // Create cipher with AES-256-GCM
        const cipher = crypto.createCipheriv(
            EncryptionService.ALGORITHM,
            this.encryptionKey,
            iv,
            { authTagLength: EncryptionService.TAG_LENGTH }
        );

        // Encrypt the plaintext
        let encrypted = cipher.update(plaintext, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        // Get the authentication tag
        const tag = cipher.getAuthTag();

        return {
            ciphertext: encrypted.toString('base64'),
            iv: iv.toString('base64'),
            tag: tag.toString('base64'),
        };
    }

    /**
     * Decrypt ciphertext using AES-256-GCM.
     * 
     * Verifies the authentication tag to ensure data integrity.
     * 
     * @param ciphertext - Base64-encoded ciphertext
     * @param iv - Base64-encoded initialization vector
     * @param tag - Base64-encoded authentication tag
     * @returns Original plaintext
     * @throws DecryptionError if decryption fails (wrong key, tampered data, etc.)
     */
    decrypt(ciphertext: string, iv: string, tag: string): string {
        if (!this.encryptionKey) {
            throw new DecryptionError('Encryption key not configured');
        }

        try {
            const encryptedBuffer = Buffer.from(ciphertext, 'base64');
            const ivBuffer = Buffer.from(iv, 'base64');
            const tagBuffer = Buffer.from(tag, 'base64');

            // Validate IV length
            if (ivBuffer.length !== EncryptionService.IV_LENGTH) {
                throw new DecryptionError('Invalid IV length');
            }

            // Validate tag length
            if (tagBuffer.length !== EncryptionService.TAG_LENGTH) {
                throw new DecryptionError('Invalid authentication tag length');
            }

            // Create decipher with AES-256-GCM
            const decipher = crypto.createDecipheriv(
                EncryptionService.ALGORITHM,
                this.encryptionKey,
                ivBuffer,
                { authTagLength: EncryptionService.TAG_LENGTH }
            );

            // Set the authentication tag for verification
            decipher.setAuthTag(tagBuffer);

            // Decrypt the ciphertext
            let decrypted = decipher.update(encryptedBuffer);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            return decrypted.toString('utf8');
        } catch (error: any) {
            // GCM authentication failures throw generic errors
            if (error.message?.includes('Unsupported state') ||
                error.message?.includes('unable to authenticate')) {
                throw new DecryptionError('Authentication failed: ciphertext may be tampered or wrong key');
            }
            if (error instanceof DecryptionError) {
                throw error;
            }
            throw new DecryptionError(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Encrypt and encode as a single string for database storage.
     * Format: iv:tag:ciphertext (all base64)
     */
    encryptToString(plaintext: string): string {
        const { ciphertext, iv, tag } = this.encrypt(plaintext);
        return `${iv}:${tag}:${ciphertext}`;
    }

    /**
     * Decrypt from the single-string format.
     */
    decryptFromString(encryptedString: string): string {
        const parts = encryptedString.split(':');
        if (parts.length !== 3) {
            throw new DecryptionError('Invalid encrypted string format');
        }
        const [iv, tag, ciphertext] = parts;
        return this.decrypt(ciphertext, iv, tag);
    }
}
