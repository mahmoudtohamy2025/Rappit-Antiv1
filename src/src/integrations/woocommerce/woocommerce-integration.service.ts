import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { CreateOrderFromChannelDto } from '@modules/orders/dto/create-order-from-channel.dto';
import { createOAuth1Signature } from './oauth1-helper';

/**
 * WooCommerce Integration Service
 * 
 * Handles WooCommerce REST API integration including:
 * - Product sync (with variations)
 * - Order sync and mapping
 * - Inventory sync
 * - OAuth1 authentication
 * 
 * WooCommerce API Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/
 */
@Injectable()
export class WooCommerceIntegrationService {
  private readonly logger = new Logger(WooCommerceIntegrationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Sync products from WooCommerce
   * 
   * Fetches products (including variations) from WooCommerce API and creates/updates
   * internal Product and SKU records.
   * 
   * @param channelId - Channel ID
   * @param sinceTimestamp - Only sync products updated since this timestamp
   */
  async syncProductsForChannel(
    channelId: string,
    sinceTimestamp?: string,
  ): Promise<void> {
    this.logger.log(
      `Syncing products for channel ${channelId} since ${sinceTimestamp || 'beginning'}`,
    );

    // Get channel configuration
    const channel = await this.getChannel(channelId);
    const { siteUrl, consumerKey, consumerSecret } = this.extractCredentials(channel.config);

    // Build API URL with pagination
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = this.buildApiUrl(siteUrl, '/wp-json/wc/v3/products', {
        modified_after: sinceTimestamp,
        per_page: '100',
        page: page.toString(),
      });

      // Fetch products from WooCommerce
      const products = await this.httpGet(url, consumerKey, consumerSecret);

      this.logger.log(`Fetched ${products.length} products from WooCommerce (page ${page})`);

      if (products.length === 0) {
        hasMore = false;
      } else {
        // Process products
        for (const wooProduct of products) {
          await this.mapAndSaveProduct(channelId, channel.organizationId, wooProduct);
          
          // If product has variations, fetch and process them
          if (wooProduct.type === 'variable' && wooProduct.variations?.length > 0) {
            await this.syncProductVariations(
              channelId,
              channel.organizationId,
              siteUrl,
              consumerKey,
              consumerSecret,
              wooProduct.id,
            );
          }
        }

        page++;
      }
    }

    // Update last sync timestamp
    await this.updateChannelLastSync(channelId);
  }

  /**
   * Sync product variations
   */
  private async syncProductVariations(
    channelId: string,
    organizationId: string,
    siteUrl: string,
    consumerKey: string,
    consumerSecret: string,
    productId: number,
  ): Promise<void> {
    const url = this.buildApiUrl(
      siteUrl,
      `/wp-json/wc/v3/products/${productId}/variations`,
      { per_page: '100' },
    );

    const variations = await this.httpGet(url, consumerKey, consumerSecret);

    this.logger.log(`Fetched ${variations.length} variations for product ${productId}`);

    for (const variation of variations) {
      await this.mapAndSaveVariation(channelId, organizationId, productId, variation);
    }
  }

  /**
   * Map and save product
   */
  private async mapAndSaveProduct(
    channelId: string,
    organizationId: string,
    wooProduct: any,
  ): Promise<void> {
    // TODO: Implement product mapping and save
    // Create/update Product and SKU records
    
    this.logger.debug(`Mapped WooCommerce product ${wooProduct.id}: ${wooProduct.name}`);
  }

  /**
   * Map and save product variation as SKU
   */
  private async mapAndSaveVariation(
    channelId: string,
    organizationId: string,
    productId: number,
    variation: any,
  ): Promise<void> {
    // TODO: Implement variation mapping
    // Create SKU with metadata containing woocommerce_variation_id
    
    this.logger.debug(`Mapped WooCommerce variation ${variation.id} for product ${productId}`);
  }

