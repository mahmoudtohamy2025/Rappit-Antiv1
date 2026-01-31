/**
 * BillingAuditService Unit Tests (BILL-05)
 * 
 * Tests billing audit logging functionality:
 * - Log entry creation with correct fields
 * - Timestamps recorded correctly
 * - Query by organization
 * - Query by date range
 */

import { BillingAuditService, BillingAuditAction } from '../../src/modules/billing/billing-audit.service';

describe('BillingAuditService', () => {
    let service: BillingAuditService;
    let mockPrisma: any;

    beforeEach(() => {
        mockPrisma = {
            billingAuditLog: {
                create: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                count: jest.fn(),
            },
        };

        service = new BillingAuditService(mockPrisma);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('log', () => {
        it('should create log entry with correct fields', async () => {
            const input = {
                organizationId: 'org-123',
                action: BillingAuditAction.SUBSCRIPTION_CREATED,
                previousValue: { plan: null },
                newValue: { plan: 'pro' },
                metadata: { stripeEventId: 'evt_123' },
                performedBy: 'stripe',
            };

            const mockCreated = {
                id: 'log-1',
                ...input,
                createdAt: new Date(),
            };

            mockPrisma.billingAuditLog.create.mockResolvedValue(mockCreated);

            const result = await service.log(input);

            expect(mockPrisma.billingAuditLog.create).toHaveBeenCalledWith({
                data: {
                    organizationId: 'org-123',
                    action: 'subscription.created',
                    previousValue: { plan: null },
                    newValue: { plan: 'pro' },
                    metadata: { stripeEventId: 'evt_123' },
                    performedBy: 'stripe',
                },
            });
            expect(result).toEqual(mockCreated);
        });

        it('should default performedBy to "system"', async () => {
            const input = {
                organizationId: 'org-123',
                action: BillingAuditAction.TRIAL_EXPIRED,
            };

            mockPrisma.billingAuditLog.create.mockResolvedValue({ id: 'log-1' });

            await service.log(input);

            expect(mockPrisma.billingAuditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    performedBy: 'system',
                }),
            });
        });

        it('should record timestamp via createdAt default', async () => {
            const beforeTime = new Date();

            mockPrisma.billingAuditLog.create.mockImplementation(({ data }) => {
                return Promise.resolve({
                    ...data,
                    id: 'log-1',
                    createdAt: new Date(), // Prisma adds this automatically
                });
            });

            const result = await service.log({
                organizationId: 'org-123',
                action: BillingAuditAction.PAYMENT_SUCCEEDED,
            });

            expect(result.createdAt).toBeDefined();
            expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        });
    });

    describe('logStatusChange', () => {
        it('should log status change with previous and new status', async () => {
            mockPrisma.billingAuditLog.create.mockResolvedValue({ id: 'log-1' });

            await service.logStatusChange(
                'org-123',
                'TRIAL',
                'ACTIVE',
                { stripeEventId: 'evt_456' },
                'stripe',
            );

            expect(mockPrisma.billingAuditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    organizationId: 'org-123',
                    action: BillingAuditAction.STATUS_CHANGED,
                    previousValue: { subscriptionStatus: 'TRIAL' },
                    newValue: { subscriptionStatus: 'ACTIVE' },
                    performedBy: 'stripe',
                }),
            });
        });
    });

    describe('findByOrganization', () => {
        it('should query logs by organization with pagination', async () => {
            const mockLogs = [
                { id: 'log-1', action: 'subscription.created' },
                { id: 'log-2', action: 'payment.succeeded' },
            ];

            mockPrisma.billingAuditLog.findMany.mockResolvedValue(mockLogs);
            mockPrisma.billingAuditLog.count.mockResolvedValue(25);

            const result = await service.findByOrganization('org-123', { page: 1, limit: 20 });

            expect(mockPrisma.billingAuditLog.findMany).toHaveBeenCalledWith({
                where: { organizationId: 'org-123' },
                orderBy: { createdAt: 'desc' },
                skip: 0,
                take: 20,
            });

            expect(result.data).toEqual(mockLogs);
            expect(result.pagination.total).toBe(25);
            expect(result.pagination.totalPages).toBe(2);
        });

        it('should enforce max limit of 100', async () => {
            mockPrisma.billingAuditLog.findMany.mockResolvedValue([]);
            mockPrisma.billingAuditLog.count.mockResolvedValue(0);

            await service.findByOrganization('org-123', { page: 1, limit: 500 });

            expect(mockPrisma.billingAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 100, // Max enforced
                }),
            );
        });
    });

    describe('findByDateRange', () => {
        it('should query logs by date range', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            mockPrisma.billingAuditLog.findMany.mockResolvedValue([]);
            mockPrisma.billingAuditLog.count.mockResolvedValue(0);

            const result = await service.findByDateRange(
                'org-123',
                { startDate, endDate },
                { page: 1, limit: 20 },
            );

            expect(mockPrisma.billingAuditLog.findMany).toHaveBeenCalledWith({
                where: {
                    organizationId: 'org-123',
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: 0,
                take: 20,
            });

            expect(result.dateRange.startDate).toBe(startDate.toISOString());
            expect(result.dateRange.endDate).toBe(endDate.toISOString());
        });
    });

    describe('getLatestEvents', () => {
        it('should return latest events with default limit', async () => {
            const mockLogs = [{ id: 'log-1' }];
            mockPrisma.billingAuditLog.findMany.mockResolvedValue(mockLogs);

            const result = await service.getLatestEvents('org-123');

            expect(mockPrisma.billingAuditLog.findMany).toHaveBeenCalledWith({
                where: { organizationId: 'org-123' },
                orderBy: { createdAt: 'desc' },
                take: 10, // Default
            });
            expect(result).toEqual(mockLogs);
        });

        it('should enforce max limit of 50', async () => {
            mockPrisma.billingAuditLog.findMany.mockResolvedValue([]);

            await service.getLatestEvents('org-123', 200);

            expect(mockPrisma.billingAuditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 50, // Max enforced
                }),
            );
        });
    });

    describe('findByAction', () => {
        it('should filter logs by action type', async () => {
            mockPrisma.billingAuditLog.findMany.mockResolvedValue([]);
            mockPrisma.billingAuditLog.count.mockResolvedValue(0);

            await service.findByAction('org-123', BillingAuditAction.PAYMENT_FAILED);

            expect(mockPrisma.billingAuditLog.findMany).toHaveBeenCalledWith({
                where: {
                    organizationId: 'org-123',
                    action: 'invoice.payment_failed',
                },
                orderBy: { createdAt: 'desc' },
                skip: 0,
                take: 20,
            });
        });
    });

    describe('BillingAuditAction enum', () => {
        it('should have correct event type values', () => {
            expect(BillingAuditAction.SUBSCRIPTION_CREATED).toBe('subscription.created');
            expect(BillingAuditAction.SUBSCRIPTION_CANCELLED).toBe('subscription.cancelled');
            expect(BillingAuditAction.PAYMENT_SUCCEEDED).toBe('invoice.paid');
            expect(BillingAuditAction.PAYMENT_FAILED).toBe('invoice.payment_failed');
            expect(BillingAuditAction.TRIAL_STARTED).toBe('trial.started');
            expect(BillingAuditAction.TRIAL_EXPIRED).toBe('trial.expired');
            expect(BillingAuditAction.STATUS_CHANGED).toBe('status.changed');
        });
    });
});
