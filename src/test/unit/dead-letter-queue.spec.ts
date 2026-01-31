import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from '../../src/modules/jobs/jobs.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

/**
 * QUEUE-01: Dead-Letter Queue Tests
 * 
 * Tests cover:
 * 1. Job moves to DLQ after max retries
 * 2. DLQ entry contains full error context
 * 3. DLQ entries are organization-scoped
 * 4. Retry from DLQ re-enqueues to original queue
 * 5. Invalid DLQ ID returns 404
 * 6. Cross-org DLQ access blocked (Security/Hardening)
 * 7. DLQ cleanup after retention period (14 days)
 * 8. List DLQ jobs with pagination
 */
describe('QUEUE-01 Dead-Letter Queue', () => {
    let service: JobsService;
    let prisma: PrismaService;

    // Mock queues
    const mockOrdersQueue = {
        add: jest.fn(),
        getJob: jest.fn(),
        getWaitingCount: jest.fn().mockResolvedValue(0),
        getActiveCount: jest.fn().mockResolvedValue(0),
        getCompletedCount: jest.fn().mockResolvedValue(0),
        getFailedCount: jest.fn().mockResolvedValue(0),
        getDelayedCount: jest.fn().mockResolvedValue(0),
    };

    const mockOrdersDlqQueue = {
        add: jest.fn(),
        getJob: jest.fn(),
        getJobs: jest.fn(),
        remove: jest.fn(),
    };

    const mockInventoryQueue = {
        add: jest.fn(),
        getJob: jest.fn(),
        getWaitingCount: jest.fn().mockResolvedValue(0),
        getActiveCount: jest.fn().mockResolvedValue(0),
        getCompletedCount: jest.fn().mockResolvedValue(0),
        getFailedCount: jest.fn().mockResolvedValue(0),
        getDelayedCount: jest.fn().mockResolvedValue(0),
    };

    const mockShippingQueue = {
        add: jest.fn(),
        getJob: jest.fn(),
        getWaitingCount: jest.fn().mockResolvedValue(0),
        getActiveCount: jest.fn().mockResolvedValue(0),
        getCompletedCount: jest.fn().mockResolvedValue(0),
        getFailedCount: jest.fn().mockResolvedValue(0),
        getDelayedCount: jest.fn().mockResolvedValue(0),
    };

    const orgId = 'org-123';
    const otherOrgId = 'org-456';

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JobsService,
                {
                    provide: PrismaService,
                    useValue: {
                        deadLetterJob: {
                            create: jest.fn(),
                            findMany: jest.fn(),
                            findFirst: jest.fn(),
                            delete: jest.fn(),
                            deleteMany: jest.fn(),
                            count: jest.fn().mockResolvedValue(0),
                        },
                    },
                },
                { provide: getQueueToken('orders'), useValue: mockOrdersQueue },
                { provide: getQueueToken('orders-dlq'), useValue: mockOrdersDlqQueue },
                { provide: getQueueToken('inventory'), useValue: mockInventoryQueue },
                { provide: getQueueToken('shipping'), useValue: mockShippingQueue },
            ],
        }).compile();

        service = module.get<JobsService>(JobsService);
        prisma = module.get<PrismaService>(PrismaService);
        jest.clearAllMocks();
    });

    describe('Happy Paths', () => {
        it('should move job to DLQ after max retries', async () => {
            const failedJob = {
                id: 'job-123',
                name: 'import-order',
                data: { channelId: 'ch-1', externalOrderId: 'ext-1', organizationId: orgId },
                attemptsMade: 3,
                failedReason: 'Connection timeout',
                timestamp: Date.now(),
            };

            (prisma.deadLetterJob.create as jest.Mock).mockResolvedValue({
                id: 'dlq-1',
                ...failedJob,
            });

            const result = await service.moveToDLQ('orders', failedJob, orgId);

            expect(result).toBeDefined();
            expect(prisma.deadLetterJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    organizationId: orgId,
                    originalQueue: 'orders',
                    jobName: 'import-order',
                    payload: expect.any(Object),
                    error: 'Connection timeout',
                    attemptsMade: 3,
                }),
            });
        });

        it('should store full error context in DLQ entry', async () => {
            const failedJob = {
                id: 'job-456',
                name: 'reserve-inventory',
                data: { orderId: 'ord-1', organizationId: orgId },
                attemptsMade: 3,
                failedReason: 'Insufficient stock',
                stacktrace: ['at Function.process', 'at InventoryService.reserve'],
                timestamp: Date.now(),
            };

            (prisma.deadLetterJob.create as jest.Mock).mockResolvedValue({
                id: 'dlq-2',
                ...failedJob,
            });

            await service.moveToDLQ('inventory', failedJob, orgId);

            expect(prisma.deadLetterJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    error: 'Insufficient stock',
                    stackTrace: expect.arrayContaining(['at Function.process']),
                    attemptsMade: 3,
                }),
            });
        });

        it('should retry DLQ job and re-enqueue to original queue', async () => {
            const dlqJob = {
                id: 'dlq-1',
                organizationId: orgId,
                originalQueue: 'orders',
                jobName: 'import-order',
                payload: { channelId: 'ch-1', externalOrderId: 'ext-1' },
                error: 'Timeout',
                retryCount: 0,
            };

            (prisma.deadLetterJob.findFirst as jest.Mock).mockResolvedValue(dlqJob);
            mockOrdersQueue.add.mockResolvedValue({ id: 'new-job-1' });

            const result = await service.retryDLQJob('dlq-1', orgId);

            expect(result).toBeDefined();
            expect(result.newJobId).toBe('new-job-1');
            expect(mockOrdersQueue.add).toHaveBeenCalledWith(
                'import-order',
                expect.objectContaining({ channelId: 'ch-1' }),
                expect.any(Object),
            );
        });

        it('should list DLQ jobs for organization with pagination', async () => {
            const dlqJobs = [
                { id: 'dlq-1', organizationId: orgId, originalQueue: 'orders' },
                { id: 'dlq-2', organizationId: orgId, originalQueue: 'inventory' },
            ];

            (prisma.deadLetterJob.findMany as jest.Mock).mockResolvedValue(dlqJobs);

            const result = await service.listDLQJobs(orgId, { page: 1, limit: 10 });

            expect(result.jobs).toHaveLength(2);
            expect(prisma.deadLetterJob.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { organizationId: orgId },
                }),
            );
        });

        it('should delete DLQ job after successful retry', async () => {
            const dlqJob = {
                id: 'dlq-1',
                organizationId: orgId,
                originalQueue: 'orders',
                jobName: 'import-order',
                payload: { channelId: 'ch-1' },
            };

            (prisma.deadLetterJob.findFirst as jest.Mock).mockResolvedValue(dlqJob);
            mockOrdersQueue.add.mockResolvedValue({ id: 'new-job-1' });
            (prisma.deadLetterJob.delete as jest.Mock).mockResolvedValue(dlqJob);

            await service.retryDLQJob('dlq-1', orgId);

            expect(prisma.deadLetterJob.delete).toHaveBeenCalledWith({
                where: { id: 'dlq-1' },
            });
        });
    });

    describe('Edge Cases', () => {
        it('should throw NotFoundException for invalid DLQ ID', async () => {
            (prisma.deadLetterJob.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(service.retryDLQJob('invalid-id', orgId))
                .rejects
                .toThrow(NotFoundException);
        });

        it('should throw NotFoundException when getting non-existent DLQ job', async () => {
            (prisma.deadLetterJob.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(service.getDLQJob('invalid-id', orgId))
                .rejects
                .toThrow(NotFoundException);
        });
    });

    describe('Security / Hardening', () => {
        it('should block cross-org DLQ access', async () => {
            const dlqJob = {
                id: 'dlq-1',
                organizationId: orgId, // Belongs to org-123
                originalQueue: 'orders',
            };

            (prisma.deadLetterJob.findFirst as jest.Mock).mockResolvedValue(null); // Simulates org filter

            // Attempt access from different org
            await expect(service.getDLQJob('dlq-1', otherOrgId))
                .rejects
                .toThrow(NotFoundException);

            expect(prisma.deadLetterJob.findFirst).toHaveBeenCalledWith({
                where: { id: 'dlq-1', organizationId: otherOrgId },
            });
        });

        it('should block cross-org DLQ retry', async () => {
            (prisma.deadLetterJob.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(service.retryDLQJob('dlq-1', otherOrgId))
                .rejects
                .toThrow(NotFoundException);
        });

        it('should block cross-org DLQ delete', async () => {
            (prisma.deadLetterJob.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(service.deleteDLQJob('dlq-1', otherOrgId))
                .rejects
                .toThrow(NotFoundException);
        });

        it('should only list DLQ jobs for requesting organization', async () => {
            (prisma.deadLetterJob.findMany as jest.Mock).mockResolvedValue([]);

            await service.listDLQJobs(orgId, { page: 1, limit: 10 });

            expect(prisma.deadLetterJob.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { organizationId: orgId },
                }),
            );
        });
    });

    describe('Retention Policy', () => {
        it('should clean up DLQ entries older than 14 days', async () => {
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

            (prisma.deadLetterJob.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

            const result = await service.cleanupExpiredDLQJobs();

            expect(result.deletedCount).toBe(5);
            expect(prisma.deadLetterJob.deleteMany).toHaveBeenCalledWith({
                where: {
                    createdAt: { lt: expect.any(Date) },
                },
            });
        });
    });
});
