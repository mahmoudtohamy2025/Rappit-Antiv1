/**
 * SubscriptionGuard Unit Tests (BILL-03)
 * 
 * Tests subscription status-based access control.
 * 
 * Access Rules:
 * | Status     | Read (GET) | Write (POST/PUT/PATCH/DELETE) |
 * |------------|------------|-------------------------------|
 * | TRIAL      | ✅         | ✅                            |
 * | ACTIVE     | ✅         | ✅                            |
 * | PAST_DUE   | ✅         | ✅                            |
 * | SUSPENDED  | ✅         | ❌                            |
 * | CANCELLED  | ✅         | ❌                            |
 */

import { SubscriptionGuard } from '../../src/common/guards/subscription.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';

describe('SubscriptionGuard', () => {
    let guard: SubscriptionGuard;
    let reflector: Reflector;
    let mockPrisma: any;

    // Helper to create mock ExecutionContext
    const createMockContext = (
        method: string,
        user: { organizationId: string },
    ): ExecutionContext => {
        return {
            switchToHttp: () => ({
                getRequest: () => ({
                    method,
                    user,
                    path: '/api/v1/orders',
                }),
            }),
            getHandler: () => ({}),
            getClass: () => ({}),
        } as ExecutionContext;
    };

    beforeEach(() => {
        reflector = new Reflector();

        // Mock Reflector to return true for @RequiresActiveSubscription
        jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: any) => {
            if (key === 'requires_active_subscription') return true;
            if (key === 'allow_billing_operations') return false;
            return undefined;
        });

        mockPrisma = {
            organization: {
                findUnique: jest.fn(),
            },
        };

        guard = new SubscriptionGuard(reflector, mockPrisma);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('SUSPENDED organization', () => {
        const user = { organizationId: 'org-suspended' };

        beforeEach(() => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                id: 'org-suspended',
                name: 'Suspended Org',
                subscriptionStatus: SubscriptionStatus.SUSPENDED,
            });
        });

        it('should block SUSPENDED org from creating order (POST)', async () => {
            const context = createMockContext('POST', user);

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        });

        it('should block SUSPENDED org from updating (PATCH)', async () => {
            const context = createMockContext('PATCH', user);

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        });

        it('should block SUSPENDED org from deleting (DELETE)', async () => {
            const context = createMockContext('DELETE', user);

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        });

        it('should allow SUSPENDED org to read (GET)', async () => {
            const context = createMockContext('GET', user);

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
        });
    });

    describe('CANCELLED organization', () => {
        const user = { organizationId: 'org-cancelled' };

        beforeEach(() => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                id: 'org-cancelled',
                name: 'Cancelled Org',
                subscriptionStatus: SubscriptionStatus.CANCELLED,
            });
        });

        it('should block CANCELLED org from creating order (POST)', async () => {
            const context = createMockContext('POST', user);

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        });

        it('should allow CANCELLED org to read (GET)', async () => {
            const context = createMockContext('GET', user);

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
        });
    });

    describe('ACTIVE organization', () => {
        const user = { organizationId: 'org-active' };

        beforeEach(() => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                id: 'org-active',
                name: 'Active Org',
                subscriptionStatus: SubscriptionStatus.ACTIVE,
            });
        });

        it('should allow ACTIVE org to create (POST)', async () => {
            const context = createMockContext('POST', user);

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
        });

        it('should allow ACTIVE org to read (GET)', async () => {
            const context = createMockContext('GET', user);

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
        });

        it('should allow ACTIVE org to update (PATCH)', async () => {
            const context = createMockContext('PATCH', user);

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
        });

        it('should allow ACTIVE org to delete (DELETE)', async () => {
            const context = createMockContext('DELETE', user);

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
        });
    });

    describe('PAST_DUE organization (grace period)', () => {
        const user = { organizationId: 'org-past-due' };

        beforeEach(() => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                id: 'org-past-due',
                name: 'Past Due Org',
                subscriptionStatus: SubscriptionStatus.PAST_DUE,
            });
        });

        it('should allow PAST_DUE org to create (POST) - grace period', async () => {
            const context = createMockContext('POST', user);

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
        });

        it('should allow PAST_DUE org to read (GET)', async () => {
            const context = createMockContext('GET', user);

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
        });
    });

    describe('TRIAL organization', () => {
        const user = { organizationId: 'org-trial' };

        beforeEach(() => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                id: 'org-trial',
                name: 'Trial Org',
                subscriptionStatus: SubscriptionStatus.TRIAL,
            });
        });

        it('should allow TRIAL org to create (POST)', async () => {
            const context = createMockContext('POST', user);

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
        });

        it('should allow TRIAL org to read (GET)', async () => {
            const context = createMockContext('GET', user);

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
        });
    });

    describe('No subscription record', () => {
        const user = { organizationId: 'org-no-subscription' };

        it('should default to TRIAL behavior when no subscription status', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                id: 'org-no-subscription',
                name: 'No Subscription Org',
                subscriptionStatus: null, // No subscription status set
            });

            const context = createMockContext('POST', user);

            // Should allow because default is TRIAL
            const result = await guard.canActivate(context);
            expect(result).toBe(true);
        });
    });

    describe('Error response format', () => {
        const user = { organizationId: 'org-suspended' };

        beforeEach(() => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                id: 'org-suspended',
                name: 'Suspended Org',
                subscriptionStatus: SubscriptionStatus.SUSPENDED,
            });
        });

        it('should return 403 with billing URL', async () => {
            const context = createMockContext('POST', user);

            try {
                await guard.canActivate(context);
                fail('Should have thrown ForbiddenException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ForbiddenException);
                const response = error.getResponse();
                expect(response.statusCode).toBe(403);
                expect(response.billingUrl).toBe('/billing');
                expect(response.currentStatus).toBe(SubscriptionStatus.SUSPENDED);
            }
        });
    });

    describe('Skip guard when decorator not applied', () => {
        it('should allow access when @RequiresActiveSubscription not applied', async () => {
            // Override reflector to return false
            jest.spyOn(reflector, 'getAllAndOverride').mockImplementation(() => false);

            const context = createMockContext('POST', { organizationId: 'any-org' });

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
            // Prisma should not be called
            expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
        });
    });
});
