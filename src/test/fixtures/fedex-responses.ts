/**
 * FedEx API Response Fixtures
 * 
 * Mock responses from FedEx API for testing purposes.
 * Based on actual FedEx REST API v1 response formats.
 */

import {
  FedExCreateShipmentResponse,
  FedExTrackingResponse,
  FedExRateQuoteResponse,
  FedExCancelShipmentResponse,
  FedExValidateAddressResponse,
  FedExOAuthTokenResponse,
  FedExError,
} from '../../src/integrations/shipping/fedex.types';

// ============================================================================
// OAuth Token Responses
// ============================================================================

export const FEDEX_OAUTH_SUCCESS: FedExOAuthTokenResponse = {
  access_token: 'mock_access_token_1234567890',
  token_type: 'bearer',
  expires_in: 3600,
  scope: 'CXS',
};

// ============================================================================
// Create Shipment Responses
// ============================================================================

export const FEDEX_CREATE_SHIPMENT_SUCCESS: FedExCreateShipmentResponse = {
  transactionId: 'txn-123456789',
  output: {
    transactionShipments: [
      {
        masterTrackingNumber: '794608491820',
        serviceType: 'FEDEX_GROUND',
        shipDatestamp: '2024-01-15',
        serviceName: 'FedEx Ground',
        completedShipmentDetail: {
          completedPackageDetails: [
            {
              trackingIds: [
                {
                  trackingIdType: 'FEDEX',
                  formId: '0430',
                  trackingNumber: '794608491820',
                },
              ],
              label: {
                imageType: 'PDF',
                labelStockType: 'PAPER_4X6',
                encodedLabel: 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXS9Db250ZW50cyA0IDAgUj4+CmVuZG9iago0IDAgb2JqCjw8L0xlbmd0aCA0NDc+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKEZlZEV4IFNoaXBwaW5nIExhYmVsKSBUagowIC0zMCBUZAooVHJhY2tpbmc6IDc5NDYwODQ5MTgyMCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA2MCAwMDAwMCBuIAowMDAwMDAwMTE3IDAwMDAwIG4gCjAwMDAwMDAyMDggMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDUvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgo3MDQKJSVFT0YK',
              },
            },
          ],
          shipmentRating: {
            actualRateType: 'PAYOR_ACCOUNT_SHIPMENT',
            shipmentRateDetails: [
              {
                rateType: 'PAYOR_ACCOUNT_SHIPMENT',
                totalNetCharge: 45.75,
                currency: 'USD',
              },
            ],
          },
        },
      },
    ],
  },
};

export const FEDEX_CREATE_SHIPMENT_INTERNATIONAL: FedExCreateShipmentResponse = {
  transactionId: 'txn-intl-987654321',
  output: {
    transactionShipments: [
      {
        masterTrackingNumber: '794608491821',
        serviceType: 'INTERNATIONAL_PRIORITY',
        shipDatestamp: '2024-01-15',
        serviceName: 'FedEx International Priority',
        completedShipmentDetail: {
          completedPackageDetails: [
            {
              trackingIds: [
                {
                  trackingIdType: 'FEDEX',
                  formId: '0430',
                  trackingNumber: '794608491821',
                },
              ],
              label: {
                imageType: 'PDF',
                labelStockType: 'PAPER_4X6',
                encodedLabel: 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXS9Db250ZW50cyA0IDAgUj4+CmVuZG9iago0IDAgb2JqCjw8L0xlbmd0aCA0NDc+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKEZlZEV4IEludGVybmF0aW9uYWwgTGFiZWwpIFRqCjAgLTMwIFRkCihUcmFja2luZzogNzk0NjA4NDkxODIxKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDYwIDAwMDAwIG4gCjAwMDAwMDAxMTcgMDAwMDAgbiAKMDAwMDAwMDIwOCAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNS9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjcwNAolJUVPRgo=',
              },
            },
          ],
          shipmentRating: {
            actualRateType: 'PAYOR_ACCOUNT_SHIPMENT',
            shipmentRateDetails: [
              {
                rateType: 'PAYOR_ACCOUNT_SHIPMENT',
                totalNetCharge: 125.50,
                currency: 'USD',
              },
            ],
          },
        },
      },
    ],
  },
};

// ============================================================================
// Tracking Responses
// ============================================================================

