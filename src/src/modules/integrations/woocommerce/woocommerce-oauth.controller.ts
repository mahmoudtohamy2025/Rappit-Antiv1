/**
 * WooCommerce OAuth Controller (OAUTH-03)
 * 
 * Endpoints for WooCommerce REST API auto-authorization flow:
 * - POST /initiate - Validate URL and get authorization URL
 * - POST /callback - Receive credentials from WooCommerce
 */

import {
    Controller,
    Post,
    Get,
    Body,
    Query,
    Res,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WooCommerceOAuthService, WooCommerceCallbackPayload } from './woocommerce-oauth.service';
import { Public } from '@common/decorators/public.decorator';

// DTO for initiate request
class InitiateOAuthDto {
    storeUrl: string;
    organizationId?: string;
}

@ApiTags('WooCommerce OAuth')
@Controller('oauth/woocommerce')
export class WooCommerceOAuthController {
    private readonly logger = new Logger(WooCommerceOAuthController.name);

    constructor(private readonly wooCommerceOAuthService: WooCommerceOAuthService) { }

    /**
     * Initiate WooCommerce OAuth flow
     * Validates the store URL and returns the authorization URL
     */
    @Post('initiate')
    @Public() // Allow without auth for testing
    @ApiOperation({ summary: 'Initiate WooCommerce OAuth flow' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                storeUrl: { type: 'string', example: 'https://mystore.com' },
                organizationId: { type: 'string', example: 'org-123' },
            },
            required: ['storeUrl'],
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Returns authorization URL',
        schema: {
            type: 'object',
            properties: {
                authUrl: { type: 'string' },
                storeUrl: { type: 'string' },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid or unreachable store URL' })
    async initiate(@Body() dto: InitiateOAuthDto) {
        if (!dto.storeUrl) {
            throw new BadRequestException('Store URL is required');
        }

        // Use provided organizationId or a test one
        const organizationId = dto.organizationId || 'test-org-woocommerce';

        this.logger.log(`Initiating WooCommerce OAuth for store: ${dto.storeUrl}`);

        const result = await this.wooCommerceOAuthService.initiateOAuth(
            dto.storeUrl,
            organizationId,
        );

        return result;
    }

    /**
     * Handle WooCommerce OAuth callback
     * WooCommerce POSTs the consumer_key and consumer_secret here
     * 
     * Note: This is called directly by WooCommerce, not the user's browser
     */
    @Post('callback')
    @Public() // Must be public - called by WooCommerce server
    @ApiOperation({ summary: 'Handle WooCommerce OAuth callback (called by WooCommerce)' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                key_id: { type: 'number' },
                user_id: { type: 'string' },
                consumer_key: { type: 'string' },
                consumer_secret: { type: 'string' },
                key_permissions: { type: 'string' },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Credentials received successfully' })
    @ApiResponse({ status: 400, description: 'Invalid callback payload' })
    async callback(@Body() payload: WooCommerceCallbackPayload & { user_id: string }) {
        this.logger.log(`Received WooCommerce callback for user_id: ${payload.user_id}`);

        // Validate required fields
        if (!payload.consumer_key || !payload.consumer_secret) {
            throw new BadRequestException('Missing consumer credentials in callback');
        }

        if (!payload.user_id) {
            throw new BadRequestException('Missing user_id in callback');
        }

        const result = await this.wooCommerceOAuthService.handleCallback(
            payload,
            payload.user_id,
        );

        // WooCommerce expects a 200 response
        return {
            success: true,
            ...result,
        };
    }

    /**
     * Check OAuth status for a state
     * Called by frontend after user returns from WooCommerce
     */
    @Get('status')
    @Public()
    @ApiOperation({ summary: 'Check OAuth completion status' })
    @ApiQuery({ name: 'state', required: true })
    @ApiResponse({ status: 200, description: 'OAuth status' })
    async status(@Query('state') state: string) {
        // In a real implementation, you'd check if the callback was received
        // For now, just return a placeholder
        return {
            state,
            complete: false, // Would check database/cache
            message: 'Waiting for WooCommerce callback',
        };
    }

    /**
     * Test endpoint to validate store URL without starting OAuth
     */
    @Post('validate')
    @Public()
    @ApiOperation({ summary: 'Validate WooCommerce store URL' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                storeUrl: { type: 'string', example: 'https://mystore.com' },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'URL validation result' })
    async validate(@Body() dto: { storeUrl: string }) {
        const urlValidation = this.wooCommerceOAuthService.validateStoreUrl(dto.storeUrl);

        if (!urlValidation.valid) {
            return {
                valid: false,
                error: urlValidation.error,
            };
        }

        const reachability = await this.wooCommerceOAuthService.checkStoreReachable(
            urlValidation.normalizedUrl!
        );

        return {
            valid: reachability.reachable,
            normalizedUrl: urlValidation.normalizedUrl,
            error: reachability.error,
        };
    }
}
