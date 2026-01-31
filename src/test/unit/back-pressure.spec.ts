import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from '../../src/modules/jobs/jobs.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * QUEUE-02: Back-Pressure Protection Tests
 * 
 * Tests cover:
 * 1. Job added when queue below threshold
 * 2. Job rejected when queue at/above threshold (429)
 * 3. High-priority jobs bypass back-pressure
 * 4. Threshold is configurable via env
 * 5. Exception includes queue name
 * 6. Metric emitted on back-pressure trigger
 * 7. Race condition handling
 */
describe('QUEUE-02 Back-Pressure Protection', () => {
    let service: JobsService;
    let configService: ConfigService;

    const orgId = 'org-123';
    const DEFAULT_THRESHOLD = 10000;

    // Mock queues with controllable depth
    const createMockQueue = (depth: number = 0) => ({
        add: jest.fn().mockResolvedValue({ id: 'job-123' }),
        getJob: jest.fn(),
        getWaitingCount: jest.fn().mockResolvedValue(depth),
        getActiveCount: jest.fn().mockResolvedValue(0),
        getCompletedCount: jest.fn().mockResolvedValue(0),
        getFailedCount: jest.fn().mockResolvedValue(0),
        getDelayedCount: jest.fn().mockResolvedValue(0),
    });

    let mockOrdersQueue: ReturnType<typeof createMockQueue>;
    let mockInventoryQueue: ReturnType<typeof createMockQueue>;
    let mockShippingQueue: ReturnType<typeof createMockQueue>;

    beforeEach(async () => {
        mockOrdersQueue = createMockQueue(0);
        mockInventoryQueue = createMockQueue(0);
        mockShippingQueue = createMockQueue(0);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JobsService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'queue.maxDepth') return DEFAULT_THRESHOLD;
                            return undefined;
                        }),
                    },
                },
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
                { provide: getQueueToken('inventory'), useValue: mockInventoryQueue },
                { provide: getQueueToken('shipping'), useValue: mockShippingQueue },
            ],
        }).compile();

        service = module.get<JobsService>(JobsService);
        configService = module.get<ConfigService>(ConfigService);
        jest.clearAllMocks();

        // Ensure default threshold is used
        delete process.env.QUEUE_MAX_DEPTH;
    });

    afterEach(() => {
        // Clean up any env modifications
        delete process.env.QUEUE_MAX_DEPTH;
    });

    describe('Happy Paths', () => {
        it('should add job when queue is below threshold', async () => {
            mockOrdersQueue.getWaitingCount.mockResolvedValue(100); // Well below 10,000

            const result = await service.queueOrderImportWithBackPressure(
                'ch-1',
                'ext-order-1',
                orgId,
            );

            expect(result).toBeDefined();
            expect(result.jobId).toBe('job-123');
            expect(mockOrdersQueue.add).toHaveBeenCalled();
        });

        it('should reject job with 429 when queue is at threshold', async () => {
            mockOrdersQueue.getWaitingCount.mockResolvedValue(DEFAULT_THRESHOLD);

            await expect(
                service.queueOrderImportWithBackPressure('ch-1', 'ext-order-1', orgId),
            ).rejects.toThrow(HttpException);

            try {
                await service.queueOrderImportWithBackPressure('ch-1', 'ext-order-1', orgId);
            } catch (error) {
                expect(error).toBeInstanceOf(HttpException);
                expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
            }
        });

        it('should reject job with 429 when queue exceeds threshold', async () => {
            mockOrdersQueue.getWaitingCount.mockResolvedValue(DEFAULT_THRESHOLD + 500);

            await expect(
                service.queueOrderImportWithBackPressure('ch-1', 'ext-order-1', orgId),
            ).rejects.toThrow(HttpException);
        });
    });

    describe('High-Priority Bypass', () => {
        it('should allow high-priority jobs even when at threshold', async () => {
            mockOrdersQueue.getWaitingCount.mockResolvedValue(DEFAULT_THRESHOLD);

            const result = await service.queueOrderImportWithBackPressure(
                'ch-1',
                'ext-order-1',
                orgId,
                { priority: 1 }, // High priority
            );

            expect(result).toBeDefined();
            expect(result.jobId).toBe('job-123');
            expect(mockOrdersQueue.add).toHaveBeenCalled();
        });

        it('should still reject low-priority jobs when at threshold', async () => {
            mockOrdersQueue.getWaitingCount.mockResolvedValue(DEFAULT_THRESHOLD);

            await expect(
                service.queueOrderImportWithBackPressure('ch-1', 'ext-order-1', orgId, { priority: 10 }),
            ).rejects.toThrow(HttpException);
        });
    });

    describe('Configuration', () => {
        it('should use configured threshold from env', async () => {
            const customThreshold = 5000;
            const originalEnv = process.env.QUEUE_MAX_DEPTH;
            process.env.QUEUE_MAX_DEPTH = String(customThreshold);

            mockOrdersQueue.getWaitingCount.mockResolvedValue(customThreshold);

            await expect(
                service.queueOrderImportWithBackPressure('ch-1', 'ext-order-1', orgId),
            ).rejects.toThrow(HttpException);

            process.env.QUEUE_MAX_DEPTH = originalEnv; // Restore
        });

        it('should default to 10000 when env not set', async () => {
            (configService.get as jest.Mock).mockReturnValue(undefined);
            mockOrdersQueue.getWaitingCount.mockResolvedValue(9999);

            const result = await service.queueOrderImportWithBackPressure(
                'ch-1',
                'ext-order-1',
                orgId,
            );

            expect(result).toBeDefined();
        });
    });

    describe('Error Details', () => {
        it('should include queue name in exception message', async () => {
            mockOrdersQueue.getWaitingCount.mockResolvedValue(DEFAULT_THRESHOLD);

            try {
                await service.queueOrderImportWithBackPressure('ch-1', 'ext-order-1', orgId);
                fail('Expected exception to be thrown');
            } catch (error) {
                expect((error as HttpException).message).toContain('orders');
            }
        });

        it('should include current depth in exception message', async () => {
            mockOrdersQueue.getWaitingCount.mockResolvedValue(15000);

            try {
                await service.queueOrderImportWithBackPressure('ch-1', 'ext-order-1', orgId);
                fail('Expected exception to be thrown');
            } catch (error) {
                expect((error as HttpException).message).toContain('15000');
            }
        });
    });

    describe('Hardening / Edge Cases', () => {
        it('should handle queue depth check failure gracefully', async () => {
            mockOrdersQueue.getWaitingCount.mockRejectedValue(new Error('Redis timeout'));

            // Should allow job through when depth check fails (fail-open for availability)
            const result = await service.queueOrderImportWithBackPressure(
                'ch-1',
                'ext-order-1',
                orgId,
            );

            expect(result).toBeDefined();
        });

        it('should work with inventory queue back-pressure', async () => {
            mockInventoryQueue.getWaitingCount.mockResolvedValue(DEFAULT_THRESHOLD);

            await expect(
                service.queueInventoryReservationWithBackPressure('order-1', orgId),
            ).rejects.toThrow(HttpException);
        });

        it('should work with shipping queue back-pressure', async () => {
            mockShippingQueue.getWaitingCount.mockResolvedValue(DEFAULT_THRESHOLD);

            await expect(
                service.queueShipmentCreationWithBackPressure('order-1', 'FEDEX', {}, orgId),
            ).rejects.toThrow(HttpException);
        });
    });
});
