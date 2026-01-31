/**
 * FedEx OAuth Test Controller
 * 
 * Provides a simple endpoint to test FedEx OAuth integration.
 * This should only be used in development/testing environments.
 */

import { Controller, Get, Post, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '@common/decorators/public.decorator';
import { FedExOAuthService, ShippingAccount } from './fedex-oauth.service';
import { EncryptionService } from '@common/encryption';

@Controller('test/fedex')
export class FedExOAuthTestController {
    private readonly logger = new Logger(FedExOAuthTestController.name);

    constructor(
        private readonly fedExOAuthService: FedExOAuthService,
        private readonly configService: ConfigService,
        private readonly encryptionService: EncryptionService,
    ) { }

    /**
     * Test FedEx OAuth token retrieval
     * 
     * GET /api/v1/test/fedex/token
     * 
     * Uses credentials from .env to request a token from FedEx
     */
    @Get('token')
    @Public()
    async testGetToken() {
        this.logger.log('Testing FedEx OAuth token retrieval...');

        try {
            // Get credentials from environment
            const clientId = this.configService.get<string>('FEDEX_API_KEY');
            const clientSecret = this.configService.get<string>('FEDEX_SECRET_KEY');
            const accountNumber = this.configService.get<string>('FEDEX_ACCOUNT_NUMBER');

            if (!clientId || !clientSecret) {
                return {
                    success: false,
                    error: 'FedEx credentials not configured in .env',
                    hint: 'Set FEDEX_API_KEY and FEDEX_SECRET_KEY in your .env file',
                };
            }

            // Create a test shipping account (using sandbox mode)
            const testAccount: ShippingAccount = {
                id: 'test-fedex-account',
                organizationId: 'test-org',
                carrier: 'FEDEX',
                accountNumber: accountNumber || 'test-account',
                testMode: true, // Always use sandbox for testing
                credentials: {
                    clientId,      // Plain text for this test
                    clientSecret,  // Plain text for this test
                },
                status: 'ACTIVE',
            };

            // Get access token (this will cache it in Redis too)
            const startTime = Date.now();
            const token = await this.fedExOAuthService.getAccessToken(testAccount);
            const duration = Date.now() - startTime;

            // Decode JWT to show expiry (without verification)
            const tokenParts = token.split('.');
            let tokenInfo: any = {};
            if (tokenParts.length === 3) {
                try {
                    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                    tokenInfo = {
                        expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'unknown',
                        scope: payload.Payload?.additionalIdentity?.apimode || 'unknown',
                    };
                } catch {
                    tokenInfo = { note: 'Could not decode token' };
                }
            }

            return {
                success: true,
                message: 'FedEx OAuth token obtained successfully!',
                endpoint: 'https://apis-sandbox.fedex.com/oauth/token',
                token: {
                    preview: `${token.substring(0, 50)}...`,
                    length: token.length,
                    ...tokenInfo,
                },
                performance: {
                    durationMs: duration,
                    cachedInRedis: true,
                },
                accountNumber: accountNumber || 'not-configured',
            };

        } catch (error: any) {
            this.logger.error('FedEx OAuth test failed', error);
            return {
                success: false,
                error: error.message,
                code: error.code || 'UNKNOWN',
                statusCode: error.statusCode || 500,
            };
        }
    }

    /**
     * Test Redis caching - second call should be instant
     * 
     * GET /api/v1/test/fedex/cache
     */
    @Get('cache')
    @Public()
    async testCaching() {
        this.logger.log('Testing FedEx token caching...');

        const clientId = this.configService.get<string>('FEDEX_API_KEY');
        const clientSecret = this.configService.get<string>('FEDEX_SECRET_KEY');

        if (!clientId || !clientSecret) {
            return { success: false, error: 'FedEx credentials not configured' };
        }

        const testAccount: ShippingAccount = {
            id: 'test-fedex-cache',
            organizationId: 'test-org',
            carrier: 'FEDEX',
            accountNumber: 'test',
            testMode: true,
            credentials: { clientId, clientSecret },
            status: 'ACTIVE',
        };

        // First call - should hit FedEx API
        const start1 = Date.now();
        const token1 = await this.fedExOAuthService.getAccessToken(testAccount);
        const duration1 = Date.now() - start1;

        // Second call - should hit Redis cache
        const start2 = Date.now();
        const token2 = await this.fedExOAuthService.getAccessToken(testAccount);
        const duration2 = Date.now() - start2;

        return {
            success: true,
            message: 'Cache test complete',
            firstCall: {
                source: duration1 > 100 ? 'FedEx API' : 'Redis Cache',
                durationMs: duration1,
            },
            secondCall: {
                source: duration2 < 50 ? 'Redis Cache' : 'FedEx API (cache miss)',
                durationMs: duration2,
            },
            tokensMatch: token1 === token2,
            speedup: `${(duration1 / Math.max(duration2, 1)).toFixed(1)}x faster from cache`,
        };
    }

    /**
     * Clear cached token for testing
     * 
     * POST /api/v1/test/fedex/clear-cache
     */
    @Post('clear-cache')
    @Public()
    async clearCache() {
        await this.fedExOAuthService.clearCachedToken('test-fedex-account');
        await this.fedExOAuthService.clearCachedToken('test-fedex-cache');

        return {
            success: true,
            message: 'Token cache cleared',
        };
    }
}
