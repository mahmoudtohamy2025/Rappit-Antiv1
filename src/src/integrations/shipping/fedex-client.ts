/**
 * FedEx OAuth2 HTTP Client
 * 
 * Robust HTTP client for FedEx API with:
 * - OAuth2 token management with caching and auto-refresh
 * - Rate limiting (500 requests/minute)
 * - Retry with exponential backoff for 429/5xx errors
 * - Request/response logging to IntegrationLog
 * - Error normalization with FedEx-specific error codes
 */

import { IntegrationType, LogDirection } from '@prisma/client';
import { IntegrationLoggingService } from '@services/integration-logging.service';
import { createLogger, StructuredLogger } from '@utils/structured-logger';
import {
  FedExOAuthTokenResponse,
  FedExError,
  FedExErrorCode,
} from './fedex.types';
import {
  FEDEX_API_CONFIG,
  getFedExErrorMessage,
} from './fedex.constants';

export interface FedExClientConfig {
  apiUrl: string;
  apiKey: string;
  secretKey: string;
  accountNumber: string;
  organizationId: string;
}

export class FedExClient {
  private readonly logger: StructuredLogger;
  private readonly config: FedExClientConfig;
  private readonly integrationLogging?: IntegrationLoggingService;
  
  // Token management
  private accessToken?: string;
  private tokenExpiry?: Date;
  private tokenRefreshPromise?: Promise<void>;
  
  // Rate limiting
  private lastRequestTime: number = 0;

  constructor(
    config: FedExClientConfig,
    integrationLogging?: IntegrationLoggingService,
  ) {
    this.config = config;
    this.integrationLogging = integrationLogging;
    this.logger = createLogger('FedExClient');

    this.logger.log('FedEx client initialized', {
      apiUrl: config.apiUrl,
      accountNumber: config.accountNumber,
    });
  }

  /**
   * Make HTTP POST request with rate limiting and retry logic
   */
  async post<T = any>(
    endpoint: string,
    data: any,
    correlationId?: string,
  ): Promise<T> {
    return this.request<T>('POST', endpoint, { data }, correlationId);
  }

  /**
   * Make HTTP GET request with rate limiting and retry logic
   */
  async get<T = any>(
    endpoint: string,
    params?: any,
    correlationId?: string,
  ): Promise<T> {
    return this.request<T>('GET', endpoint, { params }, correlationId);
  }

  /**
   * Make HTTP PUT request with rate limiting and retry logic
   */
  async put<T = any>(
    endpoint: string,
    data: any,
    correlationId?: string,
  ): Promise<T> {
    return this.request<T>('PUT', endpoint, { data }, correlationId);
  }

  /**
   * Generic HTTP request with all features
   */
  private async request<T = any>(
    method: string,
    endpoint: string,
    options: { data?: any; params?: any } = {},
    correlationId?: string,
    retryCount: number = 0,
  ): Promise<T> {
    // Apply rate limiting
    await this.applyRateLimit();

    // Ensure we have a valid token (unless it's the OAuth endpoint)
    if (!endpoint.includes('/oauth/token')) {
      await this.ensureValidToken();
    }

    const startTime = Date.now();
    const fullUrl = `${this.config.apiUrl}${endpoint}`;

    this.logger.debug(`${method} ${endpoint}`, {
      correlationId,
      retryCount,
    });

    try {
      // Build fetch options
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authorization header (unless OAuth endpoint)
      if (!endpoint.includes('/oauth/token') && this.accessToken) {
        headers.Authorization = `Bearer ${this.accessToken}`;
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
      };

      // Add body for POST/PUT
      if (options.data && (method === 'POST' || method === 'PUT')) {
        fetchOptions.body = JSON.stringify(options.data);
      }

      // Add query params for GET
      let url = fullUrl;
      if (options.params && method === 'GET') {
        const searchParams = new URLSearchParams(options.params);
        url = `${fullUrl}?${searchParams.toString()}`;
      }

      const response = await fetch(url, fetchOptions);
      const statusCode = response.status;

      let responseData: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      const duration = Date.now() - startTime;

      // Handle non-2xx responses
      if (!response.ok) {
        // Handle 401 - refresh token and retry
        if (statusCode === 401 && retryCount === 0) {
          this.logger.warn('Received 401, refreshing token and retrying');
          
          // Force token refresh
          this.accessToken = undefined;
          this.tokenExpiry = undefined;
          
          await this.ensureValidToken();
          
          // Retry request
          return this.request<T>(
            method,
            endpoint,
            options,
            correlationId,
            retryCount + 1,
          );
        }

        const errorData = responseData as FedExError | undefined;

        // Determine if we should retry
        const shouldRetry = this.shouldRetry(statusCode, retryCount);

        if (shouldRetry) {
          const delay = this.calculateRetryDelay(retryCount);
          
          this.logger.warn(`Request failed, retrying in ${delay}ms`, {
            endpoint,
            statusCode,
            retryCount: retryCount + 1,
            maxRetries: FEDEX_API_CONFIG.MAX_RETRIES,
            correlationId,
          });

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Retry request
          return this.request<T>(
            method,
            endpoint,
            options,
            correlationId,
            retryCount + 1,
          );
        }

        // Log failure
        await this.logRequest(
          endpoint,
          method,
          options.data || options.params,
          errorData,
          statusCode,
          duration,
          correlationId,
          this.formatError(errorData),
        );

        // Throw normalized error
        throw this.normalizeError(errorData, statusCode);
      }

      // Log success
      await this.logRequest(
        endpoint,
        method,
        options.data || options.params,
        responseData,
        statusCode,
        duration,
        correlationId,
      );

      return responseData as T;
    } catch (error: any) {
      // If error already thrown from above, re-throw
      if (error.code) {
        throw error;
      }

      const duration = Date.now() - startTime;

      // Log failure
      await this.logRequest(
        endpoint,
        method,
        options.data || options.params,
        null,
        500,
        duration,
        correlationId,
        error.message,
      );

      throw new Error(`FedEx API request failed: ${error.message}`);
    }
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureValidToken(): Promise<void> {
    // Check if token is still valid (with buffer)
    if (this.accessToken && this.tokenExpiry) {
      const now = new Date();
      const expiryWithBuffer = new Date(
        this.tokenExpiry.getTime() - FEDEX_API_CONFIG.TOKEN_REFRESH_BUFFER_MS,
      );

      if (now < expiryWithBuffer) {
        return; // Token still valid
      }
    }

    // If another request is already refreshing, wait for it
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    // Start token refresh
    this.tokenRefreshPromise = this.refreshToken();

    try {
      await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = undefined;
    }
  }

  /**
   * Refresh OAuth2 access token
   */
  private async refreshToken(): Promise<void> {
    this.logger.log('Refreshing FedEx OAuth token');

    const startTime = Date.now();

    try {
      // Build form-urlencoded body
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.apiKey,
        client_secret: this.config.secretKey,
      }).toString();

      const response = await fetch(
        `${this.config.apiUrl}${FEDEX_API_CONFIG.ENDPOINTS.OAUTH_TOKEN}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OAuth failed with status ${response.status}: ${errorText}`);
      }