  /**
   * Sync orders from WooCommerce
   * 
   * Fetches orders from WooCommerce API and creates internal Order records.
   * 
   * @param channelId - Channel ID
   * @param sinceTimestamp - Only sync orders created since this timestamp
   */
  async syncOrdersForChannel(
    channelId: string,
    sinceTimestamp?: string,
  ): Promise<void> {
    this.logger.log(
      `Syncing orders for channel ${channelId} since ${sinceTimestamp || 'beginning'}`,
    );

    // Get channel configuration
    const channel = await this.getChannel(channelId);
    const { siteUrl, consumerKey, consumerSecret } = this.extractCredentials(channel.config);

    // Build API URL with pagination
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = this.buildApiUrl(siteUrl, '/wp-json/wc/v3/orders', {
        after: sinceTimestamp,
        status: 'any',
        per_page: '100',
        page: page.toString(),
      });

      // Fetch orders from WooCommerce
      const orders = await this.httpGet(url, consumerKey, consumerSecret);

      this.logger.log(`Fetched ${orders.length} orders from WooCommerce (page ${page})`);

      if (orders.length === 0) {
        hasMore = false;
      } else {
        // TODO: Process orders
        // for (const wooOrder of orders) {
        //   const orderDto = await this.mapExternalOrderToInternal(channelId, wooOrder);
        //   await ordersService.createOrUpdateOrderFromChannelPayload(
        //     orderDto,
        //     channel.organizationId,
        //     ActorType.SYSTEM,
        //   );
        // }

        page++;
      }
    }

