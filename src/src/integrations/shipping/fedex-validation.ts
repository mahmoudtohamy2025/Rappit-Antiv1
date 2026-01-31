/**
 * FedEx Request/Response Validation
 * 
 * Validation utilities for FedEx API requests and responses.
 * Helps catch errors before making API calls.
 */

import {
  FEDEX_VALIDATION,
  isValidFedExTrackingNumber,
  isValidPackageWeight,
  isValidPackageDimensions,
} from './fedex.constants';
import { FedExValidationError } from './fedex-error';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Validate shipment request before sending to FedEx API
 */
export function validateShipmentRequest(request: {
  accountNumber: string;
  shipper: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  recipient: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  packages: Array<{
    weightKg: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
  }>;
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate account number
  if (!request.accountNumber || request.accountNumber.trim() === '') {
    errors.push({
      field: 'accountNumber',
      message: 'Account number is required',
      value: request.accountNumber,
    });
  }

  // Validate shipper
  errors.push(...validateAddress('shipper', request.shipper));

  // Validate recipient
  errors.push(...validateAddress('recipient', request.recipient));

  // Validate packages
  if (!request.packages || request.packages.length === 0) {
    errors.push({
      field: 'packages',
      message: 'At least one package is required',
    });
  } else {
    request.packages.forEach((pkg, index) => {
      errors.push(...validatePackage(`packages[${index}]`, pkg));
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate tracking request
 */
export function validateTrackingRequest(trackingNumber: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!trackingNumber || trackingNumber.trim() === '') {
    errors.push({
      field: 'trackingNumber',
      message: 'Tracking number is required',
    });
  } else if (!isValidFedExTrackingNumber(trackingNumber)) {
    errors.push({
      field: 'trackingNumber',
      message: 'Invalid FedEx tracking number format (must be 12-22 digits)',
      value: trackingNumber,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate rate quote request
 */
export function validateRateQuoteRequest(request: {
  shipper: {
    city: string;
    postalCode: string;
    country: string;
  };
  recipient: {
    city: string;
    postalCode: string;
    country: string;
  };
  packages: Array<{
    weightKg: number;
  }>;
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate shipper location
  if (!request.shipper.city || request.shipper.city.trim() === '') {
    errors.push({
      field: 'shipper.city',
      message: 'Shipper city is required',
    });
  }

  if (!request.shipper.postalCode || request.shipper.postalCode.trim() === '') {
    errors.push({
      field: 'shipper.postalCode',
      message: 'Shipper postal code is required',
    });
  }

  if (!request.shipper.country || request.shipper.country.trim() === '') {
    errors.push({
      field: 'shipper.country',
      message: 'Shipper country is required',
    });
  }

  // Validate recipient location
  if (!request.recipient.city || request.recipient.city.trim() === '') {
    errors.push({
      field: 'recipient.city',
      message: 'Recipient city is required',
    });
  }

  if (!request.recipient.postalCode || request.recipient.postalCode.trim() === '') {
    errors.push({
      field: 'recipient.postalCode',
      message: 'Recipient postal code is required',
    });
  }

  if (!request.recipient.country || request.recipient.country.trim() === '') {
    errors.push({
      field: 'recipient.country',
      message: 'Recipient country is required',
    });
  }

  // Validate packages
  if (!request.packages || request.packages.length === 0) {
    errors.push({
      field: 'packages',
      message: 'At least one package is required',
    });
  } else {
    request.packages.forEach((pkg, index) => {
      if (!isValidPackageWeight(pkg.weightKg)) {
        errors.push({
          field: `packages[${index}].weightKg`,
          message: `Invalid weight (must be > 0 and <= ${FEDEX_VALIDATION.MAX_PACKAGE_WEIGHT_KG} kg)`,
          value: pkg.weightKg,
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate address validation request
 */
export function validateAddressValidationRequest(address: {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (!address.street || address.street.trim() === '') {
    errors.push({
      field: 'street',
      message: 'Street address is required',
    });
  }

  if (!address.city || address.city.trim() === '') {
    errors.push({
      field: 'city',
      message: 'City is required',
    });
  }

  if (!address.postalCode || address.postalCode.trim() === '') {
    errors.push({
      field: 'postalCode',
      message: 'Postal code is required',
    });
  }

  if (!address.country || address.country.trim() === '') {
    errors.push({
      field: 'country',
      message: 'Country is required',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate address fields
 */
function validateAddress(
  prefix: string,
  address: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
  },
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate name
  if (!address.name || address.name.trim() === '') {
    errors.push({
      field: `${prefix}.name`,
      message: 'Name is required',
    });
  } else if (address.name.length > 35) {
    errors.push({
      field: `${prefix}.name`,
      message: 'Name must be 35 characters or less',
      value: address.name,
    });
  }

  // Validate street address
  if (!address.address || address.address.trim() === '') {
    errors.push({
      field: `${prefix}.address`,
      message: 'Street address is required',
    });
  } else if (address.address.length > FEDEX_VALIDATION.MAX_STREET_LINE_LENGTH) {
    errors.push({
      field: `${prefix}.address`,
      message: `Street address must be ${FEDEX_VALIDATION.MAX_STREET_LINE_LENGTH} characters or less`,
      value: address.address,
    });
  }

  // Validate city
  if (!address.city || address.city.trim() === '') {
    errors.push({
      field: `${prefix}.city`,
      message: 'City is required',
    });
  } else if (address.city.length > FEDEX_VALIDATION.MAX_CITY_LENGTH) {
    errors.push({
      field: `${prefix}.city`,
      message: `City must be ${FEDEX_VALIDATION.MAX_CITY_LENGTH} characters or less`,
      value: address.city,
    });
  }

  // Validate postal code
  if (!address.postalCode || address.postalCode.trim() === '') {
    errors.push({
      field: `${prefix}.postalCode`,
      message: 'Postal code is required',
    });
  } else if (!FEDEX_VALIDATION.POSTAL_CODE_PATTERN.test(address.postalCode)) {
    errors.push({
      field: `${prefix}.postalCode`,
      message: 'Invalid postal code format',
      value: address.postalCode,
    });
  }

  // Validate country
  if (!address.country || address.country.trim() === '') {
    errors.push({
      field: `${prefix}.country`,
      message: 'Country code is required',
    });
  } else if (address.country.length !== 2) {
    errors.push({
      field: `${prefix}.country`,
      message: 'Country code must be 2 characters (ISO 3166-1 alpha-2)',
      value: address.country,
    });
  }

  // Validate phone
  if (!address.phone || address.phone.trim() === '') {
    errors.push({
      field: `${prefix}.phone`,
      message: 'Phone number is required',
    });
  } else if (!FEDEX_VALIDATION.PHONE_NUMBER_PATTERN.test(address.phone.replace(/[\s\-\(\)]/g, ''))) {
    errors.push({
      field: `${prefix}.phone`,
      message: 'Invalid phone number format (must be 10-15 digits)',
      value: address.phone,
    });
  }

  return errors;
}

/**
 * Validate package fields
 */
function validatePackage(
  prefix: string,
  pkg: {
    weightKg: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
  },
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate weight
  if (!isValidPackageWeight(pkg.weightKg)) {
    errors.push({
      field: `${prefix}.weightKg`,
      message: `Weight must be > 0 and <= ${FEDEX_VALIDATION.MAX_PACKAGE_WEIGHT_KG} kg`,
      value: pkg.weightKg,
    });
  }

  // Validate dimensions if provided
  if (pkg.lengthCm || pkg.widthCm || pkg.heightCm) {
    // All dimensions must be provided if any are provided
    if (!pkg.lengthCm || !pkg.widthCm || !pkg.heightCm) {
      errors.push({
        field: `${prefix}.dimensions`,
        message: 'If dimensions are provided, all three (length, width, height) must be specified',
      });
    } else if (!isValidPackageDimensions(pkg.lengthCm, pkg.widthCm, pkg.heightCm)) {
      errors.push({
        field: `${prefix}.dimensions`,
        message: `Invalid dimensions (length <= ${FEDEX_VALIDATION.MAX_PACKAGE_LENGTH_CM} cm, girth <= ${FEDEX_VALIDATION.MAX_PACKAGE_GIRTH_CM} cm)`,
        value: { length: pkg.lengthCm, width: pkg.widthCm, height: pkg.heightCm },
      });
    }
  }

  return errors;
}

/**
 * Throw FedExValidationError if validation fails
 */
export function validateOrThrow(result: ValidationResult): void {
  if (!result.valid) {
    const invalidFields = result.errors.map((e) => e.field);
    const errorMessages = result.errors.map((e) => `${e.field}: ${e.message}`).join('; ');

    throw new FedExValidationError(`Validation failed: ${errorMessages}`, {
      details: result.errors,
      invalidFields,
    });
  }
}

/**
 * Sanitize string for FedEx API (remove special characters that may cause issues)
 */
export function sanitizeString(value: string, maxLength?: number): string {
  let sanitized = value.trim();

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  // Truncate if needed
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize phone number (remove formatting, keep digits and +)
 */
export function sanitizePhoneNumber(phone: string): string {
  // Keep only digits, +, and spaces
  let sanitized = phone.replace(/[^\d\+\s]/g, '');

  // Ensure it starts with + if international
  if (sanitized.match(/^\d{11,}$/)) {
    sanitized = '+' + sanitized;
  }

  return sanitized.trim();
}

/**
 * Validate and sanitize shipment request
 */
export function validateAndSanitizeShipmentRequest(request: any): any {
  // Validate first
  const validation = validateShipmentRequest(request);
  validateOrThrow(validation);

  // Then sanitize
  return {
    ...request,
    shipper: {
      ...request.shipper,
      name: sanitizeString(request.shipper.name, 35),
      address: sanitizeString(request.shipper.address, 35),
      city: sanitizeString(request.shipper.city, 35),
      phone: sanitizePhoneNumber(request.shipper.phone),
    },
    recipient: {
      ...request.recipient,
      name: sanitizeString(request.recipient.name, 35),
      address: sanitizeString(request.recipient.address, 35),
      city: sanitizeString(request.recipient.city, 35),
      phone: sanitizePhoneNumber(request.recipient.phone),
    },
  };
}
