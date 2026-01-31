import { Job } from 'bullmq';
import { BaseWorker } from './base.worker';
import { QueueName } from '../queues/queues';

/**
 * Webhook Processor Worker
 * 
 * Processes webhook events from sales channels and shipping carriers.
 * Handles:
 * - Shopify webhooks (orders, fulfillments, inventory)
 * - WooCommerce webhooks
 * - Shipping carrier webhooks (DHL, FedEx)
 */

export interface WebhookJobData {
  source: 'shopify' | 'woocommerce' | 'dhl' | 'fedex';
  event: string;
  channelId: string;
  organizationId: string;
  externalEventId: string;
  payload: any;
  processedWebhookEventId: string; // ID of ProcessedWebhookEvent record
}

export class WebhookProcessorWorker extends BaseWorker<WebhookJobData> {
  constructor() {
    super(QueueName.WEBHOOK_PROCESSING, 'WebhookProcessorWorker', {
      concurrency: 10, // High concurrency for webhooks
    });
  }

  protected async processJob(job: Job<WebhookJobData>): Promise<void> {
    const {
      source,
      event,
      channelId,
      organizationId,
      externalEventId,
      payload,
      processedWebhookEventId,
    } = job.data;

    this.logger.log(
      `Processing ${source} webhook: ${event} (eventId: ${externalEventId}, channel: ${channelId})`,
    );

    try {
      // Update ProcessedWebhookEvent status to PROCESSING
      await this.updateWebhookEventStatus(processedWebhookEventId, 'PROCESSING');

      // Route to appropriate handler based on source
      switch (source) {
        case 'shopify':
          await this.processShopifyWebhook(event, channelId, organizationId, payload);
          break;

        case 'woocommerce':
          await this.processWooCommerceWebhook(event, channelId, organizationId, payload);
          break;

        case 'dhl':
        case 'fedex':
          await this.processCarrierWebhook(source, event, channelId, organizationId, payload);
          break;

        default:
          throw new Error(`Unknown webhook source: ${source}`);
      }

      // Update ProcessedWebhookEvent status to COMPLETED
      await this.updateWebhookEventStatus(processedWebhookEventId, 'COMPLETED');

      this.logger.log(
        `Completed ${source} webhook: ${event} (eventId: ${externalEventId})`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing ${source} webhook ${event}: ${error.message}`,
      );

      // Update ProcessedWebhookEvent status to FAILED
      await this.updateWebhookEventStatus(
        processedWebhookEventId,
        'FAILED',
        error.message,
      );

      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Process Shopify webhook
   */
  private async processShopifyWebhook(
    event: string,
    channelId: string,
    organizationId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing Shopify event: ${event}`);

    switch (event) {
      case 'orders/create':
      case 'orders/updated':
        await this.processShopifyOrder(channelId, organizationId, payload);
        break;

      case 'orders/cancelled':
        await this.processShopifyOrderCancelled(channelId, organizationId, payload);
        break;

      case 'fulfillments/create':
      case 'fulfillments/update':
        await this.processShopifyFulfillment(channelId, organizationId, payload);
        break;

      case 'inventory_levels/update':
        await this.processShopifyInventoryUpdate(channelId, organizationId, payload);
        break;

      default:
        this.logger.warn(`Unhandled Shopify event: ${event}`);
    }
  }

  /**
   * Process Shopify order create/update webhook
   * 
   * Note: This method requires proper service injection to work.
   * The webhook processor worker needs to be refactored to accept
   * ShopifyIntegrationService and OrdersService via constructor.
   * 
   * For now, this is a placeholder that logs the webhook event.
   * The actual order processing can be triggered via the sync worker
   * by scheduling an immediate order sync job.
   */
  private async processShopifyOrder(
    channelId: string,
    organizationId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing Shopify order webhook: ${payload.id}`);

    // TODO: Implement proper service injection pattern
    // Workflow:
    // 1. Inject ShopifyIntegrationService and OrdersService via constructor
    // 2. Map external order to internal DTO:
    //    const orderDto = await shopifyService.mapExternalOrderToInternal(channelId, payload);
    // 3. Create or update order:
    //    await ordersService.createOrUpdateOrderFromChannelPayload(
    //      orderDto, organizationId, ActorType.CHANNEL, channelId
    //    );
    // 4. Inventory reservation happens automatically in OrdersService

    this.logger.warn(
      `Shopify order webhook received but processing not fully implemented. ` +
      `Consider triggering immediate order sync for channel ${channelId}`,
    );
  }

  /**
   * Process Shopify order cancelled webhook
   */
  private async processShopifyOrderCancelled(
    channelId: string,
    organizationId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing Shopify order cancellation: ${payload.id}`);

    // TODO: Implement
    // Find internal order by externalOrderId
    // Update status to CANCELLED
    // Inventory will be released automatically by OrdersService

    this.logger.debug(`Shopify order cancelled: ${payload.id}`);
  }

