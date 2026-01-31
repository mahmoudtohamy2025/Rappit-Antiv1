/**
 * Order Cancellation Service (ORD-03)
 * 
 * Handles order cancellations with automatic inventory release.
 * 
 * Features:
 * - Validates cancellation is allowed (PENDING/CONFIRMED/PROCESSING only)
 * - Releases reserved inventory atomically
 * - Idempotent handling of already-cancelled orders
 * - Cross-org isolation
 * - Audit event emission
 * 
 * State Rules:
 * - PENDING/CONFIRMED/PROCESSING → can cancel, release inventory
 * - SHIPPED/DELIVERED → cannot cancel
 * - CANCELLED → idempotent success
 */

import {
    Injectable,
    Logger,
    Inject,
    BadRequestException,
    NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { OrderStatus } from './order-state-machine';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Cancellation reasons
 */
export enum CancellationReason {
    CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
    OUT_OF_STOCK = 'OUT_OF_STOCK',
    FRAUD_SUSPECTED = 'FRAUD_SUSPECTED',
    PAYMENT_FAILED = 'PAYMENT_FAILED',
    DUPLICATE_ORDER = 'DUPLICATE_ORDER',
    OTHER = 'OTHER',
}

/**
 * Input for cancellation
 */
export interface CancellationInput {
    orderId: string;
    organizationId: string;
    reason: CancellationReason;
    note?: string;
    source?: 'SHOPIFY' | 'WOOCOMMERCE' | 'ADMIN' | 'API';
}

/**
 * Result of cancellation
 */
export interface CancellationResult {
    cancelled: boolean;
    alreadyCancelled?: boolean;
    inventoryReleased: boolean;
    reason: CancellationReason;
    orderId: string;
    previousStatus?: OrderStatus;
}

/**
 * Inventory service interface
 */
interface InventoryService {
    releaseForOrder(params: {
        orderId: string;
        lineItems: Array<{ sku: string; quantity: number }>;
    }): Promise<{ success: boolean }>;
}

/**
 * Cancellable order statuses
 */
const CANCELLABLE_STATUSES: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
];

@Injectable()
export class OrderCancellationService {
    private readonly logger = new Logger(OrderCancellationService.name);

    constructor(
        private readonly prisma: PrismaService,
        @Inject('InventoryService') private readonly inventoryService: InventoryService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Cancel an order with inventory release
     */
    async cancelOrder(input: CancellationInput): Promise<CancellationResult> {
        this.logger.debug(`Processing cancellation for order ${input.orderId}`);

        return await this.prisma.$transaction(async (tx) => {
            // Find order scoped to organization
            const order = await tx.order.findFirst({
                where: {
                    id: input.orderId,
                    organizationId: input.organizationId,
                },
                include: {
                    lineItems: true,
                },
            });

            if (!order) {
                throw new NotFoundException(
                    `Order ${input.orderId} not found in organization ${input.organizationId}`
                );
            }

            // Handle already cancelled (idempotent)
            if (order.status === OrderStatus.CANCELLED) {
                this.logger.debug(`Order ${input.orderId} already cancelled`);
                return {
                    cancelled: true,
                    alreadyCancelled: true,
                    inventoryReleased: false,
                    reason: input.reason,
                    orderId: order.id,
                    previousStatus: OrderStatus.CANCELLED,
                };
            }

            // Validate cancellation is allowed
            if (!this.canCancel(order.status as OrderStatus)) {
                throw new BadRequestException(
                    `Cannot cancel order with status ${order.status}. ` +
                    `Only orders in PENDING, CONFIRMED, or PROCESSING status can be cancelled.`
                );
            }

            const previousStatus = order.status as OrderStatus;
            let inventoryReleased = false;

            // Release inventory if it was reserved
            if (order.inventoryReserved && order.lineItems?.length > 0) {
                await this.inventoryService.releaseForOrder({
                    orderId: order.id,
                    lineItems: order.lineItems.map((item: any) => ({
                        sku: item.sku,
                        quantity: item.quantity,
                    })),
                });
                inventoryReleased = true;
            }

            // Update order status
            await tx.order.update({
                where: { id: order.id },
                data: {
                    status: OrderStatus.CANCELLED,
                    inventoryReserved: false,
                    cancellationReason: input.reason,
                    cancelledAt: new Date(),
                    updatedAt: new Date(),
                },
            });

            // Emit audit event
            this.eventEmitter.emit('order.cancelled', {
                orderId: order.id,
                organizationId: order.organizationId,
                previousStatus,
                newStatus: OrderStatus.CANCELLED,
                reason: input.reason,
                source: input.source,
                inventoryReleased,
                lineItems: order.lineItems?.map((item: any) => ({
                    sku: item.sku,
                    quantity: item.quantity,
                })),
                timestamp: new Date(),
            });

            this.logger.log(
                `Cancelled order ${order.id} (${previousStatus} → CANCELLED), ` +
                `inventory released: ${inventoryReleased}`
            );

            return {
                cancelled: true,
                inventoryReleased,
                reason: input.reason,
                orderId: order.id,
                previousStatus,
            };
        });
    }

    /**
     * Check if an order status allows cancellation
     */
    private canCancel(status: OrderStatus): boolean {
        return CANCELLABLE_STATUSES.includes(status);
    }
}