export const FEDEX_TRACKING_IN_TRANSIT: FedExTrackingResponse = {
  transactionId: 'txn-track-123456',
  output: {
    completeTrackResults: [
      {
        trackingNumber: '794608491820',
        trackResults: [
          {
            trackingNumberInfo: {
              trackingNumber: '794608491820',
              trackingNumberUniqueId: 'unique-123',
              carrierCode: 'FDXG',
            },
            latestStatusDetail: {
              code: 'IT',
              derivedCode: 'IT',
              statusByLocale: 'In transit',
              description: 'In transit',
              scanLocation: {
                city: 'MEMPHIS',
                stateOrProvinceCode: 'TN',
                countryCode: 'US',
              },
            },
            dateAndTimes: [
              {
                type: 'ESTIMATED_DELIVERY',
                dateTime: '2024-01-18T17:00:00-06:00',
              },
            ],
            scanEvents: [
              {
                eventType: 'PU',
                eventDescription: 'Picked up',
                timestamp: '2024-01-15T09:30:00-06:00',
                derivedStatus: 'Picked up',
                derivedStatusCode: 'PU',
                scanLocation: {
                  city: 'CHICAGO',
                  stateOrProvinceCode: 'IL',
                  countryCode: 'US',
                },
              },
              {
                eventType: 'IT',
                eventDescription: 'In transit',
                timestamp: '2024-01-16T14:45:00-06:00',
                derivedStatus: 'In transit',
                derivedStatusCode: 'IT',
                scanLocation: {
                  city: 'MEMPHIS',
                  stateOrProvinceCode: 'TN',
                  countryCode: 'US',
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

export const FEDEX_TRACKING_DELIVERED: FedExTrackingResponse = {
  transactionId: 'txn-track-delivered',
  output: {
    completeTrackResults: [
      {
        trackingNumber: '794608491820',
        trackResults: [
          {
            trackingNumberInfo: {
              trackingNumber: '794608491820',
              trackingNumberUniqueId: 'unique-123',
              carrierCode: 'FDXG',
            },
            latestStatusDetail: {
              code: 'DL',
              derivedCode: 'DL',
              statusByLocale: 'Delivered',
              description: 'Delivered',
              scanLocation: {
                city: 'NEW YORK',
                stateOrProvinceCode: 'NY',
                countryCode: 'US',
              },
            },
            dateAndTimes: [
              {
                type: 'ACTUAL_DELIVERY',
                dateTime: '2024-01-18T14:23:00-05:00',
              },
            ],
            scanEvents: [
              {
                eventType: 'PU',
                eventDescription: 'Picked up',
                timestamp: '2024-01-15T09:30:00-06:00',
                derivedStatus: 'Picked up',
                derivedStatusCode: 'PU',
                scanLocation: {
                  city: 'CHICAGO',
                  stateOrProvinceCode: 'IL',
                  countryCode: 'US',
                },
              },
              {
                eventType: 'OD',
                eventDescription: 'Out for delivery',
                timestamp: '2024-01-18T08:15:00-05:00',
                derivedStatus: 'Out for delivery',
                derivedStatusCode: 'OD',
                scanLocation: {
                  city: 'NEW YORK',
                  stateOrProvinceCode: 'NY',
                  countryCode: 'US',
                },
              },
              {
                eventType: 'DL',
                eventDescription: 'Delivered',
                timestamp: '2024-01-18T14:23:00-05:00',
                derivedStatus: 'Delivered',
                derivedStatusCode: 'DL',
                scanLocation: {
                  city: 'NEW YORK',
                  stateOrProvinceCode: 'NY',
                  countryCode: 'US',
                },
              },
            ],
            deliveryDetails: {
              receivedByName: 'J. SMITH',
              deliveryAttempts: '1',
            },
          },
        ],
      },
    ],
  },
};

// ============================================================================
// Rate Quote Responses
// ============================================================================

export const FEDEX_RATE_QUOTE_SUCCESS: FedExRateQuoteResponse = {
  transactionId: 'txn-rate-123456',
  output: {
    rateReplyDetails: [
      {
        serviceType: 'FEDEX_GROUND',
        serviceName: 'FedEx Ground',
        packagingType: 'YOUR_PACKAGING',
        ratedShipmentDetails: [
          {
            rateType: 'PAYOR_ACCOUNT_PACKAGE',
            totalNetCharge: 45.75,
            currency: 'USD',
            totalBaseCharge: 42.50,
          },
        ],
      },
      {
        serviceType: 'FEDEX_EXPRESS_SAVER',
        serviceName: 'FedEx Express Saver',
        packagingType: 'YOUR_PACKAGING',
        ratedShipmentDetails: [
          {
            rateType: 'PAYOR_ACCOUNT_PACKAGE',
            totalNetCharge: 68.90,
            currency: 'USD',
            totalBaseCharge: 65.00,
          },
        ],
      },
      {
        serviceType: 'PRIORITY_OVERNIGHT',
        serviceName: 'FedEx Priority Overnight',
        packagingType: 'YOUR_PACKAGING',
        ratedShipmentDetails: [
          {
            rateType: 'PAYOR_ACCOUNT_PACKAGE',
            totalNetCharge: 95.25,
            currency: 'USD',
            totalBaseCharge: 90.00,
          },
        ],
      },
    ],
  },
};

// ============================================================================
// Cancel Shipment Responses
// ============================================================================

export const FEDEX_CANCEL_SUCCESS: FedExCancelShipmentResponse = {
  transactionId: 'txn-cancel-123456',
  output: {
    cancelledShipment: true,
    successMessage: 'Shipment cancelled successfully',
  },
};

export const FEDEX_CANCEL_ALREADY_CANCELLED: FedExCancelShipmentResponse = {
  transactionId: 'txn-cancel-already',
  output: {
    cancelledShipment: false,
    alerts: [
      {
        code: 'SHIPMENT.ALREADY.CANCELLED',
        message: 'This shipment has already been cancelled',
        alertType: 'WARNING',
      },
    ],
  },
};

// ============================================================================
// Address Validation Responses
// ============================================================================

export const FEDEX_VALIDATE_ADDRESS_SUCCESS: FedExValidateAddressResponse = {
  transactionId: 'txn-validate-123456',
  output: {
    resolvedAddresses: [
      {
        classification: 'RESIDENTIAL',
        resolved: true,
        address: {
          streetLines: ['123 Main St'],
          city: 'Chicago',
          stateOrProvinceCode: 'IL',
          postalCode: '60601',
          countryCode: 'US',
        },
        attributes: {
          dpv: 'Y',
          residential: true,
        },
      },
    ],
  },
};

export const FEDEX_VALIDATE_ADDRESS_CORRECTED: FedExValidateAddressResponse = {
  transactionId: 'txn-validate-corrected',
  output: {
    resolvedAddresses: [
      {
        classification: 'RESIDENTIAL',
        resolved: true,
        address: {
          streetLines: ['123 Main Street'], // Corrected from 'St' to 'Street'
          city: 'Chicago',
          stateOrProvinceCode: 'IL',
          postalCode: '60601-1234', // Added full ZIP+4
          countryCode: 'US',
        },
      },
    ],
    alerts: [
      {
        code: 'ADDRESS.STANDARDIZED',
        message: 'Address was standardized',
        alertType: 'NOTE',
      },
    ],
  },
};

export const FEDEX_VALIDATE_ADDRESS_INVALID: FedExValidateAddressResponse = {
  transactionId: 'txn-validate-invalid',
  output: {
    resolvedAddresses: [
      {
        classification: 'UNKNOWN',
        resolved: false,
        address: {
          streetLines: ['999 Fake Street'],
          city: 'InvalidCity',
          stateOrProvinceCode: 'XX',
          postalCode: '00000',
          countryCode: 'US',
        },
      },
    ],
    alerts: [
      {
        code: 'ADDRESS.INVALID',
        message: 'Address could not be validated',
        alertType: 'ERROR',
      },
    ],
  },
};

// ============================================================================
// Error Responses
// ============================================================================

export const FEDEX_ERROR_INVALID_INPUT: FedExError = {
  transactionId: 'txn-error-123',
  errors: [
    {
      code: 'INVALID.INPUT.EXCEPTION',
      message: 'Invalid input provided',
      parameterList: [
        {
          key: 'postalCode',
          value: 'Required field missing',
        },
      ],
    },
  ],
};

export const FEDEX_ERROR_UNAUTHORIZED: FedExError = {
  transactionId: 'txn-error-auth',
  errors: [
    {
      code: 'UNAUTHORIZED',
      message: 'Authentication failed',
    },
  ],
};

export const FEDEX_ERROR_SERVICE_UNAVAILABLE: FedExError = {
  transactionId: 'txn-error-service',
  errors: [
    {
      code: 'SERVICE.UNAVAILABLE.ERROR',
      message: 'Service temporarily unavailable',
    },
  ],
};

export const FEDEX_ERROR_TRACKING_NOT_FOUND: FedExError = {
  transactionId: 'txn-error-tracking',
  errors: [
    {
      code: 'TRACKING.TRACKINGNUMBER.NOTFOUND',
      message: 'Tracking number not found',
      parameterList: [
        {
          key: 'trackingNumber',
          value: '123456789012',
        },
      ],
    },
  ],
};

export const FEDEX_ERROR_ACCOUNT_REQUIRED: FedExError = {
  transactionId: 'txn-error-account',
  errors: [
    {
      code: 'SHIPPER.ACCOUNT.REQUIRED',
      message: 'Shipper account number is required',
    },
  ],
};
