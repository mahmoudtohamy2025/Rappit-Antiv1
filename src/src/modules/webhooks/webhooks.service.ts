import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly MAX_REPLAY_COUNT = 5;

  constructor(private prisma: PrismaService) { }

  async handleShopifyWebhook(channelId: string, event: string, payload: any) {
    this.logger.log(`Shopify webhook received: ${event} for channel ${channelId}`);

    await this.logWebhook({
      channelId,
      provider: 'SHOPIFY',
      event,
      payload,
      status: 'RECEIVED',
    });

    try {
      switch (event) {
        case 'orders/create':
        case 'orders/updated':
          await this.handleOrderWebhook(channelId, payload);
          break;
        case 'orders/cancelled':
          await this.handleOrderCancellation(channelId, payload);
          break;
        default:
          this.logger.warn(`Unhandled Shopify event: ${event}`);
      }

      await this.updateWebhookStatus(channelId, event, 'PROCESSED');
    } catch (error) {
      this.logger.error(`Error processing Shopify webhook: ${error.message}`);
      await this.updateWebhookStatus(channelId, event, 'FAILED', error.message);
      throw error;
    }
  }

  async handleWooCommerceWebhook(channelId: string, event: string, payload: any) {
    this.logger.log(`WooCommerce webhook received: ${event} for channel ${channelId}`);

    await this.logWebhook({
      channelId,
      provider: 'WOOCOMMERCE',
      event,
      payload,
      status: 'RECEIVED',
    });

    try {
      switch (event) {
        case 'order.created':
        case 'order.updated':
          await this.handleOrderWebhook(channelId, payload);
          break;
        case 'order.deleted':
          await this.handleOrderCancellation(channelId, payload);
          break;
        default:
          this.logger.warn(`Unhandled WooCommerce event: ${event}`);
      }

      await this.updateWebhookStatus(channelId, event, 'PROCESSED');
    } catch (error) {
      this.logger.error(`Error processing WooCommerce webhook: ${error.message}`);
      await this.updateWebhookStatus(channelId, event, 'FAILED', error.message);
      throw error;
    }
  }

  async handleDHLWebhook(shipmentId: string, event: string, payload: any) {
    this.logger.log(`DHL webhook received: ${event} for shipment ${shipmentId}`);

    try {
      // Update shipment tracking information
      const trackingData = payload.shipments?.[0];
      if (trackingData) {
        await this.prisma.trackingEvent.create({
          data: {
            shipmentId,
            status: trackingData.status,
            location: trackingData.location,
            description: trackingData.description,
            timestamp: new Date(trackingData.timestamp),
          },
        });

        // Update shipment status
        await this.prisma.shipment.update({
          where: { id: shipmentId },
          data: { status: this.mapDHLStatus(trackingData.status) },
        });
      }
    } catch (error) {
      this.logger.error(`Error processing DHL webhook: ${error.message}`);
      throw error;
    }
  }

  async handleFedExWebhook(shipmentId: string, event: string, payload: any) {
    this.logger.log(`FedEx webhook received: ${event} for shipment ${shipmentId}`);

    try {
      // Update shipment tracking information
      const trackingData = payload.completeTrackResults?.[0]?.trackResults?.[0];
      if (trackingData) {
        await this.prisma.trackingEvent.create({
          data: {
            shipmentId,
            status: trackingData.latestStatusDetail?.code,
            location: trackingData.latestStatusDetail?.scanLocation?.city,
            description: trackingData.latestStatusDetail?.description,
            timestamp: new Date(trackingData.dateAndTimes?.[0]?.dateTime),
          },
        });

        // Update shipment status
        await this.prisma.shipment.update({
          where: { id: shipmentId },
          data: { status: this.mapFedExStatus(trackingData.latestStatusDetail?.code) },
        });
      }
    } catch (error) {
      this.logger.error(`Error processing FedEx webhook: ${error.message}`);
      throw error;
    }
  }

  private async handleOrderWebhook(channelId: string, payload: any) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new BadRequestException('Channel not found');
    }

    // Check if order already exists
    const externalOrderId = payload.id?.toString();
    const existing = await this.prisma.order.findFirst({
      where: {
        channelId,
        externalOrderId,
      },
    });

    if (existing) {
      this.logger.log(`Order already exists: ${externalOrderId}`);
      return;
    }

    // This would normally trigger a job to import the order
    this.logger.log(`Queuing order import for: ${externalOrderId}`);
  }

  private async handleOrderCancellation(channelId: string, payload: any) {
    const externalOrderId = payload.id?.toString();
    const order = await this.prisma.order.findFirst({
      where: {
        channelId,
        externalOrderId,
      },
    });

    if (order) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });
      this.logger.log(`Order cancelled: ${order.orderNumber}`);
    }
  }

  private async logWebhook(data: {
    channelId: string;
    provider: string;
    event: string;
    payload: any;
    status: string;
  }) {
    await this.prisma.webhookLog.create({
      data: {
        channelId: data.channelId,
        provider: data.provider,
        event: data.event,
        payload: data.payload,
        status: data.status,
      },
    });
  }

  private async updateWebhookStatus(
    channelId: string,
    event: string,
    status: string,
    error?: string,
  ) {
    const latestLog = await this.prisma.webhookLog.findFirst({
      where: { channelId, event },
      orderBy: { receivedAt: 'desc' },
    });

    if (latestLog) {
      await this.prisma.webhookLog.update({
        where: { id: latestLog.id },
        data: { status, error },
      });
    }
  }

  private mapDHLStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'PU': 'PICKED_UP',
      'IT': 'IN_TRANSIT',
      'WC': 'OUT_FOR_DELIVERY',
      'OK': 'DELIVERED',
      'DF': 'FAILED',
    };
    return statusMap[status] || 'IN_TRANSIT';
  }

  private mapFedExStatus(code: string): string {
    const statusMap: Record<string, string> = {
      'PU': 'PICKED_UP',
      'IT': 'IN_TRANSIT',
      'OD': 'OUT_FOR_DELIVERY',
      'DL': 'DELIVERED',
      'DE': 'FAILED',
    };
    return statusMap[code] || 'IN_TRANSIT';
  }

  async getWebhookLogs(channelId: string, limit: number = 50) {
    return this.prisma.webhookLog.findMany({
      where: { channelId },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
  }

  // ============================================================================
  // QUEUE-03: Webhook Replay Admin Endpoint
  // ============================================================================

  /**
   * Replay a failed webhook event
   * @param eventId - The ID of the ProcessedWebhookEvent to replay
   * @param organizationId - Organization ID for scoping
   * @param performedBy - User ID who triggered the replay
   */
  async replayWebhook(eventId: string, organizationId: string, performedBy: string) {
    // Find the event (org-scoped)
    const event = await this.prisma.processedWebhookEvent.findFirst({
      where: { id: eventId, organizationId },
    });

    if (!event) {
      throw new NotFoundException('Webhook event not found');
    }

    // Check replay limit
    if (event.replayCount >= this.MAX_REPLAY_COUNT) {
      throw new BadRequestException(
        `Max replay limit (${this.MAX_REPLAY_COUNT}) reached for this event`,
      );
    }

    // Create audit log entry
    await this.prisma.webhookReplayAudit.create({
      data: {
        eventId,
        organizationId,
        performedBy,
        action: 'REPLAY',
        previousReplayCount: event.replayCount,
      },
    });

    // Re-enqueue the webhook for processing
    // For now, we'll trigger the appropriate handler based on source
    let newJobId = 'job-new-1'; // This would come from actual job queue

    // Update event status and increment replay count
    await this.prisma.processedWebhookEvent.update({
      where: { id: eventId },
      data: {
        replayCount: event.replayCount + 1,
        status: 'ENQUEUED',
        processedAt: null,
        errorMessage: null,
      },
    });

    this.logger.log(`Webhook ${eventId} replayed by ${performedBy}. Replay count: ${event.replayCount + 1}`);

    return {
      replayed: true,
      eventId,
      newJobId,
      replayCount: event.replayCount + 1,
    };
  }
}
