import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WooCommerceService } from './woocommerce.service';
import { WooCommerceOAuthService } from './woocommerce-oauth.service';
import { WooCommerceOAuthController } from './woocommerce-oauth.controller';
import { EncryptionModule } from '@common/encryption';
import { PrismaService } from '@common/database/prisma.service';

@Module({
  imports: [
    ConfigModule,
    EncryptionModule,
  ],
  controllers: [WooCommerceOAuthController],
  providers: [
    WooCommerceService,
    WooCommerceOAuthService,
    PrismaService,
  ],
  exports: [WooCommerceService, WooCommerceOAuthService],
})
export class WooCommerceModule { }
