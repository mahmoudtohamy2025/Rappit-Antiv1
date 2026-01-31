import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ShopifyService } from './shopify.service';
import { ShopifyOAuthService } from './shopify-oauth.service';
import { ShopifyOAuthController } from './shopify-oauth.controller';
import { ShopifyIntegrationService } from '../../../integrations/shopify/shopify-integration.service';
import { ShopifyClient } from '../../../integrations/shopify/shopify-client';
import { ShopifyWebhookController } from '../../../integrations/shopify/shopify-webhook.controller';
import { ShopifySyncScheduler } from '../../../integrations/shopify/shopify-sync.scheduler';
import { DatabaseModule } from '../../../common/database/database.module';
import { EncryptionModule } from '../../../common/encryption/encryption.module';
import { IntegrationLoggingService } from '../../../services/integration-logging.service';
import { OrdersModule } from '../../orders/orders.module';

@Module({
  imports: [DatabaseModule, OrdersModule, ConfigModule, EncryptionModule],
  controllers: [ShopifyWebhookController, ShopifyOAuthController],
  providers: [
    ShopifyService,
    ShopifyOAuthService,
    ShopifyIntegrationService,
    ShopifyClient,
    ShopifySyncScheduler,
    IntegrationLoggingService,
  ],
  exports: [
    ShopifyService,
    ShopifyOAuthService,
    ShopifyIntegrationService,
    ShopifyClient,
  ],
})
export class ShopifyModule { }

