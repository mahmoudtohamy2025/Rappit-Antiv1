/**
 * FedEx Integration Constants
 * 
 * Constants for FedEx API integration including status mappings,
 * service types, and configuration values.
 */

import { ShipmentStatus } from '@prisma/client';
import { FedExServiceType } from './fedex.types';

// ============================================================================
// Status Code Mappings
// ============================================================================

/**
 * Map FedEx tracking status codes to internal ShipmentStatus enum
 * 
 * FedEx Status Codes:
 * - PU: Picked up
 * - IT: In transit
 * - AR: Arrived at FedEx location
 * - DP: Departed FedEx location
 * - OD: Out for delivery
 * - DL: Delivered
 * - DE: Delivery exception
 * - CA: Cancelled
 * - RS: Returned to shipper
 * - PX: Pickup exception
 */
export const FEDEX_STATUS_MAPPING: Record<string, ShipmentStatus> = {
  // Pickup
  PU: ShipmentStatus.IN_TRANSIT,
  PX: ShipmentStatus.EXCEPTION,
  
  // In Transit
  IT: ShipmentStatus.IN_TRANSIT,
  AR: ShipmentStatus.IN_TRANSIT,
  DP: ShipmentStatus.IN_TRANSIT,
  
  // Out for Delivery
  OD: ShipmentStatus.OUT_FOR_DELIVERY,
  
  // Delivered
  DL: ShipmentStatus.DELIVERED,
  
  // Exceptions
  DE: ShipmentStatus.EXCEPTION,
  
  // Cancelled
  CA: ShipmentStatus.CANCELLED,
  
  // Returned
  RS: ShipmentStatus.RETURNED,
};

/**
 * Get internal shipment status from FedEx status code
 */
export function mapFedExStatusToInternal(fedexStatus: string): ShipmentStatus {
  return FEDEX_STATUS_MAPPING[fedexStatus] || ShipmentStatus.IN_TRANSIT;
}

/**
 * Check if FedEx status is terminal (no further updates expected)
 */
export function isFedExStatusTerminal(fedexStatus: string): boolean {
  const status = FEDEX_STATUS_MAPPING[fedexStatus];
  return status === ShipmentStatus.DELIVERED ||
         status === ShipmentStatus.CANCELLED ||
         status === ShipmentStatus.RETURNED;
}

// ============================================================================
// Service Type Mappings
// ============================================================================

export const FEDEX_SERVICE_NAMES: Record<FedExServiceType, string> = {
  [FedExServiceType.PRIORITY_OVERNIGHT]: 'FedEx Priority Overnight',
  [FedExServiceType.STANDARD_OVERNIGHT]: 'FedEx Standard Overnight',
  [FedExServiceType.FIRST_OVERNIGHT]: 'FedEx First Overnight',
  [FedExServiceType.FEDEX_2_DAY]: 'FedEx 2Day',
  [FedExServiceType.FEDEX_2_DAY_AM]: 'FedEx 2Day AM',
  [FedExServiceType.FEDEX_EXPRESS_SAVER]: 'FedEx Express Saver',
  [FedExServiceType.FEDEX_GROUND]: 'FedEx Ground',
  [FedExServiceType.INTERNATIONAL_PRIORITY]: 'FedEx International Priority',
  [FedExServiceType.INTERNATIONAL_ECONOMY]: 'FedEx International Economy',
  [FedExServiceType.INTERNATIONAL_FIRST]: 'FedEx International First',
  [FedExServiceType.INTERNATIONAL_PRIORITY_EXPRESS]: 'FedEx International Priority Express',
  [FedExServiceType.INTERNATIONAL_GROUND]: 'FedEx International Ground',
};

// ============================================================================
// API Configuration
// ============================================================================

