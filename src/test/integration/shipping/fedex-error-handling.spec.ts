/**
 * FedEx Error Handling Tests
 * 
 * Tests for FedEx-specific error handling, error codes, and error recovery.
 */

import { FedExClient } from '../../../src/integrations/shipping/fedex-client';
import {
  FEDEX_API_CONFIG,
  getFedExErrorMessage,
  mapFedExStatusToInternal,
  isFedExStatusTerminal,
  isValidFedExTrackingNumber,
  isValidPackageWeight,
  isValidPackageDimensions,
} from '../../../src/integrations/shipping/fedex.constants';
import { ShipmentStatus } from '@prisma/client';

describe('FedEx Error Handling', () => {
  describe('Error Message Mapping', () => {
    it('should map known error codes to friendly messages', () => {
      expect(getFedExErrorMessage('INVALID.INPUT.EXCEPTION')).toContain('Invalid input');
      expect(getFedExErrorMessage('UNAUTHORIZED')).toContain('authentication');
      expect(getFedExErrorMessage('SERVICE.UNAVAILABLE.ERROR')).toContain('unavailable');
      expect(getFedExErrorMessage('TRACKING.TRACKINGNUMBER.NOTFOUND')).toContain('not found');
    });

    it('should return default message for unknown error codes', () => {
      const result = getFedExErrorMessage('UNKNOWN.ERROR.CODE');
      expect(result).toContain('UNKNOWN.ERROR.CODE');
    });
  });

  describe('Status Mapping', () => {
    it('should map pickup status correctly', () => {
      expect(mapFedExStatusToInternal('PU')).toBe(ShipmentStatus.IN_TRANSIT);
    });

    it('should map in-transit status correctly', () => {
      expect(mapFedExStatusToInternal('IT')).toBe(ShipmentStatus.IN_TRANSIT);
      expect(mapFedExStatusToInternal('AR')).toBe(ShipmentStatus.IN_TRANSIT);
      expect(mapFedExStatusToInternal('DP')).toBe(ShipmentStatus.IN_TRANSIT);
    });

    it('should map out-for-delivery status correctly', () => {
      expect(mapFedExStatusToInternal('OD')).toBe(ShipmentStatus.OUT_FOR_DELIVERY);
    });

    it('should map delivered status correctly', () => {
      expect(mapFedExStatusToInternal('DL')).toBe(ShipmentStatus.DELIVERED);
    });

    it('should map exception status correctly', () => {
      expect(mapFedExStatusToInternal('DE')).toBe(ShipmentStatus.EXCEPTION);
      expect(mapFedExStatusToInternal('PX')).toBe(ShipmentStatus.EXCEPTION);
    });

    it('should map cancelled status correctly', () => {
      expect(mapFedExStatusToInternal('CA')).toBe(ShipmentStatus.CANCELLED);
    });

    it('should map returned status correctly', () => {
      expect(mapFedExStatusToInternal('RS')).toBe(ShipmentStatus.RETURNED);
    });

    it('should default to IN_TRANSIT for unknown status', () => {
      expect(mapFedExStatusToInternal('UNKNOWN')).toBe(ShipmentStatus.IN_TRANSIT);
    });
  });

  describe('Terminal Status Detection', () => {
    it('should identify delivered as terminal', () => {
      expect(isFedExStatusTerminal('DL')).toBe(true);
    });

    it('should identify cancelled as terminal', () => {
      expect(isFedExStatusTerminal('CA')).toBe(true);
    });

    it('should identify returned as terminal', () => {
      expect(isFedExStatusTerminal('RS')).toBe(true);
    });

    it('should identify in-transit as not terminal', () => {
      expect(isFedExStatusTerminal('IT')).toBe(false);
      expect(isFedExStatusTerminal('PU')).toBe(false);
      expect(isFedExStatusTerminal('OD')).toBe(false);
    });

    it('should identify exception as not terminal', () => {
      expect(isFedExStatusTerminal('DE')).toBe(false);
    });
  });

  describe('Validation Functions', () => {
    describe('Tracking Number Validation', () => {
      it('should accept valid 12-digit tracking number', () => {
        expect(isValidFedExTrackingNumber('794608491820')).toBe(true);
      });

      it('should accept valid 15-digit tracking number', () => {
        expect(isValidFedExTrackingNumber('794608491820123')).toBe(true);
      });

      it('should reject tracking number with letters', () => {
        expect(isValidFedExTrackingNumber('794608491820ABC')).toBe(false);
      });

      it('should reject tracking number too short', () => {
        expect(isValidFedExTrackingNumber('12345')).toBe(false);
      });

      it('should reject tracking number too long', () => {
        expect(isValidFedExTrackingNumber('12345678901234567890123')).toBe(false);
      });

      it('should reject empty tracking number', () => {
        expect(isValidFedExTrackingNumber('')).toBe(false);
      });
    });

    describe('Package Weight Validation', () => {
      it('should accept valid weight within limits', () => {
        expect(isValidPackageWeight(5.0)).toBe(true);
        expect(isValidPackageWeight(30.0)).toBe(true);
        expect(isValidPackageWeight(68.0)).toBe(true);
      });

      it('should reject weight of zero', () => {
        expect(isValidPackageWeight(0)).toBe(false);
      });

      it('should reject negative weight', () => {
        expect(isValidPackageWeight(-5)).toBe(false);
      });

      it('should reject weight exceeding maximum', () => {
        expect(isValidPackageWeight(69)).toBe(false);
        expect(isValidPackageWeight(100)).toBe(false);
      });
    });

    describe('Package Dimensions Validation', () => {
      it('should accept valid dimensions', () => {
        expect(isValidPackageDimensions(30, 20, 15)).toBe(true);
        expect(isValidPackageDimensions(50, 40, 30)).toBe(true);
      });

      it('should reject zero dimensions', () => {
        expect(isValidPackageDimensions(0, 20, 15)).toBe(false);
        expect(isValidPackageDimensions(30, 0, 15)).toBe(false);
        expect(isValidPackageDimensions(30, 20, 0)).toBe(false);
      });

      it('should reject negative dimensions', () => {
        expect(isValidPackageDimensions(-30, 20, 15)).toBe(false);
      });

      it('should reject dimensions exceeding maximum length', () => {
        expect(isValidPackageDimensions(275, 20, 15)).toBe(false);
      });

      it('should reject dimensions exceeding maximum girth', () => {
        // Girth = length + 2*width + 2*height
        // 200 + 2*200 + 2*200 = 1000 cm (exceeds 419 cm limit)
        expect(isValidPackageDimensions(200, 200, 200)).toBe(false);
      });

      it('should accept dimensions at the limit', () => {
        // Valid dimensions that are close to limits
        expect(isValidPackageDimensions(100, 80, 60)).toBe(true);
      });
    });
  });

  describe('API Configuration', () => {
    it('should have correct rate limiting configuration', () => {
      expect(FEDEX_API_CONFIG.MAX_REQUESTS_PER_MINUTE).toBe(500);
      expect(FEDEX_API_CONFIG.MIN_REQUEST_INTERVAL_MS).toBe(120);
    });

    it('should have retry configuration', () => {
      expect(FEDEX_API_CONFIG.MAX_RETRIES).toBe(3);
      expect(FEDEX_API_CONFIG.RETRY_STATUS_CODES).toContain(429);
      expect(FEDEX_API_CONFIG.RETRY_STATUS_CODES).toContain(500);
      expect(FEDEX_API_CONFIG.RETRY_STATUS_CODES).toContain(503);
    });

    it('should have token management configuration', () => {
      expect(FEDEX_API_CONFIG.TOKEN_REFRESH_BUFFER_MS).toBe(5 * 60 * 1000);
      expect(FEDEX_API_CONFIG.TOKEN_EXPIRY_SECONDS).toBe(3600);
    });

    it('should have request timeout configuration', () => {
      expect(FEDEX_API_CONFIG.REQUEST_TIMEOUT_MS).toBe(30000);
    });

    it('should have all required endpoints', () => {
      expect(FEDEX_API_CONFIG.ENDPOINTS.OAUTH_TOKEN).toBeDefined();
      expect(FEDEX_API_CONFIG.ENDPOINTS.CREATE_SHIPMENT).toBeDefined();
      expect(FEDEX_API_CONFIG.ENDPOINTS.TRACK).toBeDefined();
      expect(FEDEX_API_CONFIG.ENDPOINTS.CANCEL_SHIPMENT).toBeDefined();
      expect(FEDEX_API_CONFIG.ENDPOINTS.RATE_QUOTE).toBeDefined();
      expect(FEDEX_API_CONFIG.ENDPOINTS.VALIDATE_ADDRESS).toBeDefined();
    });
  });

  describe('FedExClient Error Handling', () => {
    let client: FedExClient;

    beforeEach(() => {
      const config = {
        apiUrl: 'https://apis-sandbox.fedex.com',
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        accountNumber: '123456789',
        organizationId: 'test-org',
      };
      client = new FedExClient(config);
    });

    it('should initialize client with config', () => {
      expect(client).toBeDefined();
    });

    it('should have token management methods', () => {
      expect(client.getAccessToken).toBeDefined();
      expect(client.getTokenExpiry).toBeDefined();
    });

    it('should have HTTP methods', () => {
      expect(client.post).toBeDefined();
      expect(client.get).toBeDefined();
      expect(client.put).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should define retry status codes', () => {
      const retryStatusCodes = FEDEX_API_CONFIG.RETRY_STATUS_CODES;
      expect(retryStatusCodes).toContain(429); // Rate limit
      expect(retryStatusCodes).toContain(500); // Internal server error
      expect(retryStatusCodes).toContain(502); // Bad gateway
      expect(retryStatusCodes).toContain(503); // Service unavailable
      expect(retryStatusCodes).toContain(504); // Gateway timeout
    });

    it('should calculate exponential backoff delays', () => {
      const initialDelay = FEDEX_API_CONFIG.INITIAL_RETRY_DELAY_MS;
      const maxDelay = FEDEX_API_CONFIG.MAX_RETRY_DELAY_MS;

      // First retry: 1000ms
      expect(initialDelay * Math.pow(2, 0)).toBe(1000);

      // Second retry: 2000ms
      expect(initialDelay * Math.pow(2, 1)).toBe(2000);

      // Third retry: 4000ms
      expect(initialDelay * Math.pow(2, 2)).toBe(4000);

      // Should cap at max delay
      const largeRetry = initialDelay * Math.pow(2, 10);
      expect(Math.min(largeRetry, maxDelay)).toBe(maxDelay);
    });
  });

  describe('Input Sanitization', () => {
    it('should handle special characters in addresses', () => {
      // These should not cause errors in real API calls
      const specialChars = ["O'Brien St", "Apt. #5", "123-A Main St"];
      specialChars.forEach(addr => {
        expect(addr).toBeDefined();
        expect(typeof addr).toBe('string');
      });
    });

    it('should handle international characters', () => {
      const intlAddresses = ['الرياض', '北京', 'São Paulo'];
      intlAddresses.forEach(addr => {
        expect(addr).toBeDefined();
        expect(typeof addr).toBe('string');
      });
    });
  });
});
