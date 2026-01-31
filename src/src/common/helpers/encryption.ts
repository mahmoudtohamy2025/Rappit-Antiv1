/**
 * Encryption Helpers
 * 
 * Simple utility functions for encrypting/decrypting credentials.
 * Uses AES-256-GCM for secure encryption.
 */

import * as crypto from 'crypto';

// AES-256-GCM constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment
 * Falls back to a derived key for development
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.CREDENTIALS_ENCRYPTION_KEY;

  if (keyHex && /^[a-fA-F0-9]{64}$/.test(keyHex)) {
    return Buffer.from(keyHex, 'hex');
  }

  // Development fallback - derive key from a constant
  // DO NOT USE IN PRODUCTION
  if (process.env.NODE_ENV !== 'production') {
    return crypto
      .createHash('sha256')
      .update('rappit-dev-encryption-key')
      .digest();
  }

  throw new Error('CREDENTIALS_ENCRYPTION_KEY environment variable is required for secure credential storage');
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * 
 * Returns a string in format: iv:tag:ciphertext (all base64 encoded)
 * 
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format iv:tag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();

  // Generate unique random IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher with AES-256-GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // Get the authentication tag
  const tag = cipher.getAuthTag();

  // Return as single string: iv:tag:ciphertext
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * 
 * @param encryptedString - String in format iv:tag:ciphertext (all base64)
 * @returns Original plaintext
 * @throws Error if decryption fails
 */
export function decrypt(encryptedString: string): string {
  const key = getEncryptionKey();

  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format');
  }

  const [ivBase64, tagBase64, ciphertextBase64] = parts;

  const iv = Buffer.from(ivBase64, 'base64');
  const tag = Buffer.from(tagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  // Validate lengths
  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }

  if (tag.length !== TAG_LENGTH) {
    throw new Error('Invalid authentication tag length');
  }

  // Create decipher with AES-256-GCM
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  // Set the authentication tag
  decipher.setAuthTag(tag);

  // Decrypt
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}
