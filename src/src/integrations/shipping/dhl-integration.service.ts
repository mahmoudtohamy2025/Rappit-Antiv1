import { Injectable, Logger } from '@nestjs/common';
import { ShippingCarrier, IntegrationType } from '@prisma/client';
import { IntegrationLoggingService } from '@services/integration-logging.service';
import { createLogger, StructuredLogger } from '@utils/structured-logger';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

/**
 * DHL Integration Service
 * 
 * Handles DHL Express API integration for shipment creation, tracking, and label retrieval.
 * 
 * MVP: Mock implementation with deterministic responses
 * PRODUCTION TODO: Implement real DHL API integration
 * 
 * DHL API Docs: https://developer.dhl.com/api-reference/dhl-express-mydhl-api
 */

export interface DHLShipmentRequest {
  accountNumber: string;
  testMode: boolean;
  shipper: {
    name: string;
    company?: string;
    address: string;
    city: string;
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
  serviceCode?: string; // e.g., 'EXP' for Express
  options?: {
    insurance?: number;
    signature?: boolean;
    saturdayDelivery?: boolean;
  };
}

export interface DHLShipmentResponse {
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

export interface DHLTrackingResponse {
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
export class DHLIntegrationService {
  private readonly logger: StructuredLogger;
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL_MS = 100; // Rate limit: max 10 requests/second

  constructor(
    private integrationLogging?: IntegrationLoggingService,
  ) {
    this.logger = createLogger('DHLIntegration');
    this.logger.log('DHLIntegrationService initialized');
  }

