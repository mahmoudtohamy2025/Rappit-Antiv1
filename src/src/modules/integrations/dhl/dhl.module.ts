import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DhlService } from './dhl.service';
import { DHLOAuthService } from './dhl-oauth.service';
import { DHLOAuthTestController } from './dhl-oauth-test.controller';
import { PrismaService } from '@common/database/prisma.service';
import { EncryptionModule } from '@common/encryption';

/**
 * DHL Module
 * 
 * Provides DHL shipping integration with:
 * - DhlService: High-level API for shipments
 * - DHLOAuthService: OAuth 2.0 token management with Redis caching
 * - DHLOAuthTestController: Test endpoints for OAuth verification
 */
@Module({
  imports: [
    ConfigModule,
    EncryptionModule,
  ],
  controllers: [
    DHLOAuthTestController,
  ],
  providers: [
    DhlService,
    DHLOAuthService,
    PrismaService,
  ],
  exports: [DhlService, DHLOAuthService],
})
export class DhlModule { }

