/**
 * Order Upsert Service (ORD-04)
 * 
 * Implements idempotent order creation/update with:
 * - Unique constraint on channel_id + external_id + organization_id
 * - Advisory locks for concurrent webhook handling
 * - Inventory reservation on first creation only
 * - Line item change detection
 * - Cross-org isolation
 * 
 * Flow:
 * 1. Acquire advisory lock on idempotency key
 * 2. Check if order exists
 * 3. If new: reserve inventory, create order
 * 4. If exists: optionally update, never re-reserve
 * 5. Release lock
 */

import { Injectable, BadRequestException, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { OrderStatus } from './order-state-machine';

/**
 * Line item input for order
 */
export interface LineItemInput {
    sku: string;
    quantity: number;
    price: number;
    name: string;
    variantId?: string;
}

/**
 * Input for order upsert
 */
export interface OrderUpsertInput {
    channelId: string;
    organizationId: string;
    externalId: string;
    externalOrderNumber: string;
    status: OrderStatus;
    totalAmount: number;
    currency: string;
    customerEmail?: string;
    customerName?: string;
    lineItems: LineItemInput[];
    shippingAddress?: Record<string, any>;
    billingAddress?: Record<string, any>;
    metadata?: Record<string, any>;
}

/**
 * Result of order upsert operation
 */
export interface OrderUpsertResult {
    order: any;
    created: boolean;
    updated: boolean;
    inventoryReserved: boolean;
    lineItemsChanged: boolean;
}

/**
 * Inventory service interface
 */
interface InventoryService {
    reserveForOrder(params: {
        organizationId: string;
        orderId: string;
        lineItems: Array<{ sku: string; quantity: number }>;
    }): Promise<{ success: boolean }>;
    releaseForOrder(params: { orderId: string }): Promise<void>;
}

@Injectable()
export class OrderUpsertService {
    private readonly logger = new Logger(OrderUpsertService.name);

    constructor(
        private readonly prisma: PrismaService,
        @Inject('InventoryService') private readonly inventoryService: InventoryService,
    ) { }

    /**
     * Upsert order with idempotency guarantee
     */
    async upsertOrder(input: OrderUpsertInput): Promise<OrderUpsertResult> {
        // Validate input
        this.validateInput(input);

        const idempotencyKey = this.generateIdempotencyKey(
            input.channelId,
            input.externalId
        );

        this.logger.debug(`Upserting order with key: ${idempotencyKey}`);

        // Use transaction with advisory lock for concurrency safety
        return await this.prisma.$transaction(async (tx) => {
            // Acquire advisory lock based on idempotency key hash
            await this.acquireAdvisoryLock(tx, idempotencyKey);

            // Check for existing order
            const existingOrder = await tx.order.findFirst({
                where: {
                    channelId: input.channelId,
                    externalId: input.externalId,
                    organizationId: input.organizationId,
                },
            });

            if (existingOrder) {
                return await this.handleExistingOrder(tx, existingOrder, input);
            } else {
                return await this.handleNewOrder(tx, input);
            }
        });
    }

    /**
     * Handle creating a new order
     */
    private async handleNewOrder(
        tx: any,
        input: OrderUpsertInput
    ): Promise<OrderUpsertResult> {
        this.logger.debug(`Creating new order for ${input.externalId}`);

        // Reserve inventory FIRST (before creating order)
        const reservationResult = await this.inventoryService.reserveForOrder({
            organizationId: input.organizationId,
            orderId: `pending-${input.externalId}`, // Temporary ID
            lineItems: input.lineItems.map(item => ({
                sku: item.sku,
                quantity: item.quantity,
            })),
        });

        if (!reservationResult.success) {
            throw new BadRequestException('Failed to reserve inventory');
        }

        // Create order with line items
        const order = await tx.order.create({
            data: {
                channelId: input.channelId,
                organizationId: input.organizationId,
                externalId: input.externalId,
                externalOrderNumber: input.externalOrderNumber,
                status: input.status,
                totalAmount: input.totalAmount,
                currency: input.currency,
                customerEmail: input.customerEmail,
                customerName: input.customerName,
                shippingAddress: input.shippingAddress,
                billingAddress: input.billingAddress,
                metadata: input.metadata,
                inventoryReserved: true,
                lineItems: {
                    create: input.lineItems.map(item => ({
                        sku: item.sku,
                        quantity: item.quantity,
                        price: item.price,
                        name: item.name,
                        variantId: item.variantId,
                    })),
                },
            },
            include: {
                lineItems: true,
            },
        });

        this.logger.log(`Created order ${order.id} for external ${input.externalId}`);

        return {
            order,
            created: true,
            updated: false,
            inventoryReserved: true,
            lineItemsChanged: false,
        };
    }

    /**
     * Handle existing order (update or return as-is)
     */
    private async handleExistingOrder(
        tx: any,
        existingOrder: any,
        input: OrderUpsertInput
    ): Promise<OrderUpsertResult> {
        this.logger.debug(`Found existing order ${existingOrder.id} for ${input.externalId}`);

        // Check if anything has changed
        const hasChanges = this.detectChanges(existingOrder, input);

        // Check if line items changed
        const existingLineItems = await tx.orderLineItem.findMany({
            where: { orderId: existingOrder.id },
        });
        const lineItemsChanged = this.detectLineItemChanges(existingLineItems, input.lineItems);

        if (!hasChanges && !lineItemsChanged) {
            // Nothing changed - return existing
            return {
                order: existingOrder,
                created: false,
                updated: false,
                inventoryReserved: existingOrder.inventoryReserved,
                lineItemsChanged: false,
            };
        }

        // Update order (but DO NOT re-reserve inventory)
        const updatedOrder = await tx.order.update({
            where: { id: existingOrder.id },
            data: {
                status: input.status,
                totalAmount: input.totalAmount,
                customerEmail: input.customerEmail,
                customerName: input.customerName,
                shippingAddress: input.shippingAddress,
                billingAddress: input.billingAddress,
                metadata: input.metadata,
                updatedAt: new Date(),
            },
        });

        // Update line items if changed
        if (lineItemsChanged) {
            await tx.orderLineItem.deleteMany({
                where: { orderId: existingOrder.id },
            });
            await tx.orderLineItem.createMany({
                data: input.lineItems.map(item => ({
                    orderId: existingOrder.id,
                    sku: item.sku,
                    quantity: item.quantity,
                    price: item.price,
                    name: item.name,
                    variantId: item.variantId,
                })),
            });
        }

        this.logger.log(`Updated order ${existingOrder.id}`);

        return {
            order: updatedOrder,
            created: false,
            updated: true,
            inventoryReserved: existingOrder.inventoryReserved, // Keep original
            lineItemsChanged,
        };
    }

    /**
     * Detect if order data has changed
     */
    private detectChanges(existing: any, input: OrderUpsertInput): boolean {
        return (
            existing.status !== input.status ||
            existing.totalAmount !== input.totalAmount ||
            existing.customerEmail !== input.customerEmail ||
            existing.customerName !== input.customerName
        );
    }

    /**
     * Detect if line items have changed
     */
    private detectLineItemChanges(
        existing: Array<{ sku: string; quantity: number }> | undefined | null,
        input: LineItemInput[]
    ): boolean {
        // Handle null/undefined existing items
        if (!existing || existing.length === 0) {
            return input.length > 0;
        }

        if (existing.length !== input.length) {
            return true;
        }

        const existingMap = new Map(
            existing.map(item => [item.sku, item.quantity])
        );

        for (const item of input) {
            const existingQty = existingMap.get(item.sku);
            if (existingQty === undefined || existingQty !== item.quantity) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generate idempotency key from channel and external ID
     */
    generateIdempotencyKey(channelId: string, externalId: string): string {
        return `${channelId}:${externalId}`;
    }

    /**
     * Acquire PostgreSQL advisory lock for concurrency control
     */
    private async acquireAdvisoryLock(tx: any, key: string): Promise<void> {
        // Generate a numeric hash from the key for pg_advisory_xact_lock
        const hash = this.hashString(key);

        await tx.$queryRaw`SELECT pg_advisory_xact_lock(${hash})`;
    }

    /**
     * Generate a 32-bit hash from a string
     */
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Validate order input
     */
    private validateInput(input: OrderUpsertInput): void {
        if (!input.channelId || input.channelId.trim() === '') {
            throw new BadRequestException('Channel ID is required');
        }

        if (!input.externalId || input.externalId.trim() === '') {
            throw new BadRequestException('External ID is required');
        }

        if (!input.organizationId || input.organizationId.trim() === '') {
            throw new BadRequestException('Organization ID is required');
        }

        if (!input.lineItems || input.lineItems.length === 0) {
            throw new BadRequestException('At least one line item is required');
        }

        if (input.totalAmount < 0) {
            throw new BadRequestException('Total amount cannot be negative');
        }

        for (const item of input.lineItems) {
            if (item.quantity <= 0) {
                throw new BadRequestException(
                    `Invalid quantity for SKU ${item.sku}: must be greater than 0`
                );
            }
        }
    }
}