  /**
   * Create shipment with DHL
   * 
   * MVP: Returns mock response
   * PRODUCTION TODO: Implement real API call
   */
  async createShipment(
    shippingAccount: any,
    request: DHLShipmentRequest,
    correlationId?: string,
  ): Promise<DHLShipmentResponse> {
    const startTime = Date.now();
    const operation = 'createShipment';

    this.logger.log(`Creating DHL shipment (${request.testMode ? 'TEST' : 'LIVE'} mode)`, {
      correlationId,
      testMode: request.testMode,
      packageCount: request.packages.length,
    });

    try {
      // Decrypt credentials
      const credentials = this.getCredentials(shippingAccount);

      // MVP: Mock implementation
      if (process.env.NODE_ENV !== 'production' || request.testMode) {
        const result = this.mockCreateShipment(request);
        
        const duration = Date.now() - startTime;

        // Log success
        await this.logSuccess(
          shippingAccount.organizationId,
          operation,
          'mock',
          'POST',
          request,
          result,
          duration,
          correlationId,
        );

        return result;
      }

      // PRODUCTION: Implement real API call
      const apiUrl = process.env.DHL_API_URL || 'https://express.api.dhl.com';
      const endpoint = `${apiUrl}/mydhlapi/shipments`;

      const payload = this.buildCreateShipmentPayload(request);

      const response = await this.httpPost(
        endpoint,
        payload,
        credentials.apiKey,
        credentials.apiSecret,
        shippingAccount.organizationId,
        operation,
        correlationId,
      );

      const result = this.parseCreateShipmentResponse(response);
      
      const duration = Date.now() - startTime;

      // Log success
      await this.logSuccess(
        shippingAccount.organizationId,
        operation,
        endpoint,
        'POST',
        payload,
        result,
        duration,
        correlationId,
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log failure
      await this.logFailure(
        shippingAccount.organizationId,
        operation,
        'unknown',
        'POST',
        request,
        error,
        500,
        duration,
        correlationId,
      );

      throw error;
    }
  }

  /**
   * Get tracking information
   * 
   * MVP: Returns mock response
   * PRODUCTION TODO: Implement real API call
   */
  async getTracking(
    shippingAccount: any,
    trackingNumber: string,
    correlationId?: string,
  ): Promise<DHLTrackingResponse> {
    const startTime = Date.now();
    const operation = 'getTracking';

    this.logger.log(`Fetching DHL tracking: ${trackingNumber}`, {
      correlationId,
      trackingNumber,
    });

    try {
      const credentials = this.getCredentials(shippingAccount);

      // MVP: Mock implementation
      if (process.env.NODE_ENV !== 'production' || shippingAccount.testMode) {
        const result = this.mockGetTracking(trackingNumber);
        
        const duration = Date.now() - startTime;

        await this.logSuccess(
          shippingAccount.organizationId,
          operation,
          'mock',
          'GET',
          { trackingNumber },
          result,
          duration,
          correlationId,
        );

        return result;
      }

      // PRODUCTION: Implement real API call
      const apiUrl = process.env.DHL_API_URL || 'https://api-eu.dhl.com';
      const endpoint = `${apiUrl}/track/shipments?trackingNumber=${trackingNumber}`;

      const response = await this.httpGet(
        endpoint,
        credentials.apiKey,
        credentials.apiSecret,
        shippingAccount.organizationId,
        operation,
        correlationId,
      );

      const result = this.parseTrackingResponse(response);
      
      const duration = Date.now() - startTime;

      await this.logSuccess(
        shippingAccount.organizationId,
        operation,
        endpoint,
        'GET',
        { trackingNumber },
        result,
        duration,
        correlationId,
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.logFailure(
        shippingAccount.organizationId,
        operation,
        'unknown',
        'GET',
        { trackingNumber },
        error,
        500,
        duration,
        correlationId,
      );

      throw error;
    }
  }

  /**
   * Get shipment label
   * 
   * MVP: Returns mock PDF
   * PRODUCTION TODO: Implement real API call
   */
  async getLabel(
    shippingAccount: any,
    carrierShipmentId: string,
    correlationId?: string,
  ): Promise<{ content: Buffer; contentType: string }> {
    const startTime = Date.now();
    const operation = 'getLabel';

    this.logger.log(`Fetching DHL label: ${carrierShipmentId}`, {
      correlationId,
      carrierShipmentId,
    });

    try {
      // MVP: Return mock PDF
      if (process.env.NODE_ENV !== 'production' || shippingAccount.testMode) {
        const result = this.mockGetLabel(carrierShipmentId);
        
        const duration = Date.now() - startTime;

        await this.logSuccess(
          shippingAccount.organizationId,
          operation,
          'mock',
          'GET',
          { carrierShipmentId },
          { contentType: result.contentType, size: result.content.length },
          duration,
          correlationId,
        );

        return result;
      }

      // PRODUCTION: Implement real API call
      const apiUrl = process.env.DHL_API_URL;
      const endpoint = `${apiUrl}/mydhlapi/shipments/${carrierShipmentId}/label`;

      const response = await this.httpGet(
        endpoint,
        this.getCredentials(shippingAccount).apiKey,
        this.getCredentials(shippingAccount).apiSecret,
        shippingAccount.organizationId,
        operation,
        correlationId,
      );

      const result = {
        content: Buffer.from(response.data, 'base64'),
        contentType: 'application/pdf',
      };

      const duration = Date.now() - startTime;

      await this.logSuccess(
        shippingAccount.organizationId,
        operation,
        endpoint,
        'GET',
        { carrierShipmentId },
        { contentType: result.contentType, size: result.content.length },
        duration,
        correlationId,
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.logFailure(
        shippingAccount.organizationId,
        operation,
        'unknown',
        'GET',
        { carrierShipmentId },
        error,
        500,
        duration,
        correlationId,
      );

      throw error;
    }
  }

  // ============================================================================
  // MOCK IMPLEMENTATIONS (MVP)
  // ============================================================================

  private mockCreateShipment(request: DHLShipmentRequest): DHLShipmentResponse {
    const trackingNumber = this.generateMockTrackingNumber('DHL');
    const carrierShipmentId = this.generateMockShipmentId('DHL');

    // Calculate mock cost (based on weight)
    const totalWeight = request.packages.reduce((sum, pkg) => sum + pkg.weightKg, 0);
    const cost = 50 + (totalWeight * 10); // Base 50 SAR + 10 SAR per kg

    // Estimated delivery: 3 business days
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);

    // Generate mock label PDF
    const label = this.generateMockLabelPDF(trackingNumber, request);

    this.logger.log(`Mock DHL shipment created: ${carrierShipmentId}`);

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
        shipmentId: carrierShipmentId,
        trackingNumber,
        service: request.serviceCode || 'EXPRESS',
        estimatedDelivery: estimatedDelivery.toISOString(),
      },
    };
  }

