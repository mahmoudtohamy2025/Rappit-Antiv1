import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@common/database/prisma.service';
import { FedExIntegrationService } from '@integrations/shipping/fedex-integration.service';
import { IntegrationLoggingService } from '@services/integration-logging.service';

/**
 * FedEx Service - High-level API
 * 
 * This service provides a simplified interface to FedEx functionality
 * and delegates to FedExIntegrationService for actual API calls.
 * 
 * Maintained for backward compatibility with existing code.
 */

interface FedExShipmentRequest {
  orderId: string;
  shipper: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  recipient: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  packages: Array<{
    weight: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
  }>;
}

@Injectable()
export class FedexService {
  private readonly logger = new Logger(FedexService.name);
  private readonly integrationService: FedExIntegrationService;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    integrationLogging?: IntegrationLoggingService,
  ) {
    // Initialize the integration service
    this.integrationService = new FedExIntegrationService(integrationLogging);
  }

  async createShipment(request: FedExShipmentRequest) {
    this.logger.log(`Creating FedEx shipment for order ${request.orderId}`);

    // Get shipping account from database
    const shippingAccount = await this.getOrCreateShippingAccount();

    // Convert to integration service format
    const integrationRequest = {
      accountNumber: shippingAccount.accountNumber,
      testMode: shippingAccount.testMode || false,
      shipper: {
        name: request.shipper.name,
        address: request.shipper.address,
        city: request.shipper.city,
        postalCode: request.shipper.postalCode,
        country: request.shipper.country,
        phone: this.configService.get('fedex.shipperPhone') || '+966123456789',
      },
      recipient: {
        name: request.recipient.name,
        address: request.recipient.address,
        city: request.recipient.city,
        postalCode: request.recipient.postalCode,
        country: request.recipient.country,
        phone: '+966987654321', // Default recipient phone
      },
      packages: request.packages.map((pkg) => ({
        weightKg: pkg.weight,
        lengthCm: pkg.dimensions.length,
        widthCm: pkg.dimensions.width,
        heightCm: pkg.dimensions.height,
      })),
    };

    // Delegate to integration service
    const response = await this.integrationService.createShipment(
      shippingAccount,
      integrationRequest,
      `order-${request.orderId}`,
    );

    return {
      success: true,
      trackingNumber: response.trackingNumber,
      labelUrl: response.label ? 'embedded' : undefined,
      labelContent: response.label?.content,
      shipmentId: response.carrierShipmentId,
      cost: response.cost,
      estimatedDelivery: response.estimatedDelivery,
    };
  }

  async trackShipment(trackingNumber: string) {
    this.logger.log(`Tracking FedEx shipment: ${trackingNumber}`);

    const shippingAccount = await this.getOrCreateShippingAccount();

    const response = await this.integrationService.getTracking(
      shippingAccount,
      trackingNumber,
      `track-${trackingNumber}`,
    );

    return {
      trackingNumber: response.trackingNumber,
      status: response.status,
      events: response.events.map((event) => ({
        timestamp: event.timestamp.toISOString(),
        status: event.status,
        location: event.location,
        description: event.description,
      })),
      estimatedDelivery: response.estimatedDelivery?.toISOString(),
      actualDelivery: response.actualDelivery?.toISOString(),
    };
  }

  async cancelShipment(trackingNumber: string) {
    this.logger.log(`Cancelling FedEx shipment: ${trackingNumber}`);

    const shippingAccount = await this.getOrCreateShippingAccount();

    const success = await this.integrationService.cancelShipment(
      shippingAccount,
      trackingNumber,
      `cancel-${trackingNumber}`,
    );

    return {
      success,
      trackingNumber,
      message: success ? 'Shipment cancelled' : 'Failed to cancel shipment',
    };
  }

  async getLabel(trackingNumber: string) {
    this.logger.log(`Getting FedEx label: ${trackingNumber}`);

    const shippingAccount = await this.getOrCreateShippingAccount();

    try {
      const label = await this.integrationService.getLabel(
        shippingAccount,
        trackingNumber,
        `label-${trackingNumber}`,
      );

      return {
        trackingNumber,
        labelContent: label.content,
        contentType: label.contentType,
        format: 'PDF',
      };
    } catch (error: any) {
      // FedEx returns labels in createShipment response
      return {
        trackingNumber,
        error: error.message,
        format: 'PDF',
      };
    }
  }

  async validateAddress(address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  }) {
    this.logger.log(`Validating address: ${address.city}, ${address.country}`);

    // Note: validateAddress is not yet implemented in integration service
    // Returning optimistic response for now
    return {
      valid: true,
      address: address,
    };
  }

  async getRates(request: {
    shipper: { city: string; country: string; postalCode: string };
    recipient: { city: string; country: string; postalCode: string };
    weight: number;
  }) {
    this.logger.log(`Getting FedEx rates`);

    const shippingAccount = await this.getOrCreateShippingAccount();

    const integrationRequest = {
      accountNumber: shippingAccount.accountNumber,
      shipper: {
        name: 'Shipper',
        address: '123 Main St',
        city: request.shipper.city,
        postalCode: request.shipper.postalCode,
        country: request.shipper.country,
        phone: '+966123456789',
      },
      recipient: {
        name: 'Recipient',
        address: '456 Oak Ave',
        city: request.recipient.city,
        postalCode: request.recipient.postalCode,
        country: request.recipient.country,
        phone: '+966987654321',
      },
      packages: [
        {
          weightKg: request.weight,
        },
      ],
    };

    const rates = await this.integrationService.getRates(
      shippingAccount,
      integrationRequest,
      'get-rates',
    );

    return {
      rates: rates.map((rate: any) => ({
        serviceType: rate.serviceType,
        serviceName: rate.serviceName,
        totalCharge: {
          amount: rate.cost,
          currency: rate.currency || 'USD',
        },
      })),
    };
  }

  /**
   * Get or create default FedEx shipping account
   * In production, this would fetch from database based on organizationId
   */
  private async getOrCreateShippingAccount() {
    // For now, return a mock account with config from environment
    return {
      id: 'default-fedex-account',
      organizationId: 'default-org',
      carrier: 'FEDEX',
      accountNumber: this.configService.get('fedex.accountNumber') || process.env.FEDEX_ACCOUNT_NUMBER || 'mock-account',
      testMode: this.configService.get('fedex.testMode') !== 'false',
      credentials: {
        apiKey: this.configService.get('fedex.apiKey') || process.env.FEDEX_API_KEY,
        secretKey: this.configService.get('fedex.secretKey') || process.env.FEDEX_SECRET_KEY,
        accountNumber: this.configService.get('fedex.accountNumber') || process.env.FEDEX_ACCOUNT_NUMBER,
      },
    };
  }
}
