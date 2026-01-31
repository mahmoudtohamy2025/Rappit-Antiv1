import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * StripeService (BILL-06)
 * 
 * Core Stripe API integration service.
 * 
 * CRITICAL:
 * - Stripe API errors must NOT block core operations
 * - All errors are logged for investigation
 * - Returns null on failure instead of throwing
 */
@Injectable()
export class StripeService {
    private readonly logger = new Logger(StripeService.name);
    private readonly stripe: Stripe | null;

    constructor(private configService: ConfigService) {
        const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

        if (secretKey) {
            this.stripe = new Stripe(secretKey, {
                apiVersion: '2025-12-15.clover',
                typescript: true,
            });
            this.logger.log('Stripe client initialized');
        } else {
            this.stripe = null;
            this.logger.warn('Stripe secret key not configured - Stripe operations will be skipped');
        }
    }

    /**
     * Check if Stripe is configured
     */
    isConfigured(): boolean {
        return this.stripe !== null;
    }

    /**
     * Create a Stripe customer for an organization
     * 
     * BILL-06: Called on organization registration
     * 
     * @param organizationId - Organization ID (stored in metadata)
     * @param organizationName - Organization name
     * @param email - Billing email
     * @returns Stripe customer ID or null on failure
     * 
     * IMPORTANT: This method NEVER throws. Returns null on any error.
     */
    async createCustomer(
        organizationId: string,
        organizationName: string,
        email: string,
    ): Promise<string | null> {
        if (!this.stripe) {
            this.logger.warn('Stripe not configured, skipping customer creation');
            return null;
        }

        try {
            const customer = await this.stripe.customers.create({
                email,
                name: organizationName,
                metadata: {
                    organizationId,
                    environment: this.configService.get<string>('NODE_ENV') || 'development',
                    createdAt: new Date().toISOString(),
                },
            });

            this.logger.log(
                `Stripe customer created: ${customer.id} for org ${organizationId}`,
            );

            return customer.id;
        } catch (error: any) {
            // Log error but DO NOT throw - registration must continue
            this.logger.error(
                `Failed to create Stripe customer for org ${organizationId}: ${error.message}`,
                error.stack,
            );

            // Log additional Stripe-specific error info if available
            if (error.type) {
                this.logger.error(`Stripe error type: ${error.type}, code: ${error.code}`);
            }

            return null;
        }
    }

    /**
     * Retrieve a Stripe customer by ID
     * 
     * @param customerId - Stripe customer ID
     * @returns Stripe customer or null on failure
     */
    async getCustomer(customerId: string): Promise<Stripe.Customer | null> {
        if (!this.stripe) {
            return null;
        }

        try {
            const customer = await this.stripe.customers.retrieve(customerId);

            if (customer.deleted) {
                return null;
            }

            return customer as Stripe.Customer;
        } catch (error: any) {
            this.logger.error(`Failed to retrieve Stripe customer ${customerId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Update a Stripe customer
     * 
     * @param customerId - Stripe customer ID
     * @param data - Update data
     * @returns Updated customer or null on failure
     */
    async updateCustomer(
        customerId: string,
        data: Stripe.CustomerUpdateParams,
    ): Promise<Stripe.Customer | null> {
        if (!this.stripe) {
            return null;
        }

        try {
            const customer = await this.stripe.customers.update(customerId, data);
            this.logger.log(`Stripe customer ${customerId} updated`);
            return customer;
        } catch (error: any) {
            this.logger.error(`Failed to update Stripe customer ${customerId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Create a billing portal session for customer self-service
     * 
     * @param customerId - Stripe customer ID
     * @param returnUrl - URL to redirect to after session
     * @returns Portal session URL or null on failure
     */
    async createBillingPortalSession(
        customerId: string,
        returnUrl: string,
    ): Promise<string | null> {
        if (!this.stripe) {
            return null;
        }

        try {
            const session = await this.stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: returnUrl,
            });

            return session.url;
        } catch (error: any) {
            this.logger.error(`Failed to create billing portal session: ${error.message}`);
            return null;
        }
    }
}
