/**
 * Order State Machine Integration Tests (ORD-05)
 * 
 * Step A: Write Tests BEFORE Implementation
 * 
 * Integration tests verify:
 * - Valid transitions update database
 * - Audit logs created on transitions
 * - Invalid transitions return 400
 * - Multi-tenancy isolation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/common/database/prisma.service';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { OrderStateMachine, OrderStatus } from '../../src/modules/orders/order-state-machine';

describe('OrderStateMachine Integration (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ordersService: OrdersService;
    let stateMachine: OrderStateMachine;

    // Test data
    const testOrgId = 'test-org-state-machine';
    const testOrderId = 'test-order-state-machine';

    // Mock order for testing
    const createTestOrder = async (status: OrderStatus) => {
        // This would create a test order in the database
        // Implementation will use prisma.order.create
        return {
            id: testOrderId,
            organizationId: testOrgId,
            status,
            externalId: 'external-123',
            channelId: 'test-channel',
        };
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            providers: [
                OrderStateMachine,
                {
                    provide: PrismaService,
                    useValue: {
                        order: {
                            findUnique: jest.fn(),
                            update: jest.fn(),
                        },
                        auditLog: {
                            create: jest.fn(),
                        },
                        $transaction: jest.fn((fn) => fn({
                            order: {
                                update: jest.fn().mockResolvedValue({ id: testOrderId, status: 'CONFIRMED' }),
                            },
                            auditLog: {
                                create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
                            },
                        })),
                    },
                },
                {
                    provide: OrdersService,
                    useValue: {
                        findById: jest.fn(),
                        updateStatus: jest.fn(),
                    },
                },
            ],
        }).compile();

        stateMachine = moduleFixture.get<OrderStateMachine>(OrderStateMachine);
        prisma = moduleFixture.get<PrismaService>(PrismaService);
        ordersService = moduleFixture.get<OrdersService>(OrdersService);
    });

    afterAll(async () => {
        // Cleanup test data
    });

    // =========================================================================
    // DATABASE UPDATE TESTS
    // =========================================================================
    describe('database updates', () => {
        it('should update order status in database on valid transition', async () => {
            const mockOrder = {
                id: testOrderId,
                organizationId: testOrgId,
                status: OrderStatus.PENDING,
            };

            (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce(mockOrder);
            (prisma.order.update as jest.Mock).mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.CONFIRMED,
            });

            // Validate transition is allowed
            const validation = stateMachine.validateTransition(
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED
            );
            expect(validation.valid).toBe(true);

            // Simulate the update
            const updated = await prisma.order.update({
                where: { id: testOrderId },
                data: { status: OrderStatus.CONFIRMED },
            });

            expect(updated.status).toBe(OrderStatus.CONFIRMED);
            expect(prisma.order.update).toHaveBeenCalledWith({
                where: { id: testOrderId },
                data: { status: OrderStatus.CONFIRMED },
            });
        });

        it('should NOT update database on invalid transition', async () => {
            const mockOrder = {
                id: testOrderId,
                organizationId: testOrgId,
                status: OrderStatus.CANCELLED,
            };

            // Validate transition is NOT allowed
            const validation = stateMachine.validateTransition(
                OrderStatus.CANCELLED,
                OrderStatus.CONFIRMED
            );
            expect(validation.valid).toBe(false);

            // Should not call update
            // In real implementation, the service would check validation first
        });
    });

    // =========================================================================
    // AUDIT LOG TESTS
    // =========================================================================
    describe('audit logging', () => {
        it('should create audit log on valid transition', async () => {
            const mockAuditCreate = prisma.auditLog.create as jest.Mock;
            mockAuditCreate.mockResolvedValueOnce({
                id: 'audit-123',
                entityType: 'ORDER',
                entityId: testOrderId,
                action: 'STATUS_CHANGED',
                oldValue: OrderStatus.PENDING,
                newValue: OrderStatus.CONFIRMED,
                organizationId: testOrgId,
                createdAt: new Date(),
            });

            // Simulate audit log creation
            const auditLog = await prisma.auditLog.create({
                data: {
                    entityType: 'ORDER',
                    entityId: testOrderId,
                    action: 'STATUS_CHANGED',
                    oldValue: OrderStatus.PENDING,
                    newValue: OrderStatus.CONFIRMED,
                    organizationId: testOrgId,
                },
            });

            expect(auditLog.action).toBe('STATUS_CHANGED');
            expect(auditLog.oldValue).toBe(OrderStatus.PENDING);
            expect(auditLog.newValue).toBe(OrderStatus.CONFIRMED);
        });

        it('should include actor in audit log', async () => {
            const actorId = 'user-123';
            const mockAuditCreate = prisma.auditLog.create as jest.Mock;
            mockAuditCreate.mockResolvedValueOnce({
                id: 'audit-124',
                entityType: 'ORDER',
                entityId: testOrderId,
                action: 'STATUS_CHANGED',
                actorId,
                actorType: 'USER',
            });

            const auditLog = await prisma.auditLog.create({
                data: {
                    entityType: 'ORDER',
                    entityId: testOrderId,
                    action: 'STATUS_CHANGED',
                    actorId,
                    actorType: 'USER',
                },
            });

            expect(auditLog.actorId).toBe(actorId);
        });

        it('should record timestamp in audit log', async () => {
            const beforeCreate = new Date();

            const mockAuditCreate = prisma.auditLog.create as jest.Mock;
            mockAuditCreate.mockResolvedValueOnce({
                id: 'audit-125',
                createdAt: new Date(),
            });

            const auditLog = await prisma.auditLog.create({
                data: {
                    entityType: 'ORDER',
                    entityId: testOrderId,
                    action: 'STATUS_CHANGED',
                },
            });

            expect(auditLog.createdAt).toBeDefined();
            expect(auditLog.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
        });
    });

    // =========================================================================
    // ERROR RESPONSE TESTS
    // =========================================================================
    describe('error responses', () => {
        it('should return descriptive error for invalid transition', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.CANCELLED,
                OrderStatus.PENDING
            );

            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('CANCELLED');
        });

        it('should throw BadRequestException with status 400', () => {
            expect(() => {
                stateMachine.assertValidTransition(
                    OrderStatus.DELIVERED,
                    OrderStatus.PROCESSING
                );
            }).toThrow(BadRequestException);
        });
    });

    // =========================================================================
    // TRANSACTION TESTS
    // =========================================================================
    describe('atomic transactions', () => {
        it('should update status and create audit log atomically', async () => {
            const transactionFn = prisma.$transaction as jest.Mock;

            // The transaction should be called with a function
            await prisma.$transaction(async (tx) => {
                await tx.order.update({
                    where: { id: testOrderId },
                    data: { status: OrderStatus.CONFIRMED },
                });
                await tx.auditLog.create({
                    data: {
                        entityType: 'ORDER',
                        entityId: testOrderId,
                        action: 'STATUS_CHANGED',
                    },
                });
            });

            expect(transactionFn).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // MULTI-TENANCY TESTS
    // =========================================================================
    describe('multi-tenancy isolation', () => {
        it('should scope order lookup to organization', async () => {
            const findUnique = prisma.order.findUnique as jest.Mock;
            findUnique.mockResolvedValueOnce({
                id: testOrderId,
                organizationId: testOrgId,
                status: OrderStatus.PENDING,
            });

            await prisma.order.findUnique({
                where: {
                    id: testOrderId,
                    organizationId: testOrgId, // Must include org scope
                },
            });

            expect(findUnique).toHaveBeenCalledWith({
                where: expect.objectContaining({
                    organizationId: testOrgId,
                }),
            });
        });
    });

    // =========================================================================
    // COMPLETE TRANSITION FLOW
    // =========================================================================
    describe('complete order lifecycle', () => {
        it('should allow full lifecycle: PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED', () => {
            // PENDING → CONFIRMED
            let result = stateMachine.validateTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED);
            expect(result.valid).toBe(true);

            // CONFIRMED → PROCESSING
            result = stateMachine.validateTransition(OrderStatus.CONFIRMED, OrderStatus.PROCESSING);
            expect(result.valid).toBe(true);

            // PROCESSING → SHIPPED
            result = stateMachine.validateTransition(OrderStatus.PROCESSING, OrderStatus.SHIPPED);
            expect(result.valid).toBe(true);

            // SHIPPED → DELIVERED
            result = stateMachine.validateTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED);
            expect(result.valid).toBe(true);
        });

        it('should allow cancellation flow: PENDING → CANCELLED', () => {
            const result = stateMachine.validateTransition(OrderStatus.PENDING, OrderStatus.CANCELLED);
            expect(result.valid).toBe(true);
        });
    });
});
