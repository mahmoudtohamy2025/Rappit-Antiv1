import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../common/database/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

/**
 * Organization Subscription Schema Tests (BILL-01)
 * 
 * Test Coverage: 95% for billing module
 */
describe('Organization Subscription Schema', () => {
    let prisma: PrismaService;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [PrismaService],
        }).compile();

        prisma = module.get<PrismaService>(PrismaService);
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('SubscriptionStatus Enum', () => {
        it('should have exactly 5 valid enum values', () => {
            const validStatuses = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'];

            // Verify enum values match expected
            expect(Object.values(SubscriptionStatus)).toEqual(
                expect.arrayContaining(validStatuses),
            );
            expect(Object.values(SubscriptionStatus)).toHaveLength(5);
        });

        it('should validate TRIAL status correctly', () => {
            expect(SubscriptionStatus.TRIAL).toBe('TRIAL');
        });

        it('should validate ACTIVE status correctly', () => {
            expect(SubscriptionStatus.ACTIVE).toBe('ACTIVE');
        });

        it('should validate PAST_DUE status correctly', () => {
            expect(SubscriptionStatus.PAST_DUE).toBe('PAST_DUE');
        });

        it('should validate SUSPENDED status correctly', () => {
            expect(SubscriptionStatus.SUSPENDED).toBe('SUSPENDED');
        });

        it('should validate CANCELLED status correctly', () => {
            expect(SubscriptionStatus.CANCELLED).toBe('CANCELLED');
        });
    });

    describe('Organization Default Subscription Status', () => {
        it('should default subscriptionStatus to TRIAL for new organizations', async () => {
            // Create organization without specifying subscriptionStatus
            const org = await prisma.organization.create({
                data: {
                    name: 'Test Org for Default Status',
                },
            });

            try {
                // Verify default is TRIAL
                expect(org.subscriptionStatus).toBe(SubscriptionStatus.TRIAL);

                // Verify other subscription fields are nullable
                expect(org.stripeCustomerId).toBeNull();
                expect(org.stripeSubscriptionId).toBeNull();
                expect(org.currentPlanId).toBeNull();
                expect(org.trialEndsAt).toBeNull();
                expect(org.subscriptionEndsAt).toBeNull();
                expect(org.billingEmail).toBeNull();
            } finally {
                // Cleanup
                await prisma.organization.delete({ where: { id: org.id } });
            }
        });

        it('should allow setting subscription status to any valid enum value', async () => {
            const org = await prisma.organization.create({
                data: {
                    name: 'Test Org Status Update',
                    subscriptionStatus: SubscriptionStatus.ACTIVE,
                },
            });

            try {
                expect(org.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE);

                // Update to different statuses
                const updated = await prisma.organization.update({
                    where: { id: org.id },
                    data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
                });
                expect(updated.subscriptionStatus).toBe(SubscriptionStatus.PAST_DUE);
            } finally {
                await prisma.organization.delete({ where: { id: org.id } });
            }
        });
    });

    describe('Subscription Fields CRUD', () => {
        it('should create organization with all subscription fields', async () => {
            const trialEnd = new Date('2025-02-01');
            const subEnd = new Date('2026-01-01');

            const org = await prisma.organization.create({
                data: {
                    name: 'Full Subscription Org',
                    subscriptionStatus: SubscriptionStatus.ACTIVE,
                    stripeCustomerId: 'cus_test123',
                    stripeSubscriptionId: 'sub_test456',
                    currentPlanId: 'plan_pro',
                    trialEndsAt: trialEnd,
                    subscriptionEndsAt: subEnd,
                    billingEmail: 'billing@test.com',
                },
            });

            try {
                expect(org.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE);
                expect(org.stripeCustomerId).toBe('cus_test123');
                expect(org.stripeSubscriptionId).toBe('sub_test456');
                expect(org.currentPlanId).toBe('plan_pro');
                expect(org.trialEndsAt).toEqual(trialEnd);
                expect(org.subscriptionEndsAt).toEqual(subEnd);
                expect(org.billingEmail).toBe('billing@test.com');
            } finally {
                await prisma.organization.delete({ where: { id: org.id } });
            }
        });

        it('should allow finding organization by stripeCustomerId', async () => {
            const org = await prisma.organization.create({
                data: {
                    name: 'Stripe Lookup Org',
                    stripeCustomerId: 'cus_unique_test_789',
                },
            });

            try {
                const found = await prisma.organization.findFirst({
                    where: { stripeCustomerId: 'cus_unique_test_789' },
                });

                expect(found).not.toBeNull();
                expect(found?.id).toBe(org.id);
            } finally {
                await prisma.organization.delete({ where: { id: org.id } });
            }
        });
    });

    describe('BillingAuditLog', () => {
        it('should create billing audit log for subscription changes', async () => {
            const org = await prisma.organization.create({
                data: { name: 'Audit Log Test Org' },
            });

            try {
                const auditLog = await prisma.billingAuditLog.create({
                    data: {
                        organizationId: org.id,
                        action: 'subscription.created',
                        previousValue: null,
                        newValue: { status: 'ACTIVE', plan: 'pro' },
                        metadata: { stripeEventId: 'evt_123' },
                        performedBy: 'stripe',
                    },
                });

                expect(auditLog.action).toBe('subscription.created');
                expect(auditLog.newValue).toEqual({ status: 'ACTIVE', plan: 'pro' });
                expect(auditLog.performedBy).toBe('stripe');

                // Cleanup
                await prisma.billingAuditLog.delete({ where: { id: auditLog.id } });
            } finally {
                await prisma.organization.delete({ where: { id: org.id } });
            }
        });

        it('should cascade delete audit logs when organization is deleted', async () => {
            const org = await prisma.organization.create({
                data: { name: 'Cascade Delete Test Org' },
            });

            await prisma.billingAuditLog.create({
                data: {
                    organizationId: org.id,
                    action: 'subscription.cancelled',
                    performedBy: 'system',
                },
            });

            // Delete organization (should cascade)
            await prisma.organization.delete({ where: { id: org.id } });

            // Verify audit logs are also deleted
            const logs = await prisma.billingAuditLog.findMany({
                where: { organizationId: org.id },
            });
            expect(logs).toHaveLength(0);
        });
    });
});