    // Update last sync timestamp
    await this.updateChannelLastSync(channelId);
  }

  /**
   * Map external WooCommerce order to internal DTO
   * 
   * Transforms WooCommerce order payload into CreateOrderFromChannelDto format.
   * 
   * @param channelId - Channel ID
   * @param externalOrder - Raw WooCommerce order payload
   * @returns Mapped order DTO
   */
  async mapExternalOrderToInternal(
    channelId: string,
    externalOrder: any,
  ): Promise<CreateOrderFromChannelDto> {
    this.logger.log(`Mapping WooCommerce order ${externalOrder.id} to internal format`);

    const channel = await this.getChannel(channelId);

    // Map customer
    const customer = {
      externalId: externalOrder.customer_id?.toString() || externalOrder.id.toString(),
      firstName: externalOrder.billing?.first_name || 'Guest',
      lastName: externalOrder.billing?.last_name || 'Customer',
      email: externalOrder.billing?.email,
      phone: externalOrder.billing?.phone,
      metadata: {
        woocommerce_customer_id: externalOrder.customer_id,
      },
    };

    // Map shipping address
    const shippingAddress = externalOrder.shipping && externalOrder.shipping.address_1 ? {
      firstName: externalOrder.shipping.first_name,
      lastName: externalOrder.shipping.last_name,
      company: externalOrder.shipping.company,
      street1: externalOrder.shipping.address_1,
      street2: externalOrder.shipping.address_2,
      city: externalOrder.shipping.city,
      state: externalOrder.shipping.state,
      postalCode: externalOrder.shipping.postcode,
      country: externalOrder.shipping.country,
      phone: externalOrder.billing?.phone, // WooCommerce doesn't have shipping phone
    } : {
      firstName: externalOrder.billing?.first_name || customer.firstName,
      lastName: externalOrder.billing?.last_name || customer.lastName,
      company: externalOrder.billing?.company,
      street1: externalOrder.billing?.address_1 || 'No address provided',
      street2: externalOrder.billing?.address_2,
      city: externalOrder.billing?.city || 'Unknown',
      state: externalOrder.billing?.state,
      postalCode: externalOrder.billing?.postcode || '00000',
      country: externalOrder.billing?.country || 'SA',
      phone: externalOrder.billing?.phone,
    };

    // Map billing address
    const billingAddress = externalOrder.billing ? {
      firstName: externalOrder.billing.first_name,
      lastName: externalOrder.billing.last_name,
      company: externalOrder.billing.company,
      street1: externalOrder.billing.address_1,
      street2: externalOrder.billing.address_2,
      city: externalOrder.billing.city,
      state: externalOrder.billing.state,
      postalCode: externalOrder.billing.postcode,
      country: externalOrder.billing.country,
      phone: externalOrder.billing.phone,
    } : undefined;

    // Map line items
    const items = await Promise.all(
      externalOrder.line_items.map(async (item: any) => {
        // Find internal SKU by WooCommerce variation ID or product ID
        const sku = await this.findSkuByWooCommerceId(
          item.variation_id || item.product_id,
          channel.organizationId,
        );

        if (!sku) {
          this.logger.warn(
            `SKU not found for WooCommerce ${item.variation_id ? 'variation' : 'product'} ${item.variation_id || item.product_id}. Order ${externalOrder.id} may fail to import.`,
          );
        }

        return {
          externalItemId: item.id.toString(),
          sku: sku?.sku || item.sku || `WOO-${item.variation_id || item.product_id}`,
          name: item.name,
          variantName: item.variation_id && item.meta_data?.length > 0
            ? item.meta_data.map((m: any) => `${m.key}: ${m.value}`).join(', ')
            : undefined,
          quantity: item.quantity,
          unitPrice: parseFloat(item.price),
          totalPrice: parseFloat(item.total),
          taxAmount: parseFloat(item.total_tax || '0'),
          discountAmount: parseFloat(item.subtotal) - parseFloat(item.total),
          metadata: {
            woocommerce_product_id: item.product_id,
            woocommerce_variation_id: item.variation_id,
            woocommerce_meta_data: item.meta_data,
          },
        };
      }),
    );

    // Map payment status
    const paymentStatus = this.mapWooCommerceStatus(externalOrder.status);

    // Build order DTO
    const orderDto: CreateOrderFromChannelDto = {
      channelId,
      externalOrderId: externalOrder.id.toString(),
      orderNumber: externalOrder.number?.toString(),
      customer,
      shippingAddress,
      billingAddress,
      items,
      subtotal: parseFloat(externalOrder.total) - parseFloat(externalOrder.total_tax || '0') - parseFloat(externalOrder.shipping_total || '0'),
      shippingCost: parseFloat(externalOrder.shipping_total || '0'),
      taxAmount: parseFloat(externalOrder.total_tax || '0'),
      discountAmount: parseFloat(externalOrder.discount_total || '0'),
      totalAmount: parseFloat(externalOrder.total),
      currency: externalOrder.currency,
      paymentStatus,
      customerNote: externalOrder.customer_note,
      tags: [], // WooCommerce doesn't have tags by default
      metadata: {
        woocommerce_order_id: externalOrder.id,
        woocommerce_order_key: externalOrder.order_key,
        woocommerce_status: externalOrder.status,
        woocommerce_payment_method: externalOrder.payment_method,
        woocommerce_payment_method_title: externalOrder.payment_method_title,
        woocommerce_transaction_id: externalOrder.transaction_id,
        woocommerce_created_via: externalOrder.created_via,
      },
      orderDate: externalOrder.date_created,
    };

    this.logger.log(`Mapped WooCommerce order ${externalOrder.id} successfully`);

    return orderDto;
  }

  /**
   * Find SKU by WooCommerce product/variation ID
   */
  private async findSkuByWooCommerceId(
    productOrVariationId: number,
    organizationId: string,
  ): Promise<{ sku: string } | null> {
    // TODO: Implement SKU lookup by WooCommerce ID
    // First try variation_id, then product_id
    
    // const sku = await this.prisma.sKU.findFirst({
    //   where: {
    //     product: {
    //       organizationId,
    //     },
    //     OR: [
    //       {
    //         metadata: {
    //           path: ['woocommerce_variation_id'],
    //           equals: productOrVariationId,
    //         },
    //       },
    //       {
    //         metadata: {
    //           path: ['woocommerce_product_id'],
    //           equals: productOrVariationId,
    //         },
    //       },
    //     ],
    //   },
    //   select: { sku: true },
    // });
    
    // return sku;

    // Placeholder - return null for now
    return null;
  }

  /**
   * Map WooCommerce order status to payment status
   * 
   * WooCommerce statuses:
   * - pending: Payment pending
   * - processing: Payment received, awaiting fulfillment
   * - on-hold: Awaiting payment
   * - completed: Order completed
   * - cancelled: Order cancelled
   * - refunded: Order refunded
   * - failed: Payment failed
   */
  private mapWooCommerceStatus(status: string): any {
    const statusMap: Record<string, any> = {
      'pending': 'PENDING',
      'processing': 'PAID',
      'on-hold': 'PENDING',
      'completed': 'PAID',
      'cancelled': 'FAILED',
      'refunded': 'REFUNDED',
      'failed': 'FAILED',
    };

    return statusMap[status] || 'PENDING';
  }

  /**
   * Get channel configuration
   */
  private async getChannel(channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    return channel;
  }

  /**
   * Extract credentials from channel config
   */
  private extractCredentials(config: any): {
    siteUrl: string;
    consumerKey: string;
    consumerSecret: string;
  } {
    const siteUrl = config.siteUrl || config.site_url;
    const consumerKey = config.consumerKey || config.consumer_key;
    const consumerSecret = config.consumerSecret || config.consumer_secret;

    if (!siteUrl || !consumerKey || !consumerSecret) {
      throw new Error('Missing WooCommerce credentials (siteUrl, consumerKey, consumerSecret)');
    }

    return { siteUrl, consumerKey, consumerSecret };
  }

  /**
   * Build WooCommerce API URL
   */
  private buildApiUrl(siteUrl: string, path: string, params?: Record<string, string>): string {
    // Remove trailing slash from siteUrl
    const baseUrl = siteUrl.replace(/\/$/, '');
    const url = new URL(`${baseUrl}${path}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          url.searchParams.append(key, value);
        }
      });
    }

    return url.toString();
  }

  /**
   * Update channel last sync timestamp
   */
  private async updateChannelLastSync(channelId: string): Promise<void> {
    await this.prisma.channel.update({
      where: { id: channelId },
      data: { lastSyncAt: new Date() },
    });
  }

  // ============================================================================
  // HTTP Methods with OAuth1 Signing
  // ============================================================================

  /**
   * HTTP GET request with OAuth1 signature
   * 
   * WooCommerce uses OAuth1 for authentication.
   * 
   * @param url - Full URL
   * @param consumerKey - WooCommerce consumer key
   * @param consumerSecret - WooCommerce consumer secret
   * @returns Response data
   * 
   * TODO: Implement with axios or node-fetch + OAuth1 signing
   */
  protected async httpGet(
    url: string,
    consumerKey: string,
    consumerSecret: string,
  ): Promise<any> {
    this.logger.debug(`GET ${url}`);

    // Generate OAuth1 signature
    const oauthParams = createOAuth1Signature(
      'GET',
      url,
      consumerKey,
      consumerSecret,
    );

    // Add OAuth params to URL
    const urlWithOAuth = this.appendOAuthParams(url, oauthParams);

    // TODO: Implement actual HTTP request
    // const response = await axios.get(urlWithOAuth);
    // return response.data;

    throw new NotImplementedException(
      'httpGet not implemented - use axios/fetch with OAuth1 signature',
    );
  }

  /**
   * HTTP POST request with OAuth1 signature
   */
  protected async httpPost(
    url: string,
    consumerKey: string,
    consumerSecret: string,
    data: any,
  ): Promise<any> {
    this.logger.debug(`POST ${url}`);

    const oauthParams = createOAuth1Signature(
      'POST',
      url,
      consumerKey,
      consumerSecret,
    );

    const urlWithOAuth = this.appendOAuthParams(url, oauthParams);

    throw new NotImplementedException('httpPost not implemented');
  }

  /**
   * HTTP PUT request with OAuth1 signature
   */
  protected async httpPut(
    url: string,
    consumerKey: string,
    consumerSecret: string,
    data: any,
  ): Promise<any> {
    this.logger.debug(`PUT ${url}`);

    const oauthParams = createOAuth1Signature(
      'PUT',
      url,
      consumerKey,
      consumerSecret,
    );

    const urlWithOAuth = this.appendOAuthParams(url, oauthParams);

    throw new NotImplementedException('httpPut not implemented');
  }

  /**
   * HTTP DELETE request with OAuth1 signature
   */
  protected async httpDelete(
    url: string,
    consumerKey: string,
    consumerSecret: string,
  ): Promise<any> {
    this.logger.debug(`DELETE ${url}`);

    const oauthParams = createOAuth1Signature(
      'DELETE',
      url,
      consumerKey,
      consumerSecret,
    );

    const urlWithOAuth = this.appendOAuthParams(url, oauthParams);

    throw new NotImplementedException('httpDelete not implemented');
  }

  /**
   * Append OAuth parameters to URL
   */
  private appendOAuthParams(url: string, oauthParams: Record<string, string>): string {
    const urlObj = new URL(url);

    Object.entries(oauthParams).forEach(([key, value]) => {
      urlObj.searchParams.append(key, value);
    });

    return urlObj.toString();
  }
}
