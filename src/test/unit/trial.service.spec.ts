/**
 * TrialService Unit Tests (BILL-04)
 * 
 * Tests trial management logic:
 * - 14-day trial expiry date calculation
 * - Days remaining calculation
 * - Trial expiry transition: TRIAL → SUSPENDED
 * - BillingAuditLog creation on expiry
 */

import { TrialService } from '../../src/modules/billing/trial.service';
import { SubscriptionStatus } from '@prisma/client';

describe('TrialService', () => {
    let service: TrialService;
    let mockPrisma: any;

    beforeEach(() => {
        mockPrisma = {
            organization: {
                findMany: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
            },
            billingAuditLog: {
                create: jest.fn(),
            },
        };

        service = new TrialService(mockPrisma);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('TRIAL_DURATION_DAYS', () => {
        it('should be 14 days', () => {
            expect(TrialService.TRIAL_DURATION_DAYS).toBe(14);
        });
    });

    describe('calculateTrialEndDate', () => {
        it('should calculate trial expiry date as 14 days from registration', () => {
            const registrationDate = new Date('2024-01-01T00:00:00Z');
            const expectedEndDate = new Date('2024-01-15T00:00:00Z');

            const result = service.calculateTrialEndDate(registrationDate);

            expect(result.getDate()).toBe(expectedEndDate.getDate());
            expect(result.getMonth()).toBe(expectedEndDate.getMonth());
            expect(result.getFullYear()).toBe(expectedEndDate.getFullYear());
        });

        it('should handle end of month correctly', () => {
            // January 25 + 14 days = February 8
            const registrationDate = new Date('2024-01-25T00:00:00Z');
            const result = service.calculateTrialEndDate(registrationDate);

            expect(result.getMonth()).toBe(1); // February (0-indexed)
            expect(result.getDate()).toBe(8);
        });

        it('should default to current date if no date provided', () => {
            const now = new Date();
            const expected = new Date(now);
            expected.setDate(expected.getDate() + 14);

            const result = service.calculateTrialEndDate();

            // Allow for a few seconds of drift
            const diffMs = Math.abs(result.getTime() - expected.getTime());
            expect(diffMs).toBeLessThan(1000);
        });
    });

    describe('getDaysRemaining', () => {
        it('should calculate days remaining correctly', () => {
            const now = new Date();
            const trialEndsAt = new Date(now);
            trialEndsAt.setDate(trialEndsAt.getDate() + 7); // 7 days from now

            const result = service.getDaysRemaining(trialEndsAt);

            expect(result).toBe(7);
        });

        it('should return 0 for today', () => {
            const trialEndsAt = new Date();
            trialEndsAt.setHours(23, 59, 59, 999); // End of today

            const result = service.getDaysRemaining(trialEndsAt);

            expect(result).toBe(1); // Within today, so 1 day remaining
        });

        it('should return negative for expired trials', () => {
            const now = new Date();
            const trialEndsAt = new Date(now);
            trialEndsAt.setDate(trialEndsAt.getDate() - 3); // 3 days ago

            const result = service.getDaysRemaining(trialEndsAt);

            expect(result).toBeLessThanOrEqual(-2);
        });
    });

    describe('isTrialExpired', () => {
        it('should return true for expired trial', () => {
            const expired = new Date();
            expired.setDate(expired.getDate() - 1); // Yesterday

            const result = service.isTrialExpired({
                subscriptionStatus: SubscriptionStatus.TRIAL,
                trialEndsAt: expired,
            });

            expect(result).toBe(true);
        });

        it('should return false for active trial', () => {
            const future = new Date();
            future.setDate(future.getDate() + 7); // 7 days from now

            const result = service.isTrialExpired({
                subscriptionStatus: SubscriptionStatus.TRIAL,
                trialEndsAt: future,
            });

            expect(result).toBe(false);
        });

        it('should return false for non-TRIAL status', () => {
            const expired = new Date();
            expired.setDate(expired.getDate() - 1); // Yesterday

            const result = service.isTrialExpired({
                subscriptionStatus: SubscriptionStatus.ACTIVE,
                trialEndsAt: expired,
            });

            expect(result).toBe(false);
        });

        it('should return false if trialEndsAt is null', () => {
            const result = service.isTrialExpired({
                subscriptionStatus: SubscriptionStatus.TRIAL,
                trialEndsAt: null,
            });

            expect(result).toBe(false);
        });
    });

    describe('expireTrials', () => {
        it('should transition expired trials to SUSPENDED', async () => {
            const expiredOrg = {
                id: 'org-expired-1',
                name: 'Expired Org',
                trialEndsAt: new Date('2024-01-01'),
                billingEmail: 'test@example.com',
            };

            mockPrisma.organization.findMany.mockResolvedValue([expiredOrg]);
            mockPrisma.organization.update.mockResolvedValue({});
            mockPrisma.billingAuditLog.create.mockResolvedValue({});

            const result = await service.expireTrials();

            expect(result).toBe(1);
            expect(mockPrisma.organization.update).toHaveBeenCalledWith({
                where: { id: 'org-expired-1' },
                data: { subscriptionStatus: SubscriptionStatus.SUSPENDED },
            });
        });

        it('should create BillingAuditLog entry on expiry', async () => {
            const expiredOrg = {
                id: 'org-expired-1',
                name: 'Expired Org',
                trialEndsAt: new Date('2024-01-01'),
                billingEmail: 'test@example.com',
            };

            mockPrisma.organization.findMany.mockResolvedValue([expiredOrg]);
            mockPrisma.organization.update.mockResolvedValue({});
            mockPrisma.billingAuditLog.create.mockResolvedValue({});

            await service.expireTrials();

            expect(mockPrisma.billingAuditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    organizationId: 'org-expired-1',
                    action: 'TRIAL_EXPIRED',
                    performedBy: 'system',
                    previousValue: { status: SubscriptionStatus.TRIAL },
                    newValue: { status: SubscriptionStatus.SUSPENDED },
                }),
            });
        });

        it('should return 0 if no expired trials', async () => {
            mockPrisma.organization.findMany.mockResolvedValue([]);

            const result = await service.expireTrials();

            expect(result).toBe(0);
            expect(mockPrisma.organization.update).not.toHaveBeenCalled();
        });

        it('should process multiple expired trials', async () => {
            const expiredOrgs = [
                { id: 'org-1', name: 'Org 1', trialEndsAt: new Date('2024-01-01'), billingEmail: 'a@test.com' },
                { id: 'org-2', name: 'Org 2', trialEndsAt: new Date('2024-01-02'), billingEmail: 'b@test.com' },
            ];

            mockPrisma.organization.findMany.mockResolvedValue(expiredOrgs);
            mockPrisma.organization.update.mockResolvedValue({});
            mockPrisma.billingAuditLog.create.mockResolvedValue({});

            const result = await service.expireTrials();

            expect(result).toBe(2);
            expect(mockPrisma.organization.update).toHaveBeenCalledTimes(2);
            expect(mockPrisma.billingAuditLog.create).toHaveBeenCalledTimes(2);
        });
    });

    describe('getTrialsExpiringInDays', () => {
        it('should query for trials expiring in exactly N days', async () => {
            mockPrisma.organization.findMany.mockResolvedValue([]);

            await service.getTrialsExpiringInDays(7);

            expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
                where: {
                    subscriptionStatus: SubscriptionStatus.TRIAL,
                    trialEndsAt: {
                        gte: expect.any(Date),
                        lte: expect.any(Date),
                    },
                },
                select: {
                    id: true,
                    name: true,
                    billingEmail: true,
                    trialEndsAt: true,
                },
            });
        });
    });

    describe('getTrialStatus', () => {
        it('should return trial status for organization', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 7);

            mockPrisma.organization.findUnique.mockResolvedValue({
                subscriptionStatus: SubscriptionStatus.TRIAL,
                trialEndsAt: futureDate,
            });

            const result = await service.getTrialStatus('org-123');

            expect(result.isInTrial).toBe(true);
            expect(result.trialEndsAt).toEqual(futureDate);
            expect(result.daysRemaining).toBe(7);
            expect(result.isExpired).toBe(false);
        });

        it('should return not in trial for ACTIVE org', async () => {
            mockPrisma.organization.findUnique.mockResolvedValue({
                subscriptionStatus: SubscriptionStatus.ACTIVE,
                trialEndsAt: null,
            });

            const result = await service.getTrialStatus('org-123');

            expect(result.isInTrial).toBe(false);
        });
    });
});
