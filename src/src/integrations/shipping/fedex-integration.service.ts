import { Injectable, Logger } from '@nestjs/common';
import { IntegrationType } from '@prisma/client';
import { IntegrationLoggingService } from '@services/integration-logging.service';
import { createLogger, StructuredLogger } from '@utils/structured-logger';
import { FedExClient, FedExClientConfig } from './fedex-client';
import {
  FedExCreateShipmentRequest,
  FedExCreateShipmentResponse,
  FedExTrackingRequest,
  FedExTrackingResponse as FedExAPITrackingResponse,
  FedExCancelShipmentRequest,
  FedExCancelShipmentResponse,
  FedExRateQuoteRequest,
  FedExRateQuoteResponse,
  FedExServiceType,
  FedExValidateAddressRequest,
  FedExValidateAddressResponse,
} from './fedex.types';
import {
  FEDEX_API_CONFIG,
  FEDEX_DEFAULTS,
  mapFedExStatusToInternal,
} from './fedex.constants';

/**
 * FedEx Integration Service
 * 
 * Handles FedEx API integration for shipment creation, tracking, and label retrieval.
 * Uses FedExClient for OAuth2 authentication and HTTP communication.
 * 
 * FedEx API Docs: https://developer.fedex.com/api/en-us/home.html
 */

export interface FedExShipmentRequest {
  accountNumber: string;
  testMode: boolean;
  shipper: {
    name: string;
    company?: string;
    address: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone: string;
    email?: string;
  };
  recipient: {
    name: string;
    company?: string;
    address: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone: string;
    email?: string;
  };
  packages: Array<{
    weightKg: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
  }>;
  serviceCode?: string; // e.g., 'PRIORITY_OVERNIGHT', 'FEDEX_GROUND'
  options?: {
    insurance?: number;
    signature?: boolean;
    saturdayDelivery?: boolean;
  };
}

export interface FedExShipmentResponse {
  carrierShipmentId: string;
  trackingNumber: string;
  label?: {
    content: Buffer;
    contentType: string;
  };
  cost?: number;
  estimatedDelivery?: Date;
  raw: any;
}

export interface FedExTrackingResponse {
  trackingNumber: string;
  status: string;
  events: Array<{
    timestamp: Date;
    status: string;
    location?: string;
    description?: string;
  }>;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  raw: any;
}

@Injectable()
export class FedExIntegrationService {
  private readonly logger: StructuredLogger;
  private clients: Map<string, FedExClient> = new Map();

  constructor(
    private integrationLogging?: IntegrationLoggingService,
  ) {
    this.logger = createLogger('FedExIntegration');
    this.logger.log('FedExIntegrationService initialized');
  }

  /**
   * Get or create FedEx client for organization
   */
  private getClient(shippingAccount: any): FedExClient {
    const key = `${shippingAccount.organizationId}:${shippingAccount.id}`;

    if (!this.clients.has(key)) {
      const credentials = this.getCredentials(shippingAccount);

      const config: FedExClientConfig = {
        apiUrl: process.env.FEDEX_API_URL || 'https://apis-sandbox.fedex.com',
        apiKey: credentials.apiKey || process.env.FEDEX_API_KEY!,
        secretKey: credentials.secretKey || process.env.FEDEX_SECRET_KEY!,
        accountNumber: credentials.accountNumber || process.env.FEDEX_ACCOUNT_NUMBER!,
        organizationId: shippingAccount.organizationId,
      };

      const client = new FedExClient(config, this.integrationLogging);
      this.clients.set(key, client);
    }

    return this.clients.get(key)!;
  }

