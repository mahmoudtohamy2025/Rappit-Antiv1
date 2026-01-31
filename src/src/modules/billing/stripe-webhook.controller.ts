import {
    Controller,
    Post,
    Req,
    Res,
    Headers,
    HttpStatus,
    Logger,
    RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { StripeWebhookService } from './stripe-webhook.service';
import { Public } from '@common/decorators/public.decorator';

/**
 * Stripe Webhook Controller (BILL-02)
 * 
 * Endpoint: POST /webhooks/stripe
 * 
 * Security:
 * - Verifies Stripe signature using STRIPE_WEBHOOK_SECRET
 * - Rejects invalid signatures with 400
 * - Returns 200 for unknown events (acknowledges to Stripe)
 */
@ApiTags('Webhooks')
@Controller('webhooks')
@Public()  // Webhook must be accessible without JWT auth
export class StripeWebhookController {
    private readonly logger = new Logger(StripeWebhookController.name);

    constructor(private readonly stripeWebhookService: StripeWebhookService) { }

    @Post('stripe')
    @ApiOperation({ summary: 'Handle Stripe webhook events' })
    @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid signature' })
    async handleStripeWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Res() res: Response,
        @Headers('stripe-signature') signature: string,
    ): Promise<void> {
        this.logger.log('Received Stripe webhook');

        // Get raw body for signature verification
        const rawBody = req.rawBody;

        if (!rawBody) {
            this.logger.error('No raw body available for signature verification');
            res.status(HttpStatus.BAD_REQUEST).json({
                error: 'No raw body available',
            });
            return;
        }

        if (!signature) {
            this.logger.error('No Stripe signature header');
            res.status(HttpStatus.BAD_REQUEST).json({
                error: 'Missing stripe-signature header',
            });
            return;
        }

        try {
            // Verify signature and construct event
            const event = this.stripeWebhookService.verifySignature(rawBody, signature);

            // Handle the event
            await this.stripeWebhookService.handleWebhookEvent(event);

            // Return success
            res.status(HttpStatus.OK).json({ received: true });
        } catch (error) {
            if (error.status === HttpStatus.BAD_REQUEST) {
                // Invalid signature
                res.status(HttpStatus.BAD_REQUEST).json({
                    error: error.message,
                });
            } else {
                // Log error but return 200 to prevent Stripe retries for app errors
                this.logger.error(`Webhook processing error: ${error.message}`);
                res.status(HttpStatus.OK).json({
                    received: true,
                    warning: 'Event received but processing had errors',
                });
            }
        }
    }
}
