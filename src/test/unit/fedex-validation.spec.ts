/**
 * FedEx Validation Unit Tests
 * 
 * Tests for pure validation functions in fedex-validation.ts
 * These are deterministic functions with observable outputs.
 */

import {
  validateShipmentRequest,
  validateTrackingRequest,
  validateRateQuoteRequest,
  validateAddressValidationRequest,
  validateOrThrow,
  sanitizeString,
  sanitizePhoneNumber,
} from '../../src/integrations/shipping/fedex-validation';
import { FedExValidationError } from '../../src/integrations/shipping/fedex-error';

describe('FedEx Validation - Pure Functions', () => {
  describe('validateTrackingRequest', () => {
    it('should accept valid tracking numbers', () => {
      const result = validateTrackingRequest('123456789012');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid 15-digit tracking numbers', () => {
      const result = validateTrackingRequest('123456789012345');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty tracking number', () => {
      const result = validateTrackingRequest('');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('trackingNumber');
      expect(result.errors[0].message).toBe('Tracking number is required');
    });

    it('should reject whitespace-only tracking number', () => {
      const result = validateTrackingRequest('   ');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Tracking number is required');
    });

    it('should reject invalid format tracking numbers', () => {
      const result = validateTrackingRequest('12345');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid FedEx tracking number format');
    });

    it('should reject tracking numbers with letters', () => {
      const result = validateTrackingRequest('12345ABCDEF12');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('validateAddressValidationRequest', () => {
    const validAddress = {
      street: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    it('should accept valid address', () => {
      const result = validateAddressValidationRequest(validAddress);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing street', () => {
      const result = validateAddressValidationRequest({
        ...validAddress,
        street: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'street')).toBe(true);
    });

    it('should reject missing city', () => {
      const result = validateAddressValidationRequest({
        ...validAddress,
        city: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'city')).toBe(true);
    });

    it('should reject missing postal code', () => {
      const result = validateAddressValidationRequest({
        ...validAddress,
        postalCode: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'postalCode')).toBe(true);
    });

    it('should reject missing country', () => {
      const result = validateAddressValidationRequest({
        ...validAddress,
        country: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'country')).toBe(true);
    });

    it('should collect multiple errors', () => {
      const result = validateAddressValidationRequest({
        street: '',
        city: '',
        postalCode: '',
        country: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(4);
    });
  });

  describe('validateRateQuoteRequest', () => {
    const validRequest = {
      shipper: {
        city: 'New York',
        postalCode: '10001',
        country: 'US',
      },
      recipient: {
        city: 'Los Angeles',
        postalCode: '90001',
        country: 'US',
      },
      packages: [{ weightKg: 5 }],
    };

    it('should accept valid rate quote request', () => {
      const result = validateRateQuoteRequest(validRequest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept multiple packages', () => {
      const result = validateRateQuoteRequest({
        ...validRequest,
        packages: [{ weightKg: 5 }, { weightKg: 10 }, { weightKg: 2 }],
      });
      expect(result.valid).toBe(true);
    });

    it('should reject missing shipper city', () => {
      const result = validateRateQuoteRequest({
        ...validRequest,
        shipper: { ...validRequest.shipper, city: '' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'shipper.city')).toBe(true);
    });

    it('should reject missing shipper postal code', () => {
      const result = validateRateQuoteRequest({
        ...validRequest,
        shipper: { ...validRequest.shipper, postalCode: '' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'shipper.postalCode')).toBe(true);
    });

    it('should reject missing shipper country', () => {
      const result = validateRateQuoteRequest({
        ...validRequest,
        shipper: { ...validRequest.shipper, country: '' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'shipper.country')).toBe(true);
    });

    it('should reject missing recipient city', () => {
      const result = validateRateQuoteRequest({
        ...validRequest,
        recipient: { ...validRequest.recipient, city: '' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'recipient.city')).toBe(true);
    });

    it('should reject missing packages', () => {
      const result = validateRateQuoteRequest({
        ...validRequest,
        packages: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'packages')).toBe(true);
    });

    it('should reject invalid package weight', () => {
      const result = validateRateQuoteRequest({
        ...validRequest,
        packages: [{ weightKg: 0 }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'packages[0].weightKg')).toBe(true);
    });

    it('should reject package weight exceeding limit', () => {
      const result = validateRateQuoteRequest({
        ...validRequest,
        packages: [{ weightKg: 100 }], // Exceeds 68kg limit
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'packages[0].weightKg')).toBe(true);
    });
  });

  describe('validateShipmentRequest', () => {
    const validRequest = {
      accountNumber: '123456789',
      shipper: {
        name: 'John Doe',
        address: '123 Main St',
        city: 'New York',
        postalCode: '10001',
        country: 'US',
        phone: '1234567890',
      },
      recipient: {
        name: 'Jane Doe',
        address: '456 Oak Ave',
        city: 'Los Angeles',
        postalCode: '90001',
        country: 'US',
        phone: '0987654321',
      },
      packages: [{ weightKg: 5 }],
    };

    it('should accept valid shipment request', () => {
      const result = validateShipmentRequest(validRequest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing account number', () => {
      const result = validateShipmentRequest({
        ...validRequest,
        accountNumber: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'accountNumber')).toBe(true);
    });

    it('should reject shipper name exceeding 35 characters', () => {
      const result = validateShipmentRequest({
        ...validRequest,
        shipper: {
          ...validRequest.shipper,
          name: 'A'.repeat(36),
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'shipper.name')).toBe(true);
    });

    it('should reject invalid phone number format', () => {
      const result = validateShipmentRequest({
        ...validRequest,
        shipper: {
          ...validRequest.shipper,
          phone: '123', // Too short
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'shipper.phone')).toBe(true);
    });

    it('should reject missing packages', () => {
      const result = validateShipmentRequest({
        ...validRequest,
        packages: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'packages')).toBe(true);
    });

    it('should reject invalid package weight', () => {
      const result = validateShipmentRequest({
        ...validRequest,
        packages: [{ weightKg: 0 }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('weightKg'))).toBe(true);
    });

    it('should reject invalid country code length', () => {
      const result = validateShipmentRequest({
        ...validRequest,
        shipper: {
          ...validRequest.shipper,
          country: 'USA', // Should be 2 chars
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'shipper.country')).toBe(true);
    });
  });

  describe('validateOrThrow', () => {
    it('should not throw for valid result', () => {
      expect(() => validateOrThrow({ valid: true, errors: [] })).not.toThrow();
    });

    it('should throw FedExValidationError for invalid result', () => {
      expect(() => validateOrThrow({
        valid: false,
        errors: [{ field: 'test', message: 'test error' }],
      })).toThrow(FedExValidationError);
    });

    it('should include error details in exception', () => {
      try {
        validateOrThrow({
          valid: false,
          errors: [
            { field: 'field1', message: 'error1' },
            { field: 'field2', message: 'error2' },
          ],
        });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FedExValidationError);
        expect(error.message).toContain('field1');
        expect(error.message).toContain('field2');
        // FedExValidationError stores invalidFields directly, not in context
        expect(error.invalidFields).toContain('field1');
        expect(error.invalidFields).toContain('field2');
      }
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should remove control characters', () => {
      expect(sanitizeString('hello\x00world')).toBe('helloworld');
      expect(sanitizeString('test\x1Fvalue')).toBe('testvalue');
    });

    it('should truncate to max length', () => {
      expect(sanitizeString('hello world', 5)).toBe('hello');
    });

    it('should not truncate if within limit', () => {
      expect(sanitizeString('hello', 10)).toBe('hello');
    });

    it('should handle empty string', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should handle string with only whitespace', () => {
      expect(sanitizeString('   ')).toBe('');
    });
  });

  describe('sanitizePhoneNumber', () => {
    it('should remove formatting characters', () => {
      expect(sanitizePhoneNumber('(123) 456-7890')).toBe('123 4567890');
    });

    it('should keep digits and + sign', () => {
      expect(sanitizePhoneNumber('+1 234 567 8901')).toBe('+1 234 567 8901');
    });

    it('should add + prefix to long numbers', () => {
      // 11+ digits without + prefix gets + added
      expect(sanitizePhoneNumber('12345678901')).toBe('+12345678901');
    });

    it('should not add + to shorter numbers', () => {
      expect(sanitizePhoneNumber('1234567890')).toBe('1234567890');
    });

    it('should trim whitespace', () => {
      expect(sanitizePhoneNumber('  1234567890  ')).toBe('1234567890');
    });
  });
});
