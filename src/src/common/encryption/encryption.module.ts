/**
 * Encryption Module (OAUTH-01)
 * 
 * Provides AES-256-GCM encryption for OAuth tokens and API credentials.
 * 
 * Required environment variable:
 * - CREDENTIALS_ENCRYPTION_KEY: 64-character hex string (256 bits)
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [EncryptionService],
    exports: [EncryptionService],
})
export class EncryptionModule { }
