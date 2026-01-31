/**
 * Shopify OAuth Controller (OAUTH-02)
 * 
 * Endpoints for Shopify OAuth 2.0 flow:
 * - GET /authorize - Initiate OAuth, redirect to Shopify
 * - GET /callback - Handle callback from Shopify
 */

import {
    Controller,
    Get,
    Query,
    Res,
    Req,
    BadRequestException,
    UseGuards,
    Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ShopifyOAuthService } from './shopify-oauth.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { OrganizationId } from '@common/decorators/organization.decorator';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Shopify OAuth')
@Controller('oauth/shopify')
export class ShopifyOAuthController {
    private readonly logger = new Logger(ShopifyOAuthController.name);

    constructor(private readonly shopifyOAuthService: ShopifyOAuthService) { }

    /**
     * Initiate Shopify OAuth flow
     * Redirects user to Shopify authorization page
     * 
     * TODO: Re-enable JwtAuthGuard after testing
     */
    @Get('authorize')
    @Public() // Bypass global JwtAuthGuard for OAuth flow
    // @UseGuards(JwtAuthGuard) // TEMPORARILY DISABLED FOR TESTING
    @ApiOperation({ summary: 'Initiate Shopify OAuth flow' })
    @ApiQuery({ name: 'shop', description: 'Shopify store domain (e.g., mystore.myshopify.com)' })
    @ApiResponse({ status: 302, description: 'Redirect to Shopify' })
    @ApiResponse({ status: 400, description: 'Invalid shop domain' })
    async authorize(
        @Query('shop') shop: string,
        @Query('org') organizationId: string, // Use query param instead of decorator for testing
        @Res() res: Response,
    ): Promise<void> {
        if (!shop) {
            throw new BadRequestException('Shop domain is required');
        }

        // Use test org if not provided
        const orgId = organizationId || 'test-org-oauth-demo';

        this.logger.log(`Initiating OAuth for shop: ${shop}, org: ${orgId}`);

        const authUrl = await this.shopifyOAuthService.generateAuthUrl(
            shop,
            orgId,
        );

        res.redirect(authUrl);
    }

    /**
     * Handle OAuth callback from Shopify
     * 
     * Shopify redirects here after user approves/denies
     */
    @Get('callback')
    @Public() // Bypass global JwtAuthGuard - callback comes from Shopify
    @ApiOperation({ summary: 'Handle Shopify OAuth callback' })
    @ApiQuery({ name: 'shop', required: true })
    @ApiQuery({ name: 'code', required: false })
    @ApiQuery({ name: 'state', required: true })
    @ApiQuery({ name: 'error', required: false })
    @ApiResponse({ status: 200, description: 'OAuth successful' })
    @ApiResponse({ status: 400, description: 'OAuth failed' })
    async callback(
        @Query('shop') shop: string,
        @Query('code') code: string,
        @Query('state') state: string,
        @Query('error') error: string,
        @Query('error_description') errorDescription: string,
        @Res() res: Response,
    ): Promise<void> {
        this.logger.log(`OAuth callback for shop: ${shop}`);

        // Handle user denial
        if (error === 'access_denied') {
            this.logger.warn(`User denied access for shop: ${shop}`);
            res.redirect('/settings/channels?error=access_denied');
            return;
        }

        // Validate required parameters
        if (!shop || !code || !state) {
            throw new BadRequestException('Missing required parameters');
        }

        try {
            const result = await this.shopifyOAuthService.handleCallback(
                shop,
                code,
                state,
            );

            this.logger.log(`OAuth successful for shop: ${shop}, channel: ${result.channelId}`);

            // Redirect to success page
            res.redirect(`/settings/channels?success=true&channel=${result.channelId}`);
        } catch (error: any) {
            this.logger.error(`OAuth callback error: ${error.message}`);

            // Redirect to error page with message
            const errorMsg = encodeURIComponent(error.message || 'OAuth failed');
            res.redirect(`/settings/channels?error=${errorMsg}`);
        }
    }

    /**
     * Health check for OAuth configuration
     */
    @Get('status')
    @ApiOperation({ summary: 'Check OAuth configuration status' })
    async status(): Promise<{ configured: boolean }> {
        try {
            // Try to get credentials - will throw if not configured
            const authUrl = await this.shopifyOAuthService.generateAuthUrl(
                'test.myshopify.com',
                'test-org',
            );
            return { configured: true };
        } catch {
            return { configured: false };
        }
    }
}