  /**
   * Create shipment with FedEx
   * 
   * Creates a new shipment with FedEx and returns tracking information and label.
   * Supports both domestic and international shipments.
   * 
   * @param shippingAccount - The shipping account configuration with credentials
   * @param request - Shipment details including shipper, recipient, and packages
   * @param correlationId - Optional correlation ID for request tracing
   * @returns Promise resolving to shipment response with tracking number and label
   * @throws {FedExValidationError} If request validation fails
   * @throws {FedExAuthError} If authentication fails
   * @throws {FedExError} For other FedEx API errors
   * 
   * @example
   * ```typescript
   * const result = await service.createShipment(account, {
   *   accountNumber: '123456789',
   *   testMode: false,
   *   shipper: { name: 'John Doe', address: '123 Main St', ... },
   *   recipient: { name: 'Jane Smith', address: '456 Oak Ave', ... },
   *   packages: [{ weightKg: 5.0, lengthCm: 30, widthCm: 20, heightCm: 15 }],
   * });
   * console.log('Tracking:', result.trackingNumber);
   * ```
   */
  async createShipment(
    shippingAccount: any,
    request: FedExShipmentRequest,
    correlationId?: string,
  ): Promise<FedExShipmentResponse> {
    this.logger.log(`Creating FedEx shipment (${request.testMode ? 'TEST' : 'LIVE'} mode)`, {
      correlationId,
      testMode: request.testMode,
      packageCount: request.packages.length,
    });

    try {
      // Use mock implementation in test mode
      if (request.testMode && process.env.NODE_ENV !== 'production') {
        return this.mockCreateShipment(request);
      }

      // Build FedEx API payload
      const payload = this.buildCreateShipmentPayload(request);

      // Get client and make API call
      const client = this.getClient(shippingAccount);
      const response = await client.post<FedExCreateShipmentResponse>(
        FEDEX_API_CONFIG.ENDPOINTS.CREATE_SHIPMENT,
        payload,
        correlationId,
      );

      // Parse and return response
      return this.parseCreateShipmentResponse(response);
    } catch (error: any) {
      this.logger.error('Failed to create FedEx shipment', error, {
        correlationId,
        error: error.message,
        code: error.code,
      });

      throw error;
    }
  }

  /**
   * Get tracking information
   * 
   * Retrieves current tracking status and event history for a shipment.
   * 
   * @param shippingAccount - The shipping account configuration
   * @param trackingNumber - FedEx tracking number (12-22 digits)
   * @param correlationId - Optional correlation ID for request tracing
   * @returns Promise resolving to tracking information with status and events
   * @throws {FedExTrackingNotFoundError} If tracking number is not found
   * @throws {FedExValidationError} If tracking number format is invalid
   * @throws {FedExError} For other FedEx API errors
   * 
   * @example
   * ```typescript
   * const tracking = await service.getTracking(account, '794608491820');
   * console.log('Status:', tracking.status);
   * console.log('Events:', tracking.events);
   * ```
   */
  async getTracking(
    shippingAccount: any,
    trackingNumber: string,
    correlationId?: string,
  ): Promise<FedExTrackingResponse> {
    this.logger.log(`Fetching FedEx tracking: ${trackingNumber}`, {
      correlationId,
      trackingNumber,
    });

    try {
      // Use mock implementation in test mode
      if (shippingAccount.testMode && process.env.NODE_ENV !== 'production') {
        return this.mockGetTracking(trackingNumber);
      }

      // Build FedEx tracking request
      const payload: FedExTrackingRequest = {
        includeDetailedScans: true,
        trackingInfo: [
          {
            trackingNumberInfo: {
              trackingNumber,
            },
          },
        ],
      };

      // Get client and make API call
      const client = this.getClient(shippingAccount);
      const response = await client.post<FedExAPITrackingResponse>(
        FEDEX_API_CONFIG.ENDPOINTS.TRACK,
        payload,
        correlationId,
      );

      // Parse and return response
      return this.parseTrackingResponse(response, trackingNumber);
    } catch (error: any) {
      this.logger.error('Failed to get FedEx tracking', error, {
        correlationId,
        trackingNumber,
        error: error.message,
        code: error.code,
      });

      throw error;
    }
  }

  /**
   * Get shipment label
   * 
   * **Note**: FedEx returns labels in the createShipment response.
   * This method is provided for API consistency but will throw an error
   * in production mode. Use the label from createShipment instead.
   * 
   * In test mode, returns a mock PDF label for testing purposes.
   * 
   * @param shippingAccount - The shipping account configuration
   * @param carrierShipmentId - FedEx shipment ID or tracking number
   * @param correlationId - Optional correlation ID for request tracing
   * @returns Promise resolving to label content and content type (test mode only)
   * @throws {Error} In live mode - labels must be obtained from createShipment
   * 
   * @example
   * ```typescript
   * // Get label from createShipment instead:
   * const shipment = await service.createShipment(account, request);
   * const labelPDF = shipment.label.content;
   * ```
   */
  async getLabel(
    shippingAccount: any,
    carrierShipmentId: string,
    correlationId?: string,
  ): Promise<{ content: Buffer; contentType: string }> {
    this.logger.log(`Fetching FedEx label: ${carrierShipmentId}`, {
      correlationId,
      carrierShipmentId,
    });

    // FedEx labels are returned in createShipment response
    // Return mock for test mode only
    if (shippingAccount.testMode && process.env.NODE_ENV !== 'production') {
      return this.mockGetLabel(carrierShipmentId);
    }

    throw new Error(
      'FedEx labels are returned in createShipment response. ' +
      'Use the label from the shipment creation instead of calling getLabel.',
    );
  }

