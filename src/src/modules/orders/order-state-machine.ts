/**
 * Order State Machine (ORD-05)
 * 
 * Implements strict order status transition validation:
 * 
 * Valid Flow:
 * PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
 *     ↓         ↓            ↓
 *  CANCELLED  CANCELLED   CANCELLED
 * 
 * Rules:
 * - Terminal states (CANCELLED, DELIVERED) cannot transition
 * - SHIPPED cannot be cancelled (already in transit)
 * - Backwards transitions not allowed
 * - Skip transitions not allowed (must follow sequence)
 * - Same-state transitions not allowed
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';

/**
 * Order status enum
 */
export enum OrderStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    PROCESSING = 'PROCESSING',
    SHIPPED = 'SHIPPED',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED',
}

/**
 * Result of transition validation
 */
export interface OrderTransitionResult {
    valid: boolean;
    error?: string;
}

/**
 * Transition matrix defining valid state transitions
 * Key: from status, Value: array of valid "to" statuses
 */
const TRANSITION_MATRIX: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED], // Cannot cancel after shipped
    [OrderStatus.DELIVERED]: [], // Terminal state
    [OrderStatus.CANCELLED]: [], // Terminal state
};

/**
 * Terminal states that cannot transition to any other state
 */
const TERMINAL_STATES: OrderStatus[] = [
    OrderStatus.CANCELLED,
    OrderStatus.DELIVERED,
];

/**
 * States that can be cancelled
 */
const CANCELLABLE_STATES: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
];

/**
 * State order for detecting backwards transitions
 */
const STATE_ORDER: Record<OrderStatus, number> = {
    [OrderStatus.PENDING]: 0,
    [OrderStatus.CONFIRMED]: 1,
    [OrderStatus.PROCESSING]: 2,
    [OrderStatus.SHIPPED]: 3,
    [OrderStatus.DELIVERED]: 4,
    [OrderStatus.CANCELLED]: -1, // Special case
};

@Injectable()
export class OrderStateMachine {
    private readonly logger = new Logger(OrderStateMachine.name);

    /**
     * Validate if a transition from one status to another is allowed
     */
    validateTransition(from: OrderStatus, to: OrderStatus): OrderTransitionResult {
        // Handle null/undefined
        if (!from || !to) {
            return {
                valid: false,
                error: 'Invalid status: from and to status are required',
            };
        }

        // Validate status values
        if (!this.isValidStatus(from)) {
            return {
                valid: false,
                error: `Invalid from status: ${from} is not a valid order status`,
            };
        }

        if (!this.isValidStatus(to)) {
            return {
                valid: false,
                error: `Invalid to status: ${to} is not a valid order status`,
            };
        }

        // Same state transition not allowed
        if (from === to) {
            return {
                valid: false,
                error: `Cannot transition to same status: ${from}`,
            };
        }

        // Terminal states cannot transition
        if (this.isTerminalState(from)) {
            return {
                valid: false,
                error: `Cannot transition from terminal state: ${from}`,
            };
        }

        // Check if SHIPPED trying to cancel
        if (from === OrderStatus.SHIPPED && to === OrderStatus.CANCELLED) {
            return {
                valid: false,
                error: 'Cannot cancel order after shipped: package is already in transit',
            };
        }

        // Check for backwards transitions (excluding cancellation)
        if (to !== OrderStatus.CANCELLED) {
            const fromOrder = STATE_ORDER[from];
            const toOrder = STATE_ORDER[to];

            if (toOrder < fromOrder) {
                return {
                    valid: false,
                    error: `Cannot transition backward from ${from} to ${to}`,
                };
            }

            // Check for skip transitions (e.g., PENDING → PROCESSING skipping CONFIRMED)
            if (toOrder > fromOrder + 1) {
                return {
                    valid: false,
                    error: `Cannot skip states: must transition from ${from} to ${this.getNextState(from)} first`,
                };
            }
        }

        // Check transition matrix
        const validTransitions = TRANSITION_MATRIX[from] || [];
        if (!validTransitions.includes(to)) {
            return {
                valid: false,
                error: `Invalid transition from ${from} to ${to}`,
            };
        }

        return { valid: true };
    }

    /**
     * Assert that a transition is valid, throwing BadRequestException if not
     */
    assertValidTransition(from: OrderStatus, to: OrderStatus): void {
        const result = this.validateTransition(from, to);

        if (!result.valid) {
            this.logger.warn(`Rejected transition: ${from} → ${to}: ${result.error}`);
            throw new BadRequestException(
                `Invalid order transition: ${from} → ${to}. ${result.error}`
            );
        }
    }

    /**
     * Check if a status is a valid OrderStatus value
     */
    isValidStatus(status: string | OrderStatus): boolean {
        return Object.values(OrderStatus).includes(status as OrderStatus);
    }

    /**
     * Check if a status is a terminal state (cannot transition further)
     */
    isTerminalState(status: OrderStatus): boolean {
        return TERMINAL_STATES.includes(status);
    }

    /**
     * Get all valid transitions from a given status
     */
    getValidTransitions(from: OrderStatus): OrderStatus[] {
        return TRANSITION_MATRIX[from] || [];
    }

    /**
     * Check if an order in the given status can be cancelled
     */
    isCancellable(status: OrderStatus): boolean {
        return CANCELLABLE_STATES.includes(status);
    }

    /**
     * Get the next state in the normal flow (excluding cancellation)
     */
    getNextState(status: OrderStatus): OrderStatus | null {
        switch (status) {
            case OrderStatus.PENDING:
                return OrderStatus.CONFIRMED;
            case OrderStatus.CONFIRMED:
                return OrderStatus.PROCESSING;
            case OrderStatus.PROCESSING:
                return OrderStatus.SHIPPED;
            case OrderStatus.SHIPPED:
                return OrderStatus.DELIVERED;
            default:
                return null;
        }
    }

    /**
     * Get the previous state in the normal flow
     */
    getPreviousState(status: OrderStatus): OrderStatus | null {
        switch (status) {
            case OrderStatus.CONFIRMED:
                return OrderStatus.PENDING;
            case OrderStatus.PROCESSING:
                return OrderStatus.CONFIRMED;
            case OrderStatus.SHIPPED:
                return OrderStatus.PROCESSING;
            case OrderStatus.DELIVERED:
                return OrderStatus.SHIPPED;
            default:
                return null;
        }
    }

    /**
     * Get all possible statuses
     */
    getAllStatuses(): OrderStatus[] {
        return Object.values(OrderStatus);
    }

    /**
     * Get display name for a status
     */
    getStatusDisplayName(status: OrderStatus): string {
        const displayNames: Record<OrderStatus, string> = {
            [OrderStatus.PENDING]: 'Pending',
            [OrderStatus.CONFIRMED]: 'Confirmed',
            [OrderStatus.PROCESSING]: 'Processing',
            [OrderStatus.SHIPPED]: 'Shipped',
            [OrderStatus.DELIVERED]: 'Delivered',
            [OrderStatus.CANCELLED]: 'Cancelled',
        };
        return displayNames[status] || status;
    }
}
