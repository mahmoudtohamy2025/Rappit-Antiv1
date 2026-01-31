/**
 * Order State Machine Unit Tests (ORD-05)
 * 
 * Step A: Write Tests BEFORE Implementation
 * 
 * Tests cover:
 * - All valid transitions (happy paths)
 * - All invalid transitions (forbidden behavior)
 * - Terminal states (CANCELLED, DELIVERED)
 * - Backwards transitions rejected
 * - Edge cases
 * 
 * State Machine:
 * PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
 *     ↓         ↓            ↓
 *  CANCELLED  CANCELLED   CANCELLED
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrderStateMachine, OrderStatus, OrderTransitionResult } from '../../src/modules/orders/order-state-machine';

describe('OrderStateMachine', () => {
    let stateMachine: OrderStateMachine;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [OrderStateMachine],
        }).compile();

        stateMachine = module.get<OrderStateMachine>(OrderStateMachine);
    });

    // =========================================================================
    // VALID TRANSITIONS (Happy Paths)
    // =========================================================================
    describe('valid transitions', () => {
        it('should allow PENDING → CONFIRMED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED
            );
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should allow CONFIRMED → PROCESSING', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.CONFIRMED,
                OrderStatus.PROCESSING
            );
            expect(result.valid).toBe(true);
        });

        it('should allow PROCESSING → SHIPPED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PROCESSING,
                OrderStatus.SHIPPED
            );
            expect(result.valid).toBe(true);
        });

        it('should allow SHIPPED → DELIVERED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.SHIPPED,
                OrderStatus.DELIVERED
            );
            expect(result.valid).toBe(true);
        });

        it('should allow PENDING → CANCELLED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PENDING,
                OrderStatus.CANCELLED
            );
            expect(result.valid).toBe(true);
        });

        it('should allow CONFIRMED → CANCELLED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.CONFIRMED,
                OrderStatus.CANCELLED
            );
            expect(result.valid).toBe(true);
        });

        it('should allow PROCESSING → CANCELLED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PROCESSING,
                OrderStatus.CANCELLED
            );
            expect(result.valid).toBe(true);
        });
    });

    // =========================================================================
    // TERMINAL STATES (Cannot transition FROM these)
    // =========================================================================
    describe('terminal states', () => {
        it('should reject CANCELLED → PENDING', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.CANCELLED,
                OrderStatus.PENDING
            );
            expect(result.valid).toBe(false);
            expect(result.error).toContain('terminal');
        });

        it('should reject CANCELLED → CONFIRMED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.CANCELLED,
                OrderStatus.CONFIRMED
            );
            expect(result.valid).toBe(false);
        });

        it('should reject CANCELLED → PROCESSING', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.CANCELLED,
                OrderStatus.PROCESSING
            );
            expect(result.valid).toBe(false);
        });

        it('should reject CANCELLED → SHIPPED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.CANCELLED,
                OrderStatus.SHIPPED
            );
            expect(result.valid).toBe(false);
        });

        it('should reject CANCELLED → DELIVERED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.CANCELLED,
                OrderStatus.DELIVERED
            );
            expect(result.valid).toBe(false);
        });

        it('should reject DELIVERED → PENDING', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.DELIVERED,
                OrderStatus.PENDING
            );
            expect(result.valid).toBe(false);
            expect(result.error).toContain('terminal');
        });

        it('should reject DELIVERED → CONFIRMED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.DELIVERED,
                OrderStatus.CONFIRMED
            );
            expect(result.valid).toBe(false);
        });

        it('should reject DELIVERED → PROCESSING', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.DELIVERED,
                OrderStatus.PROCESSING
            );
            expect(result.valid).toBe(false);
        });

        it('should reject DELIVERED → SHIPPED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.DELIVERED,
                OrderStatus.SHIPPED
            );
            expect(result.valid).toBe(false);
        });

        it('should reject DELIVERED → CANCELLED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.DELIVERED,
                OrderStatus.CANCELLED
            );
            expect(result.valid).toBe(false);
        });
    });

    // =========================================================================
    // SHIPPED CANNOT BE CANCELLED
    // =========================================================================
    describe('shipped cannot be cancelled', () => {
        it('should reject SHIPPED → CANCELLED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.SHIPPED,
                OrderStatus.CANCELLED
            );
            expect(result.valid).toBe(false);
            expect(result.error).toContain('shipped');
        });
    });

    // =========================================================================
    // BACKWARDS TRANSITIONS REJECTED
    // =========================================================================
    describe('backwards transitions', () => {
        it('should reject CONFIRMED → PENDING', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.CONFIRMED,
                OrderStatus.PENDING
            );
            expect(result.valid).toBe(false);
            expect(result.error).toContain('backward');
        });

        it('should reject PROCESSING → CONFIRMED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PROCESSING,
                OrderStatus.CONFIRMED
            );
            expect(result.valid).toBe(false);
        });

        it('should reject PROCESSING → PENDING', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PROCESSING,
                OrderStatus.PENDING
            );
            expect(result.valid).toBe(false);
        });

        it('should reject SHIPPED → PROCESSING', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.SHIPPED,
                OrderStatus.PROCESSING
            );
            expect(result.valid).toBe(false);
        });

        it('should reject SHIPPED → CONFIRMED', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.SHIPPED,
                OrderStatus.CONFIRMED
            );
            expect(result.valid).toBe(false);
        });

        it('should reject SHIPPED → PENDING', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.SHIPPED,
                OrderStatus.PENDING
            );
            expect(result.valid).toBe(false);
        });
    });

    // =========================================================================
    // SAME STATE TRANSITIONS
    // =========================================================================
    describe('same state transitions', () => {
        it('should reject PENDING → PENDING (no-op)', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PENDING,
                OrderStatus.PENDING
            );
            expect(result.valid).toBe(false);
            expect(result.error).toContain('same');
        });

        it('should reject CONFIRMED → CONFIRMED (no-op)', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.CONFIRMED,
                OrderStatus.CONFIRMED
            );
            expect(result.valid).toBe(false);
        });
    });

    // =========================================================================
    // SKIP TRANSITIONS (Must follow sequence)
    // =========================================================================
    describe('skip transitions', () => {
        it('should reject PENDING → PROCESSING (skip CONFIRMED)', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PENDING,
                OrderStatus.PROCESSING
            );
            expect(result.valid).toBe(false);
        });

        it('should reject PENDING → SHIPPED (skip multiple)', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PENDING,
                OrderStatus.SHIPPED
            );
            expect(result.valid).toBe(false);
        });

        it('should reject PENDING → DELIVERED (skip all)', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PENDING,
                OrderStatus.DELIVERED
            );
            expect(result.valid).toBe(false);
        });

        it('should reject CONFIRMED → SHIPPED (skip PROCESSING)', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.CONFIRMED,
                OrderStatus.SHIPPED
            );
            expect(result.valid).toBe(false);
        });

        it('should reject CONFIRMED → DELIVERED (skip PROCESSING, SHIPPED)', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.CONFIRMED,
                OrderStatus.DELIVERED
            );
            expect(result.valid).toBe(false);
        });

        it('should reject PROCESSING → DELIVERED (skip SHIPPED)', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PROCESSING,
                OrderStatus.DELIVERED
            );
            expect(result.valid).toBe(false);
        });
    });

    // =========================================================================
    // HELPER METHODS
    // =========================================================================
    describe('helper methods', () => {
        it('should identify terminal states correctly', () => {
            expect(stateMachine.isTerminalState(OrderStatus.CANCELLED)).toBe(true);
            expect(stateMachine.isTerminalState(OrderStatus.DELIVERED)).toBe(true);
            expect(stateMachine.isTerminalState(OrderStatus.PENDING)).toBe(false);
            expect(stateMachine.isTerminalState(OrderStatus.CONFIRMED)).toBe(false);
            expect(stateMachine.isTerminalState(OrderStatus.PROCESSING)).toBe(false);
            expect(stateMachine.isTerminalState(OrderStatus.SHIPPED)).toBe(false);
        });

        it('should return valid transitions for each state', () => {
            const pendingTransitions = stateMachine.getValidTransitions(OrderStatus.PENDING);
            expect(pendingTransitions).toContain(OrderStatus.CONFIRMED);
            expect(pendingTransitions).toContain(OrderStatus.CANCELLED);
            expect(pendingTransitions).not.toContain(OrderStatus.PROCESSING);

            const confirmedTransitions = stateMachine.getValidTransitions(OrderStatus.CONFIRMED);
            expect(confirmedTransitions).toContain(OrderStatus.PROCESSING);
            expect(confirmedTransitions).toContain(OrderStatus.CANCELLED);

            const cancelledTransitions = stateMachine.getValidTransitions(OrderStatus.CANCELLED);
            expect(cancelledTransitions).toHaveLength(0);

            const deliveredTransitions = stateMachine.getValidTransitions(OrderStatus.DELIVERED);
            expect(deliveredTransitions).toHaveLength(0);
        });

        it('should check if state is cancellable', () => {
            expect(stateMachine.isCancellable(OrderStatus.PENDING)).toBe(true);
            expect(stateMachine.isCancellable(OrderStatus.CONFIRMED)).toBe(true);
            expect(stateMachine.isCancellable(OrderStatus.PROCESSING)).toBe(true);
            expect(stateMachine.isCancellable(OrderStatus.SHIPPED)).toBe(false);
            expect(stateMachine.isCancellable(OrderStatus.DELIVERED)).toBe(false);
            expect(stateMachine.isCancellable(OrderStatus.CANCELLED)).toBe(false);
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================
    describe('edge cases', () => {
        it('should handle invalid status values gracefully', () => {
            const result = stateMachine.validateTransition(
                'INVALID_STATUS' as OrderStatus,
                OrderStatus.CONFIRMED
            );
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid');
        });

        it('should handle null from status', () => {
            const result = stateMachine.validateTransition(
                null as any,
                OrderStatus.CONFIRMED
            );
            expect(result.valid).toBe(false);
        });

        it('should handle null to status', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PENDING,
                null as any
            );
            expect(result.valid).toBe(false);
        });

        it('should handle undefined from status', () => {
            const result = stateMachine.validateTransition(
                undefined as any,
                OrderStatus.CONFIRMED
            );
            expect(result.valid).toBe(false);
        });

        it('should handle undefined to status', () => {
            const result = stateMachine.validateTransition(
                OrderStatus.PENDING,
                undefined as any
            );
            expect(result.valid).toBe(false);
        });
    });

    // =========================================================================
    // TRANSITION WITH VALIDATION (throws exception)
    // =========================================================================
    describe('assertValidTransition', () => {
        it('should not throw for valid transitions', () => {
            expect(() => {
                stateMachine.assertValidTransition(
                    OrderStatus.PENDING,
                    OrderStatus.CONFIRMED
                );
            }).not.toThrow();
        });

        it('should throw BadRequestException for invalid transitions', () => {
            expect(() => {
                stateMachine.assertValidTransition(
                    OrderStatus.CANCELLED,
                    OrderStatus.PENDING
                );
            }).toThrow(BadRequestException);
        });

        it('should include descriptive error message', () => {
            try {
                stateMachine.assertValidTransition(
                    OrderStatus.DELIVERED,
                    OrderStatus.PENDING
                );
                fail('Should have thrown');
            } catch (error) {
                expect(error.message).toContain('DELIVERED');
                expect(error.message).toContain('PENDING');
            }
        });
    });
});