      const data: FedExOAuthTokenResponse = await response.json();

      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(
        Date.now() + data.expires_in * 1000,
      );

      const duration = Date.now() - startTime;

      this.logger.log('OAuth token refreshed successfully', {
        expiresIn: data.expires_in,
        expiryTime: this.tokenExpiry.toISOString(),
      });

      // Log to integration logs
      await this.logRequest(
        FEDEX_API_CONFIG.ENDPOINTS.OAUTH_TOKEN,
        'POST',
        { grant_type: 'client_credentials' },
        { expires_in: data.expires_in, token_type: data.token_type },
        200,
        duration,
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.logger.error('Failed to refresh OAuth token', error, {
        error: error.message,
      });

      // Log failure
      await this.logRequest(
        FEDEX_API_CONFIG.ENDPOINTS.OAUTH_TOKEN,
        'POST',
        { grant_type: 'client_credentials' },
        null,
        500,
        duration,
        undefined,
        error.message,
      );

      throw new Error(`Failed to refresh FedEx OAuth token: ${error.message}`);
    }
  }

  /**
   * Apply rate limiting
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < FEDEX_API_CONFIG.MIN_REQUEST_INTERVAL_MS) {
      const delay = FEDEX_API_CONFIG.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(statusCode: number, retryCount: number): boolean {
    if (retryCount >= FEDEX_API_CONFIG.MAX_RETRIES) {
      return false;
    }

    return FEDEX_API_CONFIG.RETRY_STATUS_CODES.includes(statusCode);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = FEDEX_API_CONFIG.INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
    return Math.min(delay, FEDEX_API_CONFIG.MAX_RETRY_DELAY_MS);
  }

  /**
   * Format error message
   */
  private formatError(errorData?: FedExError): string {
    if (errorData?.errors && errorData.errors.length > 0) {
      return errorData.errors
        .map((e) => `${e.code}: ${e.message}`)
        .join('; ');
    }

    return 'Unknown error';
  }

  /**
   * Normalize FedEx error to application error
   */
  private normalizeError(errorData?: FedExError, statusCode?: number): Error {
    if (errorData?.errors && errorData.errors.length > 0) {
      const firstError = errorData.errors[0];
      const message = getFedExErrorMessage(firstError.code);
      
      const error = new Error(message);
      (error as any).code = firstError.code;
      (error as any).details = errorData.errors;
      (error as any).transactionId = errorData.transactionId;
      (error as any).statusCode = statusCode;
      
      return error;
    }

    const error = new Error(`FedEx API error (HTTP ${statusCode || 500})`);
    (error as any).statusCode = statusCode;
    return error;
  }

  /**
   * Log request/response to IntegrationLog
   */
  private async logRequest(
    endpoint: string,
    method: string,
    request: any,
    response: any,
    statusCode: number,
    duration: number,
    correlationId?: string,
    errorMessage?: string,
  ): Promise<void> {
    if (!this.integrationLogging) {
      return;
    }

    try {
      await this.integrationLogging.logIntegrationCall({
        organizationId: this.config.organizationId,
        integrationType: IntegrationType.FEDEX,
        direction: LogDirection.OUTBOUND,
        endpoint,
        method,
        request,
        response,
        statusCode,
        errorMessage,
        durationMs: duration,
        correlationId,
      });
    } catch (error: any) {
      // Don't let logging errors break the flow
      this.logger.error('Failed to log integration call', error);
    }
  }

  /**
   * Get current access token (for debugging)
   */
  getAccessToken(): string | undefined {
    return this.accessToken;
  }

  /**
   * Get token expiry (for debugging)
   */
  getTokenExpiry(): Date | undefined {
    return this.tokenExpiry;
  }
}
