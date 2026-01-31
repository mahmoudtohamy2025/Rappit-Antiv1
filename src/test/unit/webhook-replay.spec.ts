import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from '../../src/modules/webhooks/webhooks.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { JobsService } from '../../src/modules/jobs/jobs.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

/**
 * QUEUE-03: Webhook Replay Admin Endpoint Tests
 * 
 * Tests cover:
 * 1. Replay enqueues job with original payload
 * 2. Non-existent eventId returns 404
 * 3. Cross-org replay blocked (security)
 * 4. Replay count tracked to prevent loops
 * 5. Max replay limit enforced (5 replays)
 * 6. Audit log entry created
 */
describe('QUEUE-03 Webhook Replay Admin Endpoint', () => {
    let service: WebhooksService;
    let prisma: PrismaService;
    let jobsService: JobsService;

    const orgId = 'org-123';
    const otherOrgId = 'org-456';

    const mockWebhookEvent = {
        id: 'evt-123',
        organizationId: orgId,
        channelId: 'ch-1',
        source: 'shopify',
        eventType: 'orders/create',
        externalEventId: 'shopify-evt-abc',
        status: 'FAILED',
        payload: { id: 12345, name: 'Test Order' },
        replayCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhooksService,
                {
                    provide: PrismaService,
                    useValue: {
                        processedWebhookEvent: {
                            findFirst: jest.fn(),
                            update: jest.fn(),
                        },
                        webhookReplayAudit: {
                            create: jest.fn(),
                        },
                    },
                },
                {
                    provide: JobsService,
                    useValue: {
                        queueOrderImport: jest.fn().mockResolvedValue({ jobId: 'job-new-1' }),
                    },
                },
            ],
        }).compile();

        service = module.get<WebhooksService>(WebhooksService);
        prisma = module.get<PrismaService>(PrismaService);
        jobsService = module.get<JobsService>(JobsService);
        jest.clearAllMocks();
    });

    describe('Happy Paths', () => {
        it('should replay webhook and enqueue job with original payload', async () => {
            (prisma.processedWebhookEvent.findFirst as jest.Mock).mockResolvedValue(mockWebhookEvent);
            (prisma.processedWebhookEvent.update as jest.Mock).mockResolvedValue({
                ...mockWebhookEvent,
                replayCount: 1,
            });

            const result = await service.replayWebhook('evt-123', orgId, 'admin-user-1');

            expect(result).toBeDefined();
            expect(result.replayed).toBe(true);
            expect(result.newJobId).toBe('job-new-1');
            expect(prisma.processedWebhookEvent.update).toHaveBeenCalledWith({
                where: { id: 'evt-123' },
                data: expect.objectContaining({
                    replayCount: 1,
                    status: 'ENQUEUED',
                }),
            });
        });

        it('should increment replay count on each replay', async () => {
            const eventWithReplays = { ...mockWebhookEvent, replayCount: 2 };
            (prisma.processedWebhookEvent.findFirst as jest.Mock).mockResolvedValue(eventWithReplays);
            (prisma.processedWebhookEvent.update as jest.Mock).mockResolvedValue({
                ...eventWithReplays,
                replayCount: 3,
            });

            await service.replayWebhook('evt-123', orgId, 'admin-user-1');

            expect(prisma.processedWebhookEvent.update).toHaveBeenCalledWith({
                where: { id: 'evt-123' },
                data: expect.objectContaining({
                    replayCount: 3,
                }),
            });
        });
    });

    describe('Edge Cases', () => {
        it('should throw NotFoundException for non-existent eventId', async () => {
            (prisma.processedWebhookEvent.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(service.replayWebhook('invalid-id', orgId, 'admin-user-1'))
                .rejects
                .toThrow(NotFoundException);
        });

        it('should throw BadRequestException when max replay limit reached', async () => {
            const maxReplayEvent = { ...mockWebhookEvent, replayCount: 5 };
            (prisma.processedWebhookEvent.findFirst as jest.Mock).mockResolvedValue(maxReplayEvent);

            await expect(service.replayWebhook('evt-123', orgId, 'admin-user-1'))
                .rejects
                .toThrow(BadRequestException);
        });
    });

    describe('Security / Hardening', () => {
        it('should block cross-org replay attempts', async () => {
            // Event belongs to org-123, but request comes from org-456
            (prisma.processedWebhookEvent.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(service.replayWebhook('evt-123', otherOrgId, 'admin-user-1'))
                .rejects
                .toThrow(NotFoundException);

            expect(prisma.processedWebhookEvent.findFirst).toHaveBeenCalledWith({
                where: { id: 'evt-123', organizationId: otherOrgId },
            });
        });
    });

    describe('Audit Logging', () => {
        it('should create audit log entry on replay', async () => {
            (prisma.processedWebhookEvent.findFirst as jest.Mock).mockResolvedValue(mockWebhookEvent);
            (prisma.processedWebhookEvent.update as jest.Mock).mockResolvedValue({
                ...mockWebhookEvent,
                replayCount: 1,
            });

            await service.replayWebhook('evt-123', orgId, 'admin-user-1');

            expect(prisma.webhookReplayAudit.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    eventId: 'evt-123',
                    organizationId: orgId,
                    performedBy: 'admin-user-1',
                    action: 'REPLAY',
                }),
            });
        });
    });
});
