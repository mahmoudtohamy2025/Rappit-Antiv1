import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FedexService } from './fedex.service';
import { FedExOAuthService } from './fedex-oauth.service';
import { FedExOAuthTestController } from './fedex-oauth-test.controller';
import { FedExIntegrationService } from '@integrations/shipping/fedex-integration.service';
import { IntegrationLoggingService } from '@services/integration-logging.service';
import { PrismaService } from '@common/database/prisma.service';
import { EncryptionModule } from '@common/encryption';

/**
 * FedEx Module
 * 
 * Provides FedEx shipping integration with:
 * - FedexService: High-level API for shipments
 * - FedExOAuthService: OAuth 2.0 token management with Redis caching
 * - FedExOAuthTestController: Test endpoints for OAuth verification
 * - FedExIntegrationService: Low-level API integration
 */
@Module({
  imports: [
    ConfigModule,
    EncryptionModule,
  ],
  controllers: [
    FedExOAuthTestController,
  ],
  providers: [
    FedexService,
    FedExOAuthService,
    FedExIntegrationService,
    IntegrationLoggingService,
    PrismaService,
  ],
  exports: [FedexService, FedExOAuthService, FedExIntegrationService],
})
export class FedexModule { }

