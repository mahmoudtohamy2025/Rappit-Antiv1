/**
 * DHL OAuth Test Controller
 * 
 * Provides endpoints to test DHL OAuth integration.
 * Development/testing only.
 */

import { Controller, Get, Post, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '@common/decorators/public.decorator';
import { DHLOAuthService, DHLShippingAccount } from './dhl-oauth.service';
import { EncryptionService } from '@common/encryption';

@Controller('test/dhl')
export class DHLOAuthTestController {
    private readonly logger = new Logger(DHLOAuthTestController.name);

    constructor(
        private readonly dhlOAuthService: DHLOAuthService,
        private readonly configService: ConfigService,
        private readonly encryptionService: EncryptionService,
    ) { }

    /**
     * Test DHL OAuth token retrieval
     * GET /api/v1/test/dhl/token
     */
    @Get('token')
    @Public()
    async testGetToken() {
        this.logger.log('Testing DHL OAuth token retrieval...');

        try {
            const clientId = this.configService.get<string>('DHL_CLIENT_ID') ||
                this.configService.get<string>('DHL_API_KEY');
            const clientSecret = this.configService.get<string>('DHL_CLIENT_SECRET') ||
                this.configService.get<string>('DHL_SECRET_KEY');
            const accountNumber = this.configService.get<string>('DHL_ACCOUNT_NUMBER');

            if (!clientId || !clientSecret) {
                return {
                    success: false,
                    error: 'DHL credentials not configured in .env',
                    hint: 'Set DHL_CLIENT_ID and DHL_CLIENT_SECRET in your .env file',
                };
            }

            const testAccount: DHLShippingAccount = {
                id: 'test-dhl-account',
                organizationId: 'test-org',
                carrier: 'DHL',
                accountNumber: accountNumber || 'test-account',
                testMode: true,
                credentials: { clientId, clientSecret },
                status: 'ACTIVE',
            };

            const startTime = Date.now();
            const token = await this.dhlOAuthService.getAccessToken(testAccount);
            const duration = Date.now() - startTime;

            return {
                success: true,
                message: 'DHL OAuth token obtained successfully!',
                endpoint: 'https://api-sandbox.dhl.com/auth/accesstoken',
                token: {
                    preview: `${token.substring(0, 50)}...`,
                    length: token.length,
                },
                performance: {
                    durationMs: duration,
                    cachedInRedis: true,
                },
                accountNumber: accountNumber || 'not-configured',
            };

        } catch (error: any) {
            this.logger.error('DHL OAuth test failed', error);
            return {
                success: false,
                error: error.message,
                code: error.code || 'UNKNOWN',
                statusCode: error.statusCode || 500,
            };
        }
    }

    /**
     * Test Redis caching
     * GET /api/v1/test/dhl/cache
     */
    @Get('cache')
    @Public()
    async testCaching() {
        this.logger.log('Testing DHL token caching...');

        const clientId = this.configService.get<string>('DHL_CLIENT_ID') ||
            this.configService.get<string>('DHL_API_KEY');
        const clientSecret = this.configService.get<string>('DHL_CLIENT_SECRET') ||
            this.configService.get<string>('DHL_SECRET_KEY');

        if (!clientId || !clientSecret) {
            return { success: false, error: 'DHL credentials not configured' };
        }

        const testAccount: DHLShippingAccount = {
            id: 'test-dhl-cache',
            organizationId: 'test-org',
            carrier: 'DHL',
            accountNumber: 'test',
            testMode: true,
            credentials: { clientId, clientSecret },
            status: 'ACTIVE',
        };

        // First call - should hit DHL API
        const start1 = Date.now();
        const token1 = await this.dhlOAuthService.getAccessToken(testAccount);
        const duration1 = Date.now() - start1;

        // Second call - should hit Redis cache
        const start2 = Date.now();
        const token2 = await this.dhlOAuthService.getAccessToken(testAccount);
        const duration2 = Date.now() - start2;

        return {
            success: true,
            message: 'Cache test complete',
            firstCall: {
                source: duration1 > 100 ? 'DHL API' : 'Redis Cache',
                durationMs: duration1,
            },
            secondCall: {
                source: duration2 < 50 ? 'Redis Cache' : 'DHL API (cache miss)',
                durationMs: duration2,
            },
            tokensMatch: token1 === token2,
            speedup: `${(duration1 / Math.max(duration2, 1)).toFixed(1)}x faster from cache`,
        };
    }

    /**
     * Clear cached token
     * POST /api/v1/test/dhl/clear-cache
     */
    @Post('clear-cache')
    @Public()
    async clearCache() {
        await this.dhlOAuthService.clearCachedToken('test-dhl-account');
        await this.dhlOAuthService.clearCachedToken('test-dhl-cache');

        return {
            success: true,
            message: 'DHL token cache cleared',
        };
    }

    /**
     * Test error handling with invalid credentials
     * GET /api/v1/test/dhl/error
     */
    @Get('error')
    @Public()
    async testErrorHandling() {
        const testAccount: DHLShippingAccount = {
            id: 'test-dhl-invalid',
            organizationId: 'test-org',
            carrier: 'DHL',
            accountNumber: 'test',
            testMode: true,
            credentials: {
                clientId: 'invalid_client_id',
                clientSecret: 'invalid_client_secret',
            },
            status: 'ACTIVE',
        };

        try {
            await this.dhlOAuthService.getAccessToken(testAccount);
            return {
                success: false,
                error: 'Expected error but got success',
            };
        } catch (error: any) {
            return {
                success: true,
                message: 'Error handling test complete',
                errorCaught: {
                    code: error.code,
                    message: error.message,
                    statusCode: error.statusCode,
                },
            };
        }
    }
}
