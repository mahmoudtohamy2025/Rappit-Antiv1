/**
 * FedEx Constants Unit Tests
 * 
 * Tests for pure functions in fedex.constants.ts
 * These are deterministic functions with observable outputs.
 */

import {
  mapFedExStatusToInternal,
  isFedExStatusTerminal,
  getFedExErrorMessage,
  isValidFedExTrackingNumber,
  isValidPackageWeight,
  isValidPackageDimensions,
  FEDEX_STATUS_MAPPING,
  FEDEX_VALIDATION,
  FEDEX_API_CONFIG,
  FEDEX_DEFAULTS,
  FEDEX_ERROR_MESSAGES,
} from '../../src/integrations/shipping/fedex.constants';
import { ShipmentStatus } from '@prisma/client';

describe('FedEx Constants - Pure Functions', () => {
  describe('mapFedExStatusToInternal', () => {
    it('should map PU (Picked up) to IN_TRANSIT', () => {
      expect(mapFedExStatusToInternal('PU')).toBe(ShipmentStatus.IN_TRANSIT);
    });

    it('should map IT (In transit) to IN_TRANSIT', () => {
      expect(mapFedExStatusToInternal('IT')).toBe(ShipmentStatus.IN_TRANSIT);
    });

    it('should map AR (Arrived) to IN_TRANSIT', () => {
      expect(mapFedExStatusToInternal('AR')).toBe(ShipmentStatus.IN_TRANSIT);
    });

    it('should map DP (Departed) to IN_TRANSIT', () => {
      expect(mapFedExStatusToInternal('DP')).toBe(ShipmentStatus.IN_TRANSIT);
    });

    it('should map OD (Out for delivery) to OUT_FOR_DELIVERY', () => {
      expect(mapFedExStatusToInternal('OD')).toBe(ShipmentStatus.OUT_FOR_DELIVERY);
    });

    it('should map DL (Delivered) to DELIVERED', () => {
      expect(mapFedExStatusToInternal('DL')).toBe(ShipmentStatus.DELIVERED);
    });

    it('should map DE (Delivery exception) to EXCEPTION', () => {
      expect(mapFedExStatusToInternal('DE')).toBe(ShipmentStatus.EXCEPTION);
    });

    it('should map PX (Pickup exception) to EXCEPTION', () => {
      expect(mapFedExStatusToInternal('PX')).toBe(ShipmentStatus.EXCEPTION);
    });

    it('should map CA (Cancelled) to CANCELLED', () => {
      expect(mapFedExStatusToInternal('CA')).toBe(ShipmentStatus.CANCELLED);
    });

    it('should map RS (Returned) to RETURNED', () => {
      expect(mapFedExStatusToInternal('RS')).toBe(ShipmentStatus.RETURNED);
    });

    it('should return IN_TRANSIT for unknown status codes', () => {
      expect(mapFedExStatusToInternal('UNKNOWN')).toBe(ShipmentStatus.IN_TRANSIT);
      expect(mapFedExStatusToInternal('XYZ')).toBe(ShipmentStatus.IN_TRANSIT);
      expect(mapFedExStatusToInternal('')).toBe(ShipmentStatus.IN_TRANSIT);
    });
  });

  describe('isFedExStatusTerminal', () => {
    it('should return true for DL (Delivered)', () => {
      expect(isFedExStatusTerminal('DL')).toBe(true);
    });

    it('should return true for CA (Cancelled)', () => {
      expect(isFedExStatusTerminal('CA')).toBe(true);
    });

    it('should return true for RS (Returned)', () => {
      expect(isFedExStatusTerminal('RS')).toBe(true);
    });

    it('should return false for in-transit statuses', () => {
      expect(isFedExStatusTerminal('IT')).toBe(false);
      expect(isFedExStatusTerminal('PU')).toBe(false);
      expect(isFedExStatusTerminal('OD')).toBe(false);
      expect(isFedExStatusTerminal('AR')).toBe(false);
      expect(isFedExStatusTerminal('DP')).toBe(false);
    });

    it('should return false for exception statuses (may recover)', () => {
      expect(isFedExStatusTerminal('DE')).toBe(false);
      expect(isFedExStatusTerminal('PX')).toBe(false);
    });

    it('should return false for unknown statuses', () => {
      expect(isFedExStatusTerminal('UNKNOWN')).toBe(false);
    });
  });

  describe('getFedExErrorMessage', () => {
    it('should return user-friendly message for known error codes', () => {
      expect(getFedExErrorMessage('INVALID.INPUT.EXCEPTION')).toBe('Invalid input provided to FedEx API');
      expect(getFedExErrorMessage('SHIPPER.ACCOUNT.REQUIRED')).toBe('FedEx shipper account number is required');
      expect(getFedExErrorMessage('SERVICE.UNAVAILABLE.ERROR')).toBe('FedEx service temporarily unavailable');
      expect(getFedExErrorMessage('TRACKING.TRACKINGNUMBER.NOTFOUND')).toBe('Tracking number not found in FedEx system');
      expect(getFedExErrorMessage('UNAUTHORIZED')).toBe('FedEx API authentication failed');
      expect(getFedExErrorMessage('FORBIDDEN')).toBe('Access forbidden - check FedEx account permissions');
      expect(getFedExErrorMessage('NOT.FOUND.ERROR')).toBe('Requested resource not found');
      expect(getFedExErrorMessage('INTERNAL.SERVER.ERROR')).toBe('FedEx internal server error');
    });

    it('should return generic message for unknown error codes', () => {
      expect(getFedExErrorMessage('SOME_UNKNOWN_CODE')).toBe('FedEx error: SOME_UNKNOWN_CODE');
      expect(getFedExErrorMessage('')).toBe('FedEx error: ');
    });
  });

  describe('isValidFedExTrackingNumber', () => {
    it('should accept valid 12-digit tracking numbers', () => {
      expect(isValidFedExTrackingNumber('123456789012')).toBe(true);
    });

    it('should accept valid 15-digit tracking numbers', () => {
      expect(isValidFedExTrackingNumber('123456789012345')).toBe(true);
    });

    it('should accept valid 22-digit tracking numbers', () => {
      expect(isValidFedExTrackingNumber('1234567890123456789012')).toBe(true);
    });

    it('should reject tracking numbers shorter than 12 digits', () => {
      expect(isValidFedExTrackingNumber('12345678901')).toBe(false);
      expect(isValidFedExTrackingNumber('123')).toBe(false);
      expect(isValidFedExTrackingNumber('')).toBe(false);
    });

    it('should reject tracking numbers longer than 22 digits', () => {
      expect(isValidFedExTrackingNumber('12345678901234567890123')).toBe(false);
    });

    it('should reject tracking numbers with non-digit characters', () => {
      expect(isValidFedExTrackingNumber('12345678901A')).toBe(false);
      expect(isValidFedExTrackingNumber('1234-5678-9012')).toBe(false);
      expect(isValidFedExTrackingNumber('FEDEX12345678')).toBe(false);
    });
  });

  describe('isValidPackageWeight', () => {
    it('should accept valid weights within limits', () => {
      expect(isValidPackageWeight(1)).toBe(true);
      expect(isValidPackageWeight(10)).toBe(true);
      expect(isValidPackageWeight(50)).toBe(true);
      expect(isValidPackageWeight(68)).toBe(true); // MAX_PACKAGE_WEIGHT_KG
    });

    it('should accept fractional weights', () => {
      expect(isValidPackageWeight(0.5)).toBe(true);
      expect(isValidPackageWeight(10.75)).toBe(true);
    });

    it('should reject zero weight', () => {
      expect(isValidPackageWeight(0)).toBe(false);
    });

    it('should reject negative weights', () => {
      expect(isValidPackageWeight(-1)).toBe(false);
      expect(isValidPackageWeight(-10)).toBe(false);
    });

    it('should reject weights exceeding maximum', () => {
      expect(isValidPackageWeight(68.1)).toBe(false);
      expect(isValidPackageWeight(100)).toBe(false);
      expect(isValidPackageWeight(1000)).toBe(false);
    });
  });

  describe('isValidPackageDimensions', () => {
    it('should accept valid dimensions within limits', () => {
      expect(isValidPackageDimensions(50, 30, 20)).toBe(true);
      expect(isValidPackageDimensions(100, 50, 40)).toBe(true);
    });

    it('should accept maximum allowed length', () => {
      // MAX_PACKAGE_LENGTH_CM = 274
      // With minimal width/height to stay under girth limit
      expect(isValidPackageDimensions(274, 10, 10)).toBe(true);
    });

    it('should reject dimensions with zero values', () => {
      expect(isValidPackageDimensions(0, 30, 20)).toBe(false);
      expect(isValidPackageDimensions(50, 0, 20)).toBe(false);
      expect(isValidPackageDimensions(50, 30, 0)).toBe(false);
    });

    it('should reject negative dimensions', () => {
      expect(isValidPackageDimensions(-10, 30, 20)).toBe(false);
      expect(isValidPackageDimensions(50, -30, 20)).toBe(false);
      expect(isValidPackageDimensions(50, 30, -20)).toBe(false);
    });

    it('should reject length exceeding maximum', () => {
      // MAX_PACKAGE_LENGTH_CM = 274
      expect(isValidPackageDimensions(275, 10, 10)).toBe(false);
      expect(isValidPackageDimensions(300, 10, 10)).toBe(false);
    });

    it('should reject packages exceeding girth limit', () => {
      // MAX_PACKAGE_GIRTH_CM = 419
      // girth = length + 2*width + 2*height
      // 100 + 2*80 + 2*80 = 100 + 160 + 160 = 420 > 419
      expect(isValidPackageDimensions(100, 80, 80)).toBe(false);
    });

    it('should accept packages at exactly the girth limit', () => {
      // girth = 100 + 2*79 + 2*80 = 100 + 158 + 160 = 418 <= 419
      expect(isValidPackageDimensions(100, 79, 80)).toBe(true);
    });
  });

  describe('Constants Integrity', () => {
    it('should have all expected status codes in FEDEX_STATUS_MAPPING', () => {
      const expectedCodes = ['PU', 'PX', 'IT', 'AR', 'DP', 'OD', 'DL', 'DE', 'CA', 'RS'];
      expectedCodes.forEach(code => {
        expect(FEDEX_STATUS_MAPPING).toHaveProperty(code);
      });
    });

    it('should have correct validation constants', () => {
      expect(FEDEX_VALIDATION.MAX_PACKAGE_WEIGHT_KG).toBe(68);
      expect(FEDEX_VALIDATION.MAX_PACKAGE_LENGTH_CM).toBe(274);
      expect(FEDEX_VALIDATION.MAX_PACKAGE_GIRTH_CM).toBe(419);
      expect(FEDEX_VALIDATION.MAX_STREET_LINES).toBe(3);
      expect(FEDEX_VALIDATION.MAX_STREET_LINE_LENGTH).toBe(35);
      expect(FEDEX_VALIDATION.MAX_CITY_LENGTH).toBe(35);
    });

    it('should have correct API config values', () => {
      expect(FEDEX_API_CONFIG.MAX_REQUESTS_PER_MINUTE).toBe(500);
      expect(FEDEX_API_CONFIG.MAX_RETRIES).toBe(3);
      expect(FEDEX_API_CONFIG.REQUEST_TIMEOUT_MS).toBe(30000);
      expect(FEDEX_API_CONFIG.TOKEN_EXPIRY_SECONDS).toBe(3600);
    });

    it('should have correct default values', () => {
      expect(FEDEX_DEFAULTS.PICKUP_TYPE).toBe('USE_SCHEDULED_PICKUP');
      expect(FEDEX_DEFAULTS.PACKAGING_TYPE).toBe('YOUR_PACKAGING');
      expect(FEDEX_DEFAULTS.LABEL_FORMAT_TYPE).toBe('COMMON2D');
      expect(FEDEX_DEFAULTS.LABEL_IMAGE_TYPE).toBe('PDF');
      expect(FEDEX_DEFAULTS.LABEL_STOCK_TYPE).toBe('PAPER_4X6');
      expect(FEDEX_DEFAULTS.WEIGHT_UNITS).toBe('KG');
      expect(FEDEX_DEFAULTS.DIMENSION_UNITS).toBe('CM');
      expect(FEDEX_DEFAULTS.PAYMENT_TYPE).toBe('SENDER');
    });
  });
});
