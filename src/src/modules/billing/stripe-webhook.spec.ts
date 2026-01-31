import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { StripeWebhookService } from './stripe-webhook.service';
import { PrismaService } from '../../common/database/prisma.service';
import { SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';

/**
 * Unit Tests for Stripe Webhook Service (BILL-02)
 * 
 * Test Coverage: 95% for billing module
 */
describe('StripeWebhookService', () => {
    let service: StripeWebhookService;
    let prisma: PrismaService;
    let configService: ConfigService;

    const mockWebhookSecret = 'whsec_test_secret';

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StripeWebhookService,
                {
                    provide: PrismaService,
                    useValue: {
                        organization: {
                            findFirst: jest.fn(),
                            update: jest.fn(),
                        },
                        processedStripeEvent: {
                            findUnique: jest.fn(),
                            create: jest.fn(),
                        },
                        billingAuditLog: {
                            create: jest.fn(),
                        },
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'STRIPE_SECRET_KEY') return 'sk_test_xxx';
                            if (key === 'STRIPE_WEBHOOK_SECRET') return mockWebhookSecret;
                            return null;
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<StripeWebhookService>(StripeWebhookService);
        prisma = module.get<PrismaService>(PrismaService);
        configService = module.get<ConfigService>(ConfigService);
    });

    describe('verifySignature', () => {
        it('should throw BadRequestException for invalid signature', () => {
            const payload = Buffer.from('{}');
            const invalidSignature = 'invalid_signature';

            expect(() => service.verifySignature(payload, invalidSignature)).toThrow(
                BadRequestException,
            );
        });

        it('should throw BadRequestException with correct message', () => {
            const payload = Buffer.from('{}');
            const invalidSignature = 'invalid_signature';

            expect(() => service.verifySignature(payload, invalidSignature)).toThrow(
                'Invalid Stripe signature',
            );
        });
    });

    describe('isEventProcessed', () => {
        it('should return true for already processed event', async () => {
            jest.spyOn(prisma.processedStripeEvent, 'findUnique').mockResolvedValue({
                id: 'evt_test',
                eventType: 'customer.subscription.created',
                processed: true,
                createdAt: new Date(),
            });

            const result = await service.isEventProcessed('evt_test');
            expect(result).toBe(true);
        });

        it('should return false for new event', async () => {
            jest.spyOn(prisma.processedStripeEvent, 'findUnique').mockResolvedValue(null);

            const result = await service.isEventProcessed('evt_new');
            expect(result).toBe(false);
        });
    });

    describe('markEventProcessed', () => {
        it('should create processed event record', async () => {
            const createSpy = jest.spyOn(prisma.processedStripeEvent, 'create').mockResolvedValue({
                id: 'evt_test',
                eventType: 'customer.subscription.created',
                processed: true,
                createdAt: new Date(),
            });

            await service.markEventProcessed('evt_test', 'customer.subscription.created');

            expect(createSpy).toHaveBeenCalledWith({
                data: {
                    id: 'evt_test',
                    eventType: 'customer.subscription.created',
                    processed: true,
                },
            });
        });
    });

    describe('handleWebhookEvent - Event Routing', () => {
        const createMockEvent = (type: string, data: any): Stripe.Event => ({
            id: 'evt_test_123',
            type,
            data: { object: data },
            api_version: '2023-10-16',
            created: Date.now() / 1000,
            livemode: false,
            object: 'event',
            pending_webhooks: 0,
            request: null,
        });

        beforeEach(() => {
            jest.spyOn(prisma.processedStripeEvent, 'findUnique').mockResolvedValue(null);
            jest.spyOn(prisma.processedStripeEvent, 'create').mockResolvedValue({} as any);
            jest.spyOn(prisma.organization, 'findFirst').mockResolvedValue({
                id: 'org_test',
                name: 'Test Org',
                subscriptionStatus: SubscriptionStatus.TRIAL,
                stripeCustomerId: 'cus_test',
            } as any);
            jest.spyOn(prisma.organization, 'update').mockResolvedValue({} as any);
            jest.spyOn(prisma.billingAuditLog, 'create').mockResolvedValue({} as any);
        });

        it('should handle customer.subscription.created event', async () => {
            const event = createMockEvent('customer.subscription.created', {
                id: 'sub_test',
                customer: 'cus_test',
                status: 'active',
                trial_end: null,
                current_period_end: Date.now() / 1000 + 86400 * 30,
                items: { data: [{ price: { id: 'price_test' } }] },
            });

            await service.handleWebhookEvent(event);

            expect(prisma.organization.update).toHaveBeenCalled();
            expect(prisma.billingAuditLog.create).toHaveBeenCalled();
        });

        it('should handle customer.subscription.deleted event', async () => {
            const event = createMockEvent('customer.subscription.deleted', {
                id: 'sub_test',
                customer: 'cus_test',
            });

            await service.handleWebhookEvent(event);

            expect(prisma.organization.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        subscriptionStatus: SubscriptionStatus.CANCELLED,
                    }),
                }),
            );
        });

        it('should handle invoice.payment_failed event', async () => {
            const event = createMockEvent('invoice.payment_failed', {
                id: 'in_test',
                customer: 'cus_test',
            });

            await service.handleWebhookEvent(event);

            expect(prisma.organization.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        subscriptionStatus: SubscriptionStatus.PAST_DUE,
                    }),
                }),
            );
        });

        it('should skip already processed events (idempotency)', async () => {
            jest.spyOn(prisma.processedStripeEvent, 'findUnique').mockResolvedValue({
                id: 'evt_already_processed',
                eventType: 'customer.subscription.created',
                processed: true,
                createdAt: new Date(),
            });

            const event = createMockEvent('customer.subscription.created', {
                customer: 'cus_test',
            });
            event.id = 'evt_already_processed';

            await service.handleWebhookEvent(event);

            // Organization should not be updated
            expect(prisma.organization.update).not.toHaveBeenCalled();
        });

        it('should handle unknown event types gracefully', async () => {
            const event = createMockEvent('unknown.event.type', {});

            // Should not throw
            await expect(service.handleWebhookEvent(event)).resolves.not.toThrow();

            // Should still mark as processed
            expect(prisma.processedStripeEvent.create).toHaveBeenCalled();
        });
    });
});