  /**
   * Process Shopify fulfillment webhook
   */
  private async processShopifyFulfillment(
    channelId: string,
    organizationId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing Shopify fulfillment: ${payload.id}`);

    // TODO: Implement
    // Update order status based on fulfillment status
    // Sync tracking information

    this.logger.debug(`Shopify fulfillment processed: ${payload.id}`);
  }

  /**
   * Process Shopify inventory update webhook
   */
  private async processShopifyInventoryUpdate(
    channelId: string,
    organizationId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing Shopify inventory update: ${payload.inventory_item_id}`);

    // TODO: Implement
    // Sync inventory levels from Shopify to internal system

    this.logger.debug(`Shopify inventory updated: ${payload.inventory_item_id}`);
  }

  /**
   * Process WooCommerce webhook
   */
  private async processWooCommerceWebhook(
    event: string,
    channelId: string,
    organizationId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing WooCommerce event: ${event}`);

    switch (event) {
      case 'order.created':
      case 'order.updated':
        await this.processWooCommerceOrder(channelId, organizationId, payload);
        break;

      case 'order.deleted':
        await this.processWooCommerceOrderDeleted(channelId, organizationId, payload);
        break;

      case 'product.created':
      case 'product.updated':
        await this.processWooCommerceProduct(channelId, organizationId, payload);
        break;

      case 'product.deleted':
        await this.processWooCommerceProductDeleted(channelId, organizationId, payload);
        break;

      default:
        this.logger.warn(`Unhandled WooCommerce event: ${event}`);
    }
  }

  /**
   * Process WooCommerce order create/update webhook
   */
  private async processWooCommerceOrder(
    channelId: string,
    organizationId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing WooCommerce order: ${payload.id}`);

    // TODO: Implement in integration service
    // 1. Map external order to internal DTO
    // const orderDto = await woocommerceService.mapExternalOrderToInternal(channelId, payload);
    // 
    // 2. Create or update order
    // const order = await ordersService.createOrUpdateOrderFromChannelPayload(
    //   orderDto,
    //   organizationId,
    //   ActorType.CHANNEL,
    //   channelId,
    // );
    // 
    // 3. If order is paid (status = 'processing' or 'completed'), inventory auto-reserved by OrdersService

    this.logger.debug(`WooCommerce order processed: ${payload.id}`);
  }

  /**
   * Process WooCommerce order deleted webhook
   */
  private async processWooCommerceOrderDeleted(
    channelId: string,
    organizationId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing WooCommerce order deletion: ${payload.id}`);

    // TODO: Implement
    // Find internal order by externalOrderId
    // Update status to CANCELLED
    // Inventory will be released automatically by OrdersService

    this.logger.debug(`WooCommerce order deleted: ${payload.id}`);
  }

  /**
   * Process WooCommerce product webhook
   */
  private async processWooCommerceProduct(
    channelId: string,
    organizationId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing WooCommerce product: ${payload.id}`);

    // TODO: Implement
    // Sync product and variations

    this.logger.debug(`WooCommerce product processed: ${payload.id}`);
  }

  /**
   * Process WooCommerce product deleted webhook
   */
  private async processWooCommerceProductDeleted(
    channelId: string,
    organizationId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing WooCommerce product deletion: ${payload.id}`);

    // TODO: Implement
    // Mark product as inactive or delete

    this.logger.debug(`WooCommerce product deleted: ${payload.id}`);
  }

  /**
   * Process shipping carrier webhook (DHL, FedEx)
   */
  private async processCarrierWebhook(
    carrier: string,
    event: string,
    channelId: string,
    organizationId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing ${carrier} event: ${event}`);

    // TODO: Implement carrier webhook handling
    // Update order status based on tracking events
    // - PICKED_UP
    // - IN_TRANSIT
    // - OUT_FOR_DELIVERY
    // - DELIVERED
    // - FAILED

    this.logger.debug(`${carrier} event processed: ${event}`);
  }

  /**
   * Update ProcessedWebhookEvent status
   */
  private async updateWebhookEventStatus(
    id: string,
    status: string,
    errorMessage?: string,
  ): Promise<void> {
    // TODO: Implement with Prisma
    // await prisma.processedWebhookEvent.update({
    //   where: { id },
    //   data: {
    //     status,
    //     processedAt: status === 'COMPLETED' ? new Date() : undefined,
    //     errorMessage: errorMessage || undefined,
    //   },
    // });

    this.logger.debug(`Webhook event ${id} status updated to ${status}`);
  }
}

/**
 * Start webhook processor worker
 */
export async function startWebhookProcessorWorker(): Promise<WebhookProcessorWorker> {
  const worker = new WebhookProcessorWorker();
  await worker.start();
  return worker;
}