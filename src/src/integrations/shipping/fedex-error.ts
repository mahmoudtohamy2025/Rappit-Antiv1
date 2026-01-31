/**
 * FedEx-Specific Error Classes
 * 
 * Custom error classes for FedEx API errors with proper error codes,
 * messages, and debugging information.
 */

import { FedExError as FedExAPIError } from './fedex.types';
import { getFedExErrorMessage } from './fedex.constants';

/**
 * Base FedEx Integration Error
 */
export class FedExError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly transactionId?: string;
  public readonly details?: any;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    options?: {
      statusCode?: number;
      transactionId?: string;
      details?: any;
      retryable?: boolean;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'FedExError';
    this.code = code;
    this.statusCode = options?.statusCode;
    this.transactionId = options?.transactionId;
    this.details = options?.details;
    this.retryable = options?.retryable ?? false;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FedExError);
    }

    // Include cause if provided
    if (options?.cause) {
      this.cause = options.cause;
    }
  }

  /**
   * Create FedExError from FedEx API error response
   */
  static fromAPIError(apiError: FedExAPIError, statusCode?: number): FedExError {
    const firstError = apiError.errors[0];
    const message = getFedExErrorMessage(firstError.code);
    const retryable = isRetryableError(firstError.code, statusCode);

    return new FedExError(message, firstError.code, {
      statusCode,
      transactionId: apiError.transactionId,
      details: apiError.errors,
      retryable,
    });
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      transactionId: this.transactionId,
      details: this.details,
      retryable: this.retryable,
      stack: this.stack,
    };
  }
}

/**
 * Authentication/Authorization Errors
 */
export class FedExAuthError extends FedExError {
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      transactionId?: string;
      details?: any;
      cause?: Error;
    },
  ) {
    super(message, 'FEDEX_AUTH_ERROR', {
      ...options,
      retryable: false, // Auth errors are not retryable
    });
    this.name = 'FedExAuthError';
  }
}

/**
 * Invalid Input/Validation Errors
 */
export class FedExValidationError extends FedExError {
  public readonly invalidFields?: string[];

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      transactionId?: string;
      details?: any;
      invalidFields?: string[];
      cause?: Error;
    },
  ) {
    super(message, 'FEDEX_VALIDATION_ERROR', {
      ...options,
      retryable: false, // Validation errors are not retryable
    });
    this.name = 'FedExValidationError';
    this.invalidFields = options?.invalidFields;
  }
}

/**
 * Rate Limiting Errors
 */
export class FedExRateLimitError extends FedExError {
  public readonly retryAfter?: number; // Seconds to wait before retry

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      transactionId?: string;
      details?: any;
      retryAfter?: number;
      cause?: Error;
    },
  ) {
    super(message, 'FEDEX_RATE_LIMIT_ERROR', {
      ...options,
      retryable: true, // Rate limit errors are retryable
    });
    this.name = 'FedExRateLimitError';
    this.retryAfter = options?.retryAfter;
  }
}

/**
 * Service Unavailable Errors
 */
export class FedExServiceUnavailableError extends FedExError {
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      transactionId?: string;
      details?: any;
      cause?: Error;
    },
  ) {
    super(message, 'FEDEX_SERVICE_UNAVAILABLE', {
      ...options,
      retryable: true, // Service unavailable is retryable
    });
    this.name = 'FedExServiceUnavailableError';
  }
}

/**
 * Tracking Not Found Errors
 */
export class FedExTrackingNotFoundError extends FedExError {
  public readonly trackingNumber: string;

  constructor(
    trackingNumber: string,
    options?: {
      statusCode?: number;
      transactionId?: string;
      details?: any;
      cause?: Error;
    },
  ) {
    super(`Tracking number not found: ${trackingNumber}`, 'FEDEX_TRACKING_NOT_FOUND', {
      ...options,
      retryable: false, // Not found errors are not retryable
    });
    this.name = 'FedExTrackingNotFoundError';
    this.trackingNumber = trackingNumber;
  }
}

/**
 * Network/Timeout Errors
 */
export class FedExNetworkError extends FedExError {
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      transactionId?: string;
      details?: any;
      cause?: Error;
    },
  ) {
    super(message, 'FEDEX_NETWORK_ERROR', {
      ...options,
      retryable: true, // Network errors are retryable
    });
    this.name = 'FedExNetworkError';
  }
}

/**
 * Configuration Errors
 */
export class FedExConfigError extends FedExError {
  constructor(
    message: string,
    options?: {
      details?: any;
      cause?: Error;
    },
  ) {
    super(message, 'FEDEX_CONFIG_ERROR', {
      ...options,
      retryable: false, // Config errors are not retryable
    });
    this.name = 'FedExConfigError';
  }
}

/**
 * Helper function to determine if error is retryable
 */
function isRetryableError(errorCode: string, statusCode?: number): boolean {
  // Retryable HTTP status codes
  const retryableStatusCodes = [429, 500, 502, 503, 504];
  if (statusCode && retryableStatusCodes.includes(statusCode)) {
    return true;
  }

  // Retryable FedEx error codes
  const retryableErrorCodes = [
    'SERVICE.UNAVAILABLE.ERROR',
    'INTERNAL.SERVER.ERROR',
    'TIMEOUT.ERROR',
  ];
  return retryableErrorCodes.includes(errorCode);
}

/**
 * Helper function to create appropriate error from API response
 */
export function createFedExError(
  apiError: FedExAPIError,
  statusCode?: number,
): FedExError {
  const firstError = apiError.errors[0];

  // Handle specific error types
  switch (firstError.code) {
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      return new FedExAuthError(getFedExErrorMessage(firstError.code), {
        statusCode,
        transactionId: apiError.transactionId,
        details: apiError.errors,
      });

    case 'INVALID.INPUT.EXCEPTION':
      return new FedExValidationError(getFedExErrorMessage(firstError.code), {
        statusCode,
        transactionId: apiError.transactionId,
        details: apiError.errors,
        invalidFields: extractInvalidFields(apiError),
      });

    case 'TRACKING.TRACKINGNUMBER.NOTFOUND':
      const trackingNumber = extractTrackingNumber(apiError);
      return new FedExTrackingNotFoundError(trackingNumber, {
        statusCode,
        transactionId: apiError.transactionId,
        details: apiError.errors,
      });

    case 'SERVICE.UNAVAILABLE.ERROR':
      return new FedExServiceUnavailableError(getFedExErrorMessage(firstError.code), {
        statusCode,
        transactionId: apiError.transactionId,
        details: apiError.errors,
      });

    default:
      // Default to base FedExError
      return FedExError.fromAPIError(apiError, statusCode);
  }
}

/**
 * Extract invalid field names from error details
 */
function extractInvalidFields(apiError: FedExAPIError): string[] {
  const fields: string[] = [];

  for (const error of apiError.errors) {
    if (error.parameterList) {
      for (const param of error.parameterList) {
        fields.push(param.key);
      }
    }
  }

  return fields;
}

/**
 * Extract tracking number from error details
 */
function extractTrackingNumber(apiError: FedExAPIError): string {
  for (const error of apiError.errors) {
    if (error.parameterList) {
      for (const param of error.parameterList) {
        if (param.key === 'trackingNumber') {
          return param.value;
        }
      }
    }
  }
  return 'unknown';
}

/**
 * Type guard to check if error is a FedExError
 */
export function isFedExError(error: any): error is FedExError {
  return error instanceof FedExError;
}

/**
 * Type guard to check if error is retryable
 */
export function isRetryableFedExError(error: any): boolean {
  return isFedExError(error) && error.retryable;
}