  private mockGetTracking(trackingNumber: string): DHLTrackingResponse {
    // Simulate tracking events
    const now = new Date();
    const events = [
      {
        timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        status: 'transit',
        location: 'Riyadh, SA',
        description: 'Shipment picked up',
      },
      {
        timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        status: 'transit',
        location: 'Jeddah, SA',
        description: 'In transit',
      },
      {
        timestamp: now,
        status: 'out-for-delivery',
        location: 'Dammam, SA',
        description: 'Out for delivery',
      },
    ];

    const estimatedDelivery = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // Tomorrow

    return {
      trackingNumber,
      status: 'transit',
      events,
      estimatedDelivery,
      raw: {
        trackingNumber,
        status: 'transit',
        events,
      },
    };
  }

  private mockGetLabel(carrierShipmentId: string): { content: Buffer; contentType: string } {
    // Return simple text PDF placeholder
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
    // Simple PDF-like structure (not a real PDF, just for testing)
    // In production, DHL returns actual PDF labels
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
<< /Length 100 >>
stream
BT
/F1 12 Tf
100 700 Td
(DHL SHIPPING LABEL) Tj
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
  // HELPER METHODS
  // ============================================================================

  private getCredentials(shippingAccount: any): { apiKey: string; apiSecret: string } {
    // Decrypt credentials if they are encrypted
    // For production, credentials should be encrypted in the database
    const credentials = shippingAccount.credentials;
    
    if (typeof credentials === 'string') {
      // If credentials are stored as encrypted string, they need decryption
      // This would require EncryptionService integration
      // For now, assume they are JSON string
      try {
        return JSON.parse(credentials);
      } catch (error) {
        this.logger.error('Failed to parse credentials', { error });
        throw new Error('Invalid credentials format');
      }
    }
    
    // If credentials are already an object
    return credentials as { apiKey: string; apiSecret: string };
  }

  private generateMockTrackingNumber(carrier: string): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${carrier}${timestamp}${random}`;
  }

  private generateMockShipmentId(carrier: string): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `${carrier}-SHIP-${timestamp}-${random}`;
  }

  // ============================================================================
  // HTTP STUBS (PRODUCTION TODO)
  // ============================================================================

  /**
   * HTTP POST with authentication, retry logic, and rate limiting
   */
  protected async httpPost(
    url: string,
    payload: any,
    apiKey: string,
    apiSecret: string,
    orgId: string,
    operation: string,
    correlationId?: string,
  ): Promise<any> {
    this.logger.debug(`POST ${url}`, { correlationId, operation });

    // Apply rate limiting
    await this.rateLimit();

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const config: AxiosRequestConfig = {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId || '',
          },
          timeout: 30000, // 30 seconds timeout
        };

        const response = await axios.post(url, payload, config);
        
        this.logger.log(`HTTP POST successful (attempt ${attempt})`, {
          url,
          status: response.status,
          correlationId,
        });

        return response.data;
      } catch (error) {
        lastError = error;
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status;
        const errorCode = axiosError.code;
        const isTimeoutError =
          errorCode === 'ECONNABORTED' || errorCode === 'ETIMEDOUT';

        this.logger.warn(`HTTP POST failed (attempt ${attempt}/${maxRetries})`, {
          url,
          status: statusCode,
          error: axiosError.message,
          code: errorCode,
          correlationId,
        });

        // Retry on timeouts, 429 (rate limit), 500, 502, 503, 504 (server errors)
        const shouldRetry =
          isTimeoutError ||
          statusCode === 429 ||
          (statusCode && statusCode >= 500 && statusCode <= 504);

        if (!shouldRetry || attempt === maxRetries) {
          throw this.normalizeError(axiosError, operation);
        }

        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        this.logger.debug(`Retrying after ${backoffMs}ms`, { correlationId });
        await this.sleep(backoffMs);
      }
    }

    throw this.normalizeError(lastError, operation);
  }

  /**
   * HTTP GET with authentication, retry logic, and rate limiting
   */
  protected async httpGet(
    url: string,
    apiKey: string,
    apiSecret: string,
    orgId: string,
    operation: string,
    correlationId?: string,
  ): Promise<any> {
    this.logger.debug(`GET ${url}`, { correlationId, operation });

    // Apply rate limiting
    await this.rateLimit();

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const config: AxiosRequestConfig = {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId || '',
          },
          timeout: 30000, // 30 seconds timeout
        };

        const response = await axios.get(url, config);
        
        this.logger.log(`HTTP GET successful (attempt ${attempt})`, {
          url,
          status: response.status,
          correlationId,
        });

        return response.data;
      } catch (error) {
        lastError = error;
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status;

        this.logger.warn(`HTTP GET failed (attempt ${attempt}/${maxRetries})`, {
          url,
          status: statusCode,
          error: axiosError.message,
          correlationId,
        });

        // Retry on 429 (rate limit), 500, 502, 503, 504 (server errors)
        const shouldRetry = 
          statusCode === 429 || 
          (statusCode && statusCode >= 500 && statusCode <= 504);

        if (!shouldRetry || attempt === maxRetries) {
          throw this.normalizeError(axiosError, operation);
        }

        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        this.logger.debug(`Retrying after ${backoffMs}ms`, { correlationId });
        await this.sleep(backoffMs);
      }
    }

    throw this.normalizeError(lastError, operation);
  }

  /**
   * Build DHL API payload for shipment creation
   * According to DHL Express MyDHL API specification
   */
  private buildCreateShipmentPayload(request: DHLShipmentRequest): any {
    // DHL Express API payload structure
    return {
      plannedShippingDateAndTime: new Date().toISOString(),
      pickup: {
        isRequested: false,
      },
      productCode: request.serviceCode || 'P', // P = Express Worldwide
      accounts: [
        {
          typeCode: 'shipper',
          number: request.accountNumber,
        },
      ],
      customerDetails: {
        shipperDetails: {
          postalAddress: {
            postalCode: request.shipper.postalCode,
            cityName: request.shipper.city,
            countryCode: request.shipper.country,
            addressLine1: request.shipper.address,
          },
          contactInformation: {
            email: request.shipper.email || '',
            phone: request.shipper.phone,
            companyName: request.shipper.company || request.shipper.name,
            fullName: request.shipper.name,
          },
        },
        receiverDetails: {
          postalAddress: {
            postalCode: request.recipient.postalCode,
            cityName: request.recipient.city,
            countryCode: request.recipient.country,
            addressLine1: request.recipient.address,
          },
          contactInformation: {
            email: request.recipient.email || '',
            phone: request.recipient.phone,
            companyName: request.recipient.company || request.recipient.name,
            fullName: request.recipient.name,
          },
        },
      },
      content: {
        packages: request.packages.map((pkg, index) => ({
          typeCode: '2BP', // Customer provided box/package
          weight: pkg.weightKg,
          dimensions: {
            length: pkg.lengthCm || 10,
            width: pkg.widthCm || 10,
            height: pkg.heightCm || 10,
          },
        })),
        isCustomsDeclarable: request.shipper.country !== request.recipient.country,
        description: 'Customer Order',
        incoterm: 'DAP', // Delivered at Place
        unitOfMeasurement: 'metric',
      },
      valueAddedServices: this.buildValueAddedServices(request.options),
      outputImageProperties: {
        imageOptions: [
          {
            typeCode: 'label',
            templateName: 'ECOM26_A4_001',
            isRequested: true,
          },
        ],
      },
    };
  }

  /**
   * Build value-added services for DHL
   */
  private buildValueAddedServices(options?: DHLShipmentRequest['options']): any[] {
    const services: any[] = [];

    if (options?.insurance && options.insurance > 0) {
      services.push({
        serviceCode: 'II', // Insurance
        value: options.insurance,
        currency: 'USD',
      });
    }

    if (options?.signature) {
      services.push({
        serviceCode: 'SA', // Signature on Delivery
      });
    }

    if (options?.saturdayDelivery) {
      services.push({
        serviceCode: 'AA', // Saturday Delivery
      });
    }

    return services;
  }

  /**
   * Parse DHL API response for shipment creation
   */
  private parseCreateShipmentResponse(response: any): DHLShipmentResponse {
    // DHL API returns shipmentTrackingNumber and documents array
    const trackingNumber = response.shipmentTrackingNumber || 
                          response.packages?.[0]?.trackingNumber ||
                          '';
    
    const carrierShipmentId = response.shipmentTrackingNumber || trackingNumber;

    // Extract label from documents
    let label: { content: Buffer; contentType: string } | undefined;
    if (response.documents && response.documents.length > 0) {
      const labelDoc = response.documents.find((doc: any) => 
        doc.typeCode === 'label' || doc.imageFormat === 'PDF'
      );
      
      if (labelDoc && labelDoc.content) {
        label = {
          content: Buffer.from(labelDoc.content, 'base64'),
          contentType: labelDoc.imageFormat === 'PDF' ? 'application/pdf' : 'image/png',
        };
      }
    }

    // Extract cost information
    const cost = response.shipmentCharges?.[0]?.price || 
                response.totalPrice?.[0]?.price;

    // Extract estimated delivery
    let estimatedDelivery: Date | undefined;
    if (response.estimatedDeliveryDate) {
      estimatedDelivery = new Date(response.estimatedDeliveryDate.date);
    }

    return {
      carrierShipmentId,
      trackingNumber,
      label,
      cost: cost ? parseFloat(cost) : undefined,
      estimatedDelivery,
      raw: response,
    };
  }

  /**
   * Parse DHL tracking API response
   */
  private parseTrackingResponse(response: any): DHLTrackingResponse {
    // DHL Tracking API response structure
    const shipments = response.shipments || [];
    
    if (shipments.length === 0) {
      throw new Error('No tracking information found');
    }

    const shipment = shipments[0];
    const trackingNumber = shipment.id || '';
    
    // Map DHL status to internal status
    const status = this.mapDHLStatus(shipment.status?.statusCode || 'unknown');

    // Parse events
    const events = (shipment.events || []).map((event: any) => ({
      timestamp: new Date(event.timestamp),
      status: this.mapDHLStatus(event.statusCode || event.typeCode),
      location: event.location?.address?.addressLocality || '',
      description: event.description || event.statusCode || '',
    }));

    // Sort events by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Extract delivery dates
    let estimatedDelivery: Date | undefined;
    let actualDelivery: Date | undefined;

    if (shipment.estimatedDeliveryDate) {
      estimatedDelivery = new Date(shipment.estimatedDeliveryDate);
    }

    if (shipment.status?.statusCode === 'delivered' && events.length > 0) {
      actualDelivery = events[0].timestamp;
    }

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
   * Map DHL status codes to internal status strings
   */
  private mapDHLStatus(dhlStatus: string): string {
    const statusMap: Record<string, string> = {
      'pre-transit': 'pending',
      'transit': 'in-transit',
      'delivered': 'delivered',
      'failure': 'failed',
      'returned': 'returned',
      'cancelled': 'cancelled',
      'out-for-delivery': 'out-for-delivery',
      'available-for-pickup': 'ready-for-pickup',
    };

    return statusMap[dhlStatus.toLowerCase()] || 'transit';
  }

  // ============================================================================
  // LOGGING HELPERS
  // ============================================================================

  private async logSuccess(
    orgId: string,
    operation: string,
    endpoint: string,
    method: string,
    request: any,
    response: any,
    durationMs: number,
    correlationId?: string,
  ): Promise<void> {
    if (!this.integrationLogging) return;

    await this.integrationLogging.logSuccess(
      orgId,
      IntegrationType.DHL,
      operation,
      endpoint,
      method,
      request,
      response,
      durationMs,
      correlationId,
    );

    this.logger.logIntegration(
      operation,
      'DHL',
      true,
      durationMs,
      { correlationId, orgId },
    );
  }

  private async logFailure(
    orgId: string,
    operation: string,
    endpoint: string,
    method: string,
    request: any,
    error: Error,
    statusCode: number,
    durationMs: number,
    correlationId?: string,
  ): Promise<void> {
    if (!this.integrationLogging) return;

    await this.integrationLogging.logFailure(
      orgId,
      IntegrationType.DHL,
      operation,
      endpoint,
      method,
      request,
      error,
      statusCode,
      durationMs,
      correlationId,
    );

    this.logger.logIntegration(
      operation,
      'DHL',
      false,
      durationMs,
      { correlationId, orgId, error: error.message },
    );
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Rate limiting to prevent overwhelming DHL API
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL_MS) {
      const waitTime = this.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Normalize axios errors to standard Error format
   */
  private normalizeError(error: any, operation: string): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const statusCode = axiosError.response?.status;
      const responseData = axiosError.response?.data as any;

      let message = `DHL API ${operation} failed`;
      
      if (statusCode) {
        message += ` (HTTP ${statusCode})`;
      }

      if (responseData?.message) {
        message += `: ${responseData.message}`;
      } else if (responseData?.detail) {
        message += `: ${responseData.detail}`;
      } else if (axiosError.message) {
        message += `: ${axiosError.message}`;
      }

      const normalizedError = new Error(message);
      (normalizedError as any).statusCode = statusCode;
      (normalizedError as any).response = responseData;
      
      return normalizedError;
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}