export const FEDEX_API_CONFIG = {
  // Rate limiting (FedEx allows ~500 requests/minute)
  MAX_REQUESTS_PER_MINUTE: 500,
  MIN_REQUEST_INTERVAL_MS: 120, // 500 req/min = ~120ms between requests
  
  // Retry configuration
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 1000,
  MAX_RETRY_DELAY_MS: 30000,
  RETRY_STATUS_CODES: [429, 500, 502, 503, 504],
  
  // Token management
  TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000, // Refresh 5 minutes before expiry
  TOKEN_EXPIRY_SECONDS: 3600, // Default FedEx token lifetime
  
  // Request timeouts
  REQUEST_TIMEOUT_MS: 30000, // 30 seconds
  
  // Endpoints (relative to base URL)
  ENDPOINTS: {
    OAUTH_TOKEN: '/oauth/token',
    CREATE_SHIPMENT: '/ship/v1/shipments',
    TRACK: '/track/v1/trackingnumbers',
    CANCEL_SHIPMENT: '/ship/v1/shipments/cancel',
    RATE_QUOTE: '/rate/v1/rates/quotes',
    VALIDATE_ADDRESS: '/address/v1/addresses/resolve',
  },
};

// ============================================================================
// Default Values
// ============================================================================

export const FEDEX_DEFAULTS = {
  PICKUP_TYPE: 'USE_SCHEDULED_PICKUP' as const,
  PACKAGING_TYPE: 'YOUR_PACKAGING' as const,
  LABEL_FORMAT_TYPE: 'COMMON2D' as const,
  LABEL_IMAGE_TYPE: 'PDF' as const,
  LABEL_STOCK_TYPE: 'PAPER_4X6' as const,
  WEIGHT_UNITS: 'KG' as const,
  DIMENSION_UNITS: 'CM' as const,
  PAYMENT_TYPE: 'SENDER' as const,
  SERVICE_TYPE: FedExServiceType.FEDEX_GROUND,
};

// ============================================================================
// Error Messages
// ============================================================================

export const FEDEX_ERROR_MESSAGES: Record<string, string> = {
  'INVALID.INPUT.EXCEPTION': 'Invalid input provided to FedEx API',
  'SHIPPER.ACCOUNT.REQUIRED': 'FedEx shipper account number is required',
  'SERVICE.UNAVAILABLE.ERROR': 'FedEx service temporarily unavailable',
  'TRACKING.TRACKINGNUMBER.NOTFOUND': 'Tracking number not found in FedEx system',
  'UNAUTHORIZED': 'FedEx API authentication failed',
  'FORBIDDEN': 'Access forbidden - check FedEx account permissions',
  'NOT.FOUND.ERROR': 'Requested resource not found',
  'INTERNAL.SERVER.ERROR': 'FedEx internal server error',
};

/**
 * Get user-friendly error message for FedEx error code
 */
export function getFedExErrorMessage(errorCode: string): string {
  return FEDEX_ERROR_MESSAGES[errorCode] || `FedEx error: ${errorCode}`;
}

// ============================================================================
// Validation Rules
// ============================================================================

export const FEDEX_VALIDATION = {
  // Package constraints
  MAX_PACKAGE_WEIGHT_KG: 68, // 150 lbs
  MAX_PACKAGE_LENGTH_CM: 274, // 108 inches
  MAX_PACKAGE_GIRTH_CM: 419, // 165 inches (length + 2×width + 2×height)
  
  // Address constraints
  MAX_STREET_LINES: 3,
  MAX_STREET_LINE_LENGTH: 35,
  MAX_CITY_LENGTH: 35,
  POSTAL_CODE_PATTERN: /^[0-9A-Z\-\s]{3,12}$/i,
  
  // Phone number
  PHONE_NUMBER_PATTERN: /^\+?[0-9]{10,15}$/,
  
  // Tracking number
  TRACKING_NUMBER_PATTERN: /^[0-9]{12,22}$/,
};

/**
 * Validate FedEx tracking number format
 */
export function isValidFedExTrackingNumber(trackingNumber: string): boolean {
  return FEDEX_VALIDATION.TRACKING_NUMBER_PATTERN.test(trackingNumber);
}

/**
 * Validate package weight
 */
export function isValidPackageWeight(weightKg: number): boolean {
  return weightKg > 0 && weightKg <= FEDEX_VALIDATION.MAX_PACKAGE_WEIGHT_KG;
}

/**
 * Validate package dimensions
 */
export function isValidPackageDimensions(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
): boolean {
  const girth = lengthCm + 2 * widthCm + 2 * heightCm;
  return (
    lengthCm > 0 &&
    widthCm > 0 &&
    heightCm > 0 &&
    lengthCm <= FEDEX_VALIDATION.MAX_PACKAGE_LENGTH_CM &&
    girth <= FEDEX_VALIDATION.MAX_PACKAGE_GIRTH_CM
  );
}