  /**
   * Cancel shipment
   * 
   * Cancels a FedEx shipment before it has been picked up.
   * Shipments can only be cancelled before the pickup date/time.
   * 
   * @param shippingAccount - The shipping account configuration
   * @param trackingNumber - FedEx tracking number to cancel
   * @param correlationId - Optional correlation ID for request tracing
   * @returns Promise resolving to true if cancelled successfully, false otherwise
   * @throws {FedExError} If cancellation fails or shipment cannot be cancelled
   * 
   * @example
   * ```typescript
   * const cancelled = await service.cancelShipment(account, '794608491820');
   * if (cancelled) {
   *   console.log('Shipment cancelled successfully');
   * }
   * ```
   */
  async cancelShipment(
    shippingAccount: any,
    trackingNumber: string,
    correlationId?: string,
  ): Promise<boolean> {
    this.logger.log(`Cancelling FedEx shipment: ${trackingNumber}`, {
      correlationId,
      trackingNumber,
    });

    try {
      // Use mock implementation in test mode
      if (shippingAccount.testMode && process.env.NODE_ENV !== 'production') {
        return true; // Mock cancellation always succeeds
      }

      const credentials = this.getCredentials(shippingAccount);

      const payload: FedExCancelShipmentRequest = {
        accountNumber: {
          value: credentials.accountNumber,
        },
        trackingNumber,
      };

      const client = this.getClient(shippingAccount);
      const response = await client.put<FedExCancelShipmentResponse>(
        FEDEX_API_CONFIG.ENDPOINTS.CANCEL_SHIPMENT,
        payload,
        correlationId,
      );

      return response.output.cancelledShipment;
    } catch (error: any) {
      this.logger.error('Failed to cancel FedEx shipment', error, {
        correlationId,
        trackingNumber,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Get rate quotes
   * 
   * Retrieves shipping rates for different FedEx service types.
   * Returns rates for all available services between origin and destination.
   * 
   * @param shippingAccount - The shipping account configuration
   * @param request - Rate quote request with origin, destination, and package details
   * @param correlationId - Optional correlation ID for request tracing
   * @returns Promise resolving to array of rate options with service type and cost
   * @throws {FedExValidationError} If request validation fails
   * @throws {FedExError} For other FedEx API errors
   * 
   * @example
   * ```typescript
   * const rates = await service.getRates(account, {
   *   accountNumber: '123456789',
   *   shipper: { city: 'Chicago', postalCode: '60601', country: 'US', ... },
   *   recipient: { city: 'New York', postalCode: '10001', country: 'US', ... },
   *   packages: [{ weightKg: 5.0 }],
   * });
   * rates.forEach(rate => {
   *   console.log(`${rate.serviceName}: $${rate.cost}`);
   * });
   * ```
   */
  async getRates(
    shippingAccount: any,
    request: Omit<FedExShipmentRequest, 'testMode'>,
    correlationId?: string,
  ): Promise<any> {
    this.logger.log('Getting FedEx rate quotes', {
      correlationId,
    });

    try {
      // Use mock implementation in test mode
      if (shippingAccount.testMode && process.env.NODE_ENV !== 'production') {
        return this.mockGetRates(request);
      }

      const credentials = this.getCredentials(shippingAccount);

      const payload: FedExRateQuoteRequest = {
        accountNumber: {
          value: credentials.accountNumber,
        },
        requestedShipment: {
          shipper: {
            address: {
              streetLines: [request.shipper.address],
              city: request.shipper.city,
              stateOrProvinceCode: request.shipper.state,
              postalCode: request.shipper.postalCode,
              countryCode: request.shipper.country,
            },
          },
          recipient: {
            address: {
              streetLines: [request.recipient.address],
              city: request.recipient.city,
              stateOrProvinceCode: request.recipient.state,
              postalCode: request.recipient.postalCode,
              countryCode: request.recipient.country,
            },
          },
          pickupType: FEDEX_DEFAULTS.PICKUP_TYPE,
          rateRequestType: ['LIST', 'ACCOUNT'],
          requestedPackageLineItems: request.packages.map((pkg) => ({
            weight: {
              units: FEDEX_DEFAULTS.WEIGHT_UNITS,
              value: pkg.weightKg,
            },
            dimensions: pkg.lengthCm
              ? {
                length: pkg.lengthCm,
                width: pkg.widthCm!,
                height: pkg.heightCm!,
                units: FEDEX_DEFAULTS.DIMENSION_UNITS,
              }
              : undefined,
          })),
        },
      };

      const client = this.getClient(shippingAccount);
      const response = await client.post<FedExRateQuoteResponse>(
        FEDEX_API_CONFIG.ENDPOINTS.RATE_QUOTE,
        payload,
        correlationId,
      );

      return response.output.rateReplyDetails.map((rate) => ({
        serviceType: rate.serviceType,
        serviceName: rate.serviceName,
        cost: rate.ratedShipmentDetails[0]?.totalNetCharge,
        currency: rate.ratedShipmentDetails[0]?.currency,
      }));
    } catch (error: any) {
      this.logger.error('Failed to get FedEx rates', error, {
        correlationId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Validate address with FedEx
   * 
   * Validates and standardizes an address using FedEx Address Validation API.
   * Returns validated address with corrections and classification (business/residential).
   * 
   * @param shippingAccount - The shipping account configuration
   * @param address - Address to validate with street, city, postal code, and country
   * @param correlationId - Optional correlation ID for request tracing
   * @returns Promise resolving to validation result with resolved address and classification
   * @throws {FedExValidationError} If address format is invalid
   * @throws {FedExError} For other FedEx API errors
   * 
   * @example
   * ```typescript
   * const result = await service.validateAddress(account, {
   *   street: '123 Main St',
   *   city: 'Chicago',
   *   state: 'IL',
   *   postalCode: '60601',
   *   country: 'US',
   * });
   * 
   * if (result.valid) {
   *   console.log('Valid address:', result.resolvedAddress);
   *   console.log('Type:', result.classification); // 'RESIDENTIAL' or 'BUSINESS'
   * } else {
   *   console.log('Warnings:', result.warnings);
   * }
   * ```
   */
  async validateAddress(
    shippingAccount: any,
    address: {
      street: string;
      city: string;
      state?: string;
      postalCode: string;
      country: string;
    },
    correlationId?: string,
  ): Promise<{
    valid: boolean;
    classification?: 'BUSINESS' | 'RESIDENTIAL' | 'UNKNOWN';
    resolvedAddress?: {
      street: string;
      city: string;
      state?: string;
      postalCode: string;
      country: string;
    };
    warnings?: string[];
  }> {
    this.logger.log('Validating address with FedEx', {
      correlationId,
      city: address.city,
      country: address.country,
    });

    try {
      // Use mock implementation in test mode
      if (shippingAccount.testMode && process.env.NODE_ENV !== 'production') {
        return this.mockValidateAddress(address);
      }

      // Build validation request
      const payload: any = {
        addressesToValidate: [
          {
            address: {
              streetLines: [address.street],
              city: address.city,
              stateOrProvinceCode: address.state,
              postalCode: address.postalCode,
              countryCode: address.country,
            },
          },
        ],
      };

      // Get client and make API call
      const client = this.getClient(shippingAccount);
      const response = await client.post<any>(
        FEDEX_API_CONFIG.ENDPOINTS.VALIDATE_ADDRESS,
        payload,
        correlationId,
      );

      // Parse response
      return this.parseValidationResponse(response);
    } catch (error: any) {
      this.logger.error('Failed to validate address', error, {
        correlationId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Mock address validation for test mode
   */
  private mockValidateAddress(address: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  }): {
    valid: boolean;
    classification: 'BUSINESS' | 'RESIDENTIAL' | 'UNKNOWN';
    resolvedAddress: any;
    warnings?: string[];
  } {
    this.logger.log('Mock address validation', { city: address.city });

    // Simple validation rules for mock
    const hasPostalCode = address.postalCode && address.postalCode.length >= 3;
    const hasCity = address.city && address.city.length >= 2;
    const hasStreet = address.street && address.street.length >= 5;

    const valid = hasPostalCode && hasCity && hasStreet;

    return {
      valid,
      classification: 'RESIDENTIAL',
      resolvedAddress: {
        street: address.street,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      },
      warnings: valid ? undefined : ['Address may be incomplete'],
    };
  }

  /**
   * Parse address validation response
   */
  private parseValidationResponse(response: any): {
    valid: boolean;
    classification?: 'BUSINESS' | 'RESIDENTIAL' | 'UNKNOWN';
    resolvedAddress?: any;
    warnings?: string[];
  } {
    const resolved = response.output.resolvedAddresses?.[0];

    if (!resolved) {
      return {
        valid: false,
        warnings: ['Address could not be validated'],
      };
    }

    const warnings: string[] = [];
    if (response.output.alerts) {
      response.output.alerts.forEach((alert: any) => {
        warnings.push(alert.message);
      });
    }

    return {
      valid: resolved.resolved,
      classification: resolved.classification,
      resolvedAddress: {
        street: resolved.address.streetLines.join(', '),
        city: resolved.address.city,
        state: resolved.address.stateOrProvinceCode,
        postalCode: resolved.address.postalCode,
        country: resolved.address.countryCode,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ============================================================================
  // MOCK IMPLEMENTATIONS (MVP)
  // ============================================================================

  private mockCreateShipment(request: FedExShipmentRequest): FedExShipmentResponse {
    const trackingNumber = this.generateMockTrackingNumber('FEDEX');
    const carrierShipmentId = this.generateMockShipmentId('FEDEX');

    // Calculate mock cost (based on weight)
    const totalWeight = request.packages.reduce((sum, pkg) => sum + pkg.weightKg, 0);
    const cost = 60 + (totalWeight * 12); // Base 60 SAR + 12 SAR per kg (FedEx slightly more expensive)

    // Estimated delivery: 2 business days (FedEx faster)
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 2);

    // Generate mock label PDF
    const label = this.generateMockLabelPDF(trackingNumber, request);

    this.logger.log(`Mock FedEx shipment created: ${carrierShipmentId}`);

    return {
      carrierShipmentId,
      trackingNumber,
      label: {
        content: label,
        contentType: 'application/pdf',
      },
      cost,
      estimatedDelivery,
      raw: {
        masterTrackingId: carrierShipmentId,
        trackingNumber,
        serviceType: request.serviceCode || 'FEDEX_GROUND',
        estimatedDelivery: estimatedDelivery.toISOString(),
      },
    };
  }

  private mockGetTracking(trackingNumber: string): FedExTrackingResponse {
    const now = new Date();
    const events = [
      {
        timestamp: new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000), // 1.5 days ago
        status: 'picked_up',
        location: 'Riyadh, SA',
        description: 'Picked up',
      },
      {
        timestamp: new Date(now.getTime() - 0.5 * 24 * 60 * 60 * 1000), // 0.5 days ago
        status: 'in_transit',
        location: 'Jeddah Hub, SA',
        description: 'In transit',
      },
      {
        timestamp: now,
        status: 'out_for_delivery',
        location: 'Dammam, SA',
        description: 'Out for delivery',
      },
    ];

    const estimatedDelivery = new Date(now.getTime() + 0.5 * 24 * 60 * 60 * 1000); // Today evening

    return {
      trackingNumber,
      status: 'in_transit',
      events,
      estimatedDelivery,
      raw: {
        trackingNumber,
        latestStatus: 'in_transit',
        scanEvents: events,
      },
    };
  }

  private mockGetRates(request: any): any[] {
    return [
      {
        serviceType: 'FEDEX_GROUND',
        serviceName: 'FedEx Ground',
        cost: 45.00,
        currency: 'SAR',
      },
      {
        serviceType: 'INTERNATIONAL_PRIORITY',
        serviceName: 'FedEx International Priority',
        cost: 120.00,
        currency: 'SAR',
      },
      {
        serviceType: 'STANDARD_OVERNIGHT',
        serviceName: 'FedEx Standard Overnight',
        cost: 85.00,
        currency: 'SAR',
      }
    ];
  }

  private mockGetLabel(carrierShipmentId: string): { content: Buffer; contentType: string } {
    const pdfContent = this.generateMockLabelPDF(carrierShipmentId, null);

    return {
      content: pdfContent,
      contentType: 'application/pdf',
    };
  }

  /**
   * Generate mock PDF label
   */
  private generateMockLabelPDF(trackingNumber: string, request: any): Buffer {
    const content = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 110 >>
stream
BT
/F1 12 Tf
100 700 Td
(FEDEX SHIPPING LABEL) Tj
0 -20 Td
(Tracking: ${trackingNumber}) Tj
ET
endstream
endobj
xref
0 5
trailer
<< /Size 5 /Root 1 0 R >>
startxref
%%EOF
    `;

    return Buffer.from(content.trim(), 'utf-8');
  }

  // ============================================================================
  // PAYLOAD BUILDING
  // ============================================================================

  /**
   * Build FedEx create shipment API payload
   */
  private buildCreateShipmentPayload(request: FedExShipmentRequest): FedExCreateShipmentRequest {

    // Get shipper info from environment or request
    const shipperInfo = {
      name: process.env.FEDEX_SHIPPER_NAME || request.shipper.name,
      street: process.env.FEDEX_SHIPPER_STREET || request.shipper.address,
      city: process.env.FEDEX_SHIPPER_CITY || request.shipper.city,
      state: process.env.FEDEX_SHIPPER_STATE || request.shipper.state || '',
      postalCode: process.env.FEDEX_SHIPPER_POSTAL_CODE || request.shipper.postalCode,
      country: process.env.FEDEX_SHIPPER_COUNTRY || request.shipper.country,
      phone: process.env.FEDEX_SHIPPER_PHONE || request.shipper.phone,
    };

    const payload: FedExCreateShipmentRequest = {
      labelResponseOptions: 'LABEL',
      requestedShipment: {
        shipper: {
          contact: {
            personName: shipperInfo.name,
            phoneNumber: shipperInfo.phone,
            companyName: request.shipper.company,
          },
          address: {
            streetLines: [shipperInfo.street],
            city: shipperInfo.city,
            stateOrProvinceCode: shipperInfo.state,
            postalCode: shipperInfo.postalCode,
            countryCode: shipperInfo.country,
          },
        },
        recipients: [
          {
            contact: {
              personName: request.recipient.name,
              phoneNumber: request.recipient.phone,
              companyName: request.recipient.company,
              emailAddress: request.recipient.email,
            },
            address: {
              streetLines: [request.recipient.address],
              city: request.recipient.city,
              stateOrProvinceCode: request.recipient.state,
              postalCode: request.recipient.postalCode,
              countryCode: request.recipient.country,
            },
          },
        ],
        pickupType: FEDEX_DEFAULTS.PICKUP_TYPE,
        serviceType: request.serviceCode || FEDEX_DEFAULTS.SERVICE_TYPE,
        packagingType: FEDEX_DEFAULTS.PACKAGING_TYPE,
        shippingChargesPayment: {
          paymentType: FEDEX_DEFAULTS.PAYMENT_TYPE,
          payor: {
            responsibleParty: {
              accountNumber: {
                value: request.accountNumber,
              },
            },
          },
        },
        labelSpecification: {
          labelFormatType: FEDEX_DEFAULTS.LABEL_FORMAT_TYPE,
          imageType: FEDEX_DEFAULTS.LABEL_IMAGE_TYPE,
          labelStockType: FEDEX_DEFAULTS.LABEL_STOCK_TYPE,
        },
        requestedPackageLineItems: request.packages.map((pkg) => ({
          weight: {
            units: FEDEX_DEFAULTS.WEIGHT_UNITS,
            value: pkg.weightKg,
          },
          dimensions: pkg.lengthCm
            ? {
              length: pkg.lengthCm,
              width: pkg.widthCm!,
              height: pkg.heightCm!,
              units: FEDEX_DEFAULTS.DIMENSION_UNITS,
            }
            : undefined,
        })),
      },
      accountNumber: {
        value: request.accountNumber,
      },
    };

    return payload;
  }

  // ============================================================================
  // RESPONSE PARSING
  // ============================================================================

  /**
   * Parse FedEx create shipment API response
   */
  private parseCreateShipmentResponse(
    response: FedExCreateShipmentResponse,
  ): FedExShipmentResponse {
    const shipment = response.output.transactionShipments[0];
    const packageDetail = shipment.completedShipmentDetail.completedPackageDetails[0];
    const trackingInfo = packageDetail.trackingIds[0];

    // Extract label (base64 encoded PDF)
    let label: { content: Buffer; contentType: string } | undefined;
    if (packageDetail.label) {
      label = {
        content: Buffer.from(packageDetail.label.encodedLabel, 'base64'),
        contentType: 'application/pdf',
      };
    }

    // Extract cost
    let cost: number | undefined;
    const rating = shipment.completedShipmentDetail.shipmentRating;
    if (rating && rating.shipmentRateDetails.length > 0) {
      cost = rating.shipmentRateDetails[0].totalNetCharge;
    }

    // Extract estimated delivery
    let estimatedDelivery: Date | undefined;
    if (shipment.shipDatestamp) {
      // FedEx provides ship date, not estimated delivery in creation response
      // Estimate based on service type
      const daysToAdd = shipment.serviceType.includes('OVERNIGHT') ? 1 : 3;
      estimatedDelivery = new Date(shipment.shipDatestamp);
      estimatedDelivery.setDate(estimatedDelivery.getDate() + daysToAdd);
    }

    return {
      carrierShipmentId: shipment.masterTrackingNumber,
      trackingNumber: trackingInfo.trackingNumber,
      label,
      cost,
      estimatedDelivery,
      raw: response,
    };
  }

  /**
   * Parse FedEx tracking API response
   */
  private parseTrackingResponse(
    response: FedExAPITrackingResponse,
    trackingNumber: string,
  ): FedExTrackingResponse {
    const trackResult = response.output.completeTrackResults[0]?.trackResults[0];

    if (!trackResult) {
      throw new Error(`No tracking information found for ${trackingNumber}`);
    }

    // Extract status
    const latestStatus = trackResult.latestStatusDetail;
    const status = latestStatus?.derivedCode || latestStatus?.code || 'UNKNOWN';

    // Extract events
    const events = (trackResult.scanEvents || []).map((event) => ({
      timestamp: new Date(event.timestamp),
      status: event.derivedStatusCode || event.eventType,
      location: this.formatLocation(event.scanLocation),
      description: event.eventDescription,
    }));

    // Extract delivery dates
    const dateAndTimes = trackResult.dateAndTimes || [];
    const estimatedDeliveryObj = dateAndTimes.find((d) => d.type === 'ESTIMATED_DELIVERY');
    const actualDeliveryObj = dateAndTimes.find((d) => d.type === 'ACTUAL_DELIVERY');

    const estimatedDelivery = estimatedDeliveryObj
      ? new Date(estimatedDeliveryObj.dateTime)
      : undefined;
    const actualDelivery = actualDeliveryObj
      ? new Date(actualDeliveryObj.dateTime)
      : undefined;

    return {
      trackingNumber,
      status,
      events,
      estimatedDelivery,
      actualDelivery,
      raw: response,
    };
  }

  /**
   * Format location from FedEx address
   */
  private formatLocation(location?: {
    city?: string;
    stateOrProvinceCode?: string;
    countryCode?: string;
  }): string | undefined {
    if (!location) return undefined;

    const parts = [
      location.city,
      location.stateOrProvinceCode,
      location.countryCode,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getCredentials(shippingAccount: any): {
    apiKey: string;
    secretKey: string;
    accountNumber: string;
  } {
    // Try to get from shipping account credentials first, fallback to env vars
    const accountCreds = shippingAccount.credentials || {};

    return {
      apiKey: accountCreds.apiKey || process.env.FEDEX_API_KEY!,
      secretKey: accountCreds.secretKey || process.env.FEDEX_SECRET_KEY!,
      accountNumber: accountCreds.accountNumber || shippingAccount.accountNumber || process.env.FEDEX_ACCOUNT_NUMBER!,
    };
  }

  private generateMockTrackingNumber(carrier: string): string {
    const timestamp = Date.now().toString().slice(-10);
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `${timestamp}${random}`;
  }

  private generateMockShipmentId(carrier: string): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `${carrier}-${timestamp}-${random}`;
  }
}