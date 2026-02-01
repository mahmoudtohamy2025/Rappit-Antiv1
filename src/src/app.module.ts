import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';

// Common
import { DatabaseModule } from './common/database/database.module';
import { HealthModule } from './common/health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RateLimitModule } from './common/rate-limit';
import { MetricsModule } from './common/metrics/metrics.module';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { OrdersModule } from './modules/orders/orders.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { JobsModule } from './modules/jobs/jobs.module';

// Integrations
import { ShopifyModule } from './modules/integrations/shopify/shopify.module';
import { WooCommerceModule } from './modules/integrations/woocommerce/woocommerce.module';
import { DhlModule } from './modules/integrations/dhl/dhl.module';
import { FedexModule } from './modules/integrations/fedex/fedex.module';

// Billing (BILL-02)
import { BillingModule } from './modules/billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, databaseConfig, redisConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    RateLimitModule,
    MetricsModule,
    HealthModule,
    JobsModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ChannelsModule,
    OrdersModule,
    InventoryModule,
    ShippingModule,
    WebhooksModule,
    ShopifyModule,
    WooCommerceModule,
    DhlModule,
    FedexModule,
    BillingModule,
  ],
  providers: [
    // Apply JwtAuthGuard globally to all routes (except @Public())
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Apply RolesGuard globally (only enforced when @Roles() is used)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule { }