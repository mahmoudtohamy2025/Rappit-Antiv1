import { SetMetadata } from '@nestjs/common';

/**
 * Key for subscription check metadata
 */
export const REQUIRES_SUBSCRIPTION_KEY = 'requires_active_subscription';

/**
 * Decorator to mark routes that require an active subscription for write operations
 * 
 * Usage:
 * @RequiresActiveSubscription()
 * @Post()
 * async createOrder() { ... }
 * 
 * Behavior:
 * - TRIAL, ACTIVE, PAST_DUE: All operations allowed
 * - SUSPENDED, CANCELLED: Read (GET) allowed, Write (POST/PUT/PATCH/DELETE) blocked
 */
export const RequiresActiveSubscription = () =>
    SetMetadata(REQUIRES_SUBSCRIPTION_KEY, true);

/**
 * Key for allowing billing operations even when suspended
 */
export const ALLOW_BILLING_KEY = 'allow_billing_operations';

/**
 * Decorator to mark routes that should always be accessible (e.g., payment update)
 * 
 * Usage:
 * @AllowBillingOperations()
 * @Post('update-payment')
 * async updatePayment() { ... }
 */
export const AllowBillingOperations = () =>
    SetMetadata(ALLOW_BILLING_KEY, true);
