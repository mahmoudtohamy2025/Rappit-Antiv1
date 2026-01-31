/**
 * Webhook Verification Guard (ORD-01)
 * 
 * NestJS guard that verifies webhook signatures before request handlers.
 * Uses WebhookVerificationService for the actual verification logic.
 * 
 * Usage:
 * @UseGuards(WebhookVerificationGuard)
 * @Post('webhooks/:channelType/:channelId')
 * handleWebhook(@Body() payload, @Req() req) { ... }
 * 
 * Required headers:
 * - Shopify: X-Shopify-Hmac-Sha256
 * - WooCommerce: X-WC-Webhook-Signature
 */

import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
    WebhookVerificationService,
    ChannelType
} from '../../modules/channels/webhook-verification.service';

/**
 * Decorator key for setting channel type on routes
 */
export const WEBHOOK_CHANNEL_TYPE = 'webhook_channel_type';

/**
 * Decorator to specify the channel type for a webhook endpoint
 */
export const WebhookChannelType = (type: ChannelType) =>
    (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
        Reflect.defineMetadata(WEBHOOK_CHANNEL_TYPE, type, descriptor?.value || target);
    };

@Injectable()
export class WebhookVerificationGuard implements CanActivate {
    private readonly logger = new Logger(WebhookVerificationGuard.name);

    constructor(
        private readonly webhookService: WebhookVerificationService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();

        // Get channel ID from route params
        const channelId = request.params.channelId;
        if (!channelId) {
            this.logger.warn('Webhook guard: missing channelId in route params');
            throw new UnauthorizedException('Channel ID is required');
        }

        // Get channel type from route params or decorator
        let channelType = this.getChannelType(context, request);
        if (!channelType) {
            this.logger.warn('Webhook guard: unable to determine channel type');
            throw new UnauthorizedException('Channel type is required');
        }

        // Get raw body (must be preserved by middleware)
        const rawBody = this.getRawBody(request);
        if (rawBody === null) {
            this.logger.warn('Webhook guard: raw body not available');
            throw new UnauthorizedException('Request body is required');
        }

        // Extract signature from headers
        const signature = this.webhookService.extractSignature(
            request.headers as Record<string, string>,
            channelType
        );

        if (!signature) {
            this.logger.warn(`Webhook guard: missing signature header for ${channelType}`);
            throw new UnauthorizedException('Webhook signature is required');
        }

        // Verify the webhook
        const result = await this.webhookService.verifyWebhook({
            channelId,
            channelType,
            signature,
            payload: rawBody,
        });

        if (!result.valid) {
            this.handleVerificationFailure(result.statusCode, result.error);
        }

        // Attach verification result to request for use in handlers
        (request as any).webhookVerification = {
            channelId: result.channelId,
            organizationId: result.organizationId,
            verified: true,
        };

        return true;
    }

    /**
     * Get channel type from decorator, route params, or headers
     */
    private getChannelType(context: ExecutionContext, request: Request): ChannelType | null {
        // 1. Check decorator metadata
        const decoratorType = this.reflector.get<ChannelType>(
            WEBHOOK_CHANNEL_TYPE,
            context.getHandler()
        );
        if (decoratorType) {
            return decoratorType;
        }

        // 2. Check route params
        const paramType = request.params.channelType?.toUpperCase();
        if (paramType && Object.values(ChannelType).includes(paramType as ChannelType)) {
            return paramType as ChannelType;
        }

        // 3. Check header presence to infer type
        if (request.headers['x-shopify-hmac-sha256']) {
            return ChannelType.SHOPIFY;
        }
        if (request.headers['x-wc-webhook-signature']) {
            return ChannelType.WOOCOMMERCE;
        }

        return null;
    }

    /**
     * Get raw request body
     * Requires body-parser with verify option to preserve raw body
     */
    private getRawBody(request: Request): string | null {
        // Check for rawBody property (set by custom middleware)
        if ((request as any).rawBody) {
            return (request as any).rawBody.toString('utf8');
        }

        // Fall back to stringifying body (less secure, may lose byte accuracy)
        if (request.body) {
            if (typeof request.body === 'string') {
                return request.body;
            }
            return JSON.stringify(request.body);
        }

        return null;
    }

    /**
     * Handle verification failure by throwing appropriate exception
     */
    private handleVerificationFailure(statusCode: number | undefined, error: string | undefined): never {
        const message = error || 'Webhook verification failed';

        switch (statusCode) {
            case 403:
                throw new ForbiddenException(message);
            case 404:
                throw new NotFoundException(message);
            case 401:
            default:
                throw new UnauthorizedException(message);
        }
    }
}

/**
 * Interface for webhook verification result attached to request
 */
export interface WebhookVerificationContext {
    channelId: string;
    organizationId: string;
    verified: boolean;
}

/**
 * Helper to get verification context from request
 */
export function getWebhookContext(request: Request): WebhookVerificationContext | null {
    return (request as any).webhookVerification || null;
}
