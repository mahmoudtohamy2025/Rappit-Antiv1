/**
 * FedEx API TypeScript Interfaces
 * 
 * Type definitions for FedEx REST API v1
 * API Reference: https://developer.fedex.com/api/en-us/home.html
 */

// ============================================================================
// OAuth2 Types
// ============================================================================

export interface FedExOAuthTokenRequest {
  grant_type: 'client_credentials';
  client_id: string;
  client_secret: string;
}

export interface FedExOAuthTokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number; // seconds (typically 3600)
  scope: string;
}

// ============================================================================
// Address Types
// ============================================================================

export interface FedExAddress {
  streetLines: string[];
  city: string;
  stateOrProvinceCode?: string;
  postalCode: string;
  countryCode: string;
  residential?: boolean;
}

export interface FedExContact {
  personName: string;
  phoneNumber: string;
  phoneExtension?: string;
  companyName?: string;
  emailAddress?: string;
}

export interface FedExParty {
  address: FedExAddress;
  contact: FedExContact;
}

// ============================================================================
// Shipment Creation Types
// ============================================================================

export interface FedExWeight {
  units: 'KG' | 'LB';
  value: number;
}

export interface FedExDimensions {
  length: number;
  width: number;
  height: number;
  units: 'CM' | 'IN';
}

export interface FedExPackage {
  weight: FedExWeight;
  dimensions?: FedExDimensions;
}

export interface FedExLabelSpecification {
  labelFormatType: 'COMMON2D';
  imageType: 'PDF' | 'PNG' | 'ZPLII';
  labelStockType: 'PAPER_4X6' | 'PAPER_4X6.75' | 'PAPER_4X8';
}

export interface FedExShippingChargesPayment {
  paymentType: 'SENDER' | 'RECIPIENT' | 'THIRD_PARTY';
  payor: {
    responsibleParty: {
      accountNumber: {
        value: string;
      };
    };
  };
}

export interface FedExCreateShipmentRequest {
  labelResponseOptions: 'LABEL' | 'URL_ONLY';
  requestedShipment: {
    shipper: FedExParty;
    recipients: FedExParty[];
    pickupType: 'USE_SCHEDULED_PICKUP' | 'DROPOFF_AT_FEDEX_LOCATION' | 'CONTACT_FEDEX_TO_SCHEDULE';
    serviceType: string; // e.g., 'FEDEX_GROUND', 'PRIORITY_OVERNIGHT', 'FEDEX_EXPRESS_SAVER'
    packagingType: 'YOUR_PACKAGING' | 'FEDEX_BOX' | 'FEDEX_PAK' | 'FEDEX_ENVELOPE';
    shippingChargesPayment: FedExShippingChargesPayment;
    labelSpecification: FedExLabelSpecification;
    requestedPackageLineItems: FedExPackage[];
  };
  accountNumber: {
    value: string;
  };
}

export interface FedExLabel {
  imageType: string;
  labelStockType: string;
  encodedLabel: string; // base64
}

export interface FedExCreateShipmentResponse {
  transactionId: string;
  output: {
    transactionShipments: Array<{
      masterTrackingNumber: string;
      serviceType: string;
      shipDatestamp: string;
      serviceName: string;
      completedShipmentDetail: {
        completedPackageDetails: Array<{
          trackingIds: Array<{
            trackingIdType: string;
            formId: string;
            trackingNumber: string;
          }>;
          label?: {
            imageType: string;
            labelStockType: string;
            encodedLabel: string; // base64
          };
        }>;
        shipmentRating?: {
          actualRateType: string;
          shipmentRateDetails: Array<{
            rateType: string;
            totalNetCharge: number;
            currency: string;
          }>;
        };
      };
      shipmentAdvisoryDetails?: {
        regulatoryAdvisory?: {
          prohibitions: any[];
        };
      };
      pieceResponses?: Array<{
        trackingNumber: string;
        customerReferences?: any[];
      }>;
    }>;
  };
}

// ============================================================================
// Tracking Types
// ============================================================================

export interface FedExTrackingRequest {
  includeDetailedScans: boolean;
  trackingInfo: Array<{
    trackingNumberInfo: {
      trackingNumber: string;
    };
  }>;
}

export interface FedExTrackingEvent {
  eventType: string;
  eventDescription: string;
  timestamp: string;
  derivedStatus: string;
  derivedStatusCode: string; // e.g., 'PU', 'IT', 'OD', 'DL'
  scanLocation?: {
    city?: string;
    stateOrProvinceCode?: string;
    countryCode?: string;
    locationId?: string;
  };
}

export interface FedExTrackingResponse {
  transactionId: string;
  output: {
    completeTrackResults: Array<{
      trackingNumber: string;
      trackResults: Array<{
        trackingNumberInfo: {
          trackingNumber: string;
          trackingNumberUniqueId: string;
          carrierCode: string;
        };
        additionalTrackingInfo?: {
          nickname?: string;
          packageIdentifiers?: any[];
          shipmentNotes?: string;
        };
        shipperInformation?: {
          address?: {
            city?: string;
            stateOrProvinceCode?: string;
            countryCode?: string;
          };
        };
        recipientInformation?: {
          address?: {
            city?: string;
            stateOrProvinceCode?: string;
            countryCode?: string;
          };
        };
        latestStatusDetail?: {
          code: string;
          derivedCode: string;
          statusByLocale: string;
          description: string;
          scanLocation?: {
            city?: string;
            stateOrProvinceCode?: string;
            countryCode?: string;
          };
        };
        dateAndTimes?: Array<{
          type: string; // 'ACTUAL_DELIVERY', 'ESTIMATED_DELIVERY'
          dateTime: string;
        }>;
        availableImages?: any[];
        packageDetails?: {
          packagingDescription?: {
            type: string;
            description: string;
          };
          physicalPackagingType?: string;
          sequenceNumber?: string;
        };
        scanEvents?: FedExTrackingEvent[];
        deliveryDetails?: {
          receivedByName?: string;
          deliveryAttempts?: string;
          deliveryOptionEligibilityDetails?: any[];
        };
      }>;
    }>;
  };
}

// ============================================================================
// Rate Quote Types
// ============================================================================

export interface FedExRateQuoteRequest {
  accountNumber: {
    value: string;
  };
  requestedShipment: {
    shipper: {
      address: FedExAddress;
    };
    recipient: {
      address: FedExAddress;
    };
    pickupType: string;
    rateRequestType: string[]; // ['LIST', 'ACCOUNT']
    requestedPackageLineItems: FedExPackage[];
  };
}

export interface FedExRateQuoteResponse {
  transactionId: string;
  output: {
    rateReplyDetails: Array<{
      serviceType: string;
      serviceName: string;
      packagingType: string;
      ratedShipmentDetails: Array<{
        rateType: string;
        totalNetCharge: number;
        currency: string;
        totalBaseCharge?: number;
        totalNetChargeWithDutiesAndTaxes?: number;
        shipmentRateDetail?: {
          rateType: string;
          totalNetCharge: number;
          currency: string;
          totalBaseCharge?: number;
          totalSurcharges?: number;
          totalTaxes?: number;
        };
      }>;
      commit?: {
        dateDetail?: {
          dayFormat: string;
          daOfWeek: string;
        };
      };
      operationalDetail?: {
        originServiceArea?: string;
        destinationServiceArea?: string;
        ineligibleForMoneyBackGuarantee?: boolean;
        astraDescription?: string;
        airportId?: string;
        serviceCode?: string;
      };
    }>;
  };
}

// ============================================================================
// Cancel Shipment Types
// ============================================================================

export interface FedExCancelShipmentRequest {
  accountNumber: {
    value: string;
  };
  trackingNumber: string;
}

export interface FedExCancelShipmentResponse {
  transactionId: string;
  output: {
    cancelledShipment: boolean;
    successMessage?: string;
    alerts?: Array<{
      code: string;
      message: string;
      alertType: string;
    }>;
  };
}

// ============================================================================
// Address Validation Types
// ============================================================================

export interface FedExValidateAddressRequest {
  addressesToValidate: Array<{
    address: {
      streetLines: string[];
      city: string;
      stateOrProvinceCode?: string;
      postalCode: string;
      countryCode: string;
    };
  }>;
}

export interface FedExValidateAddressResponse {
  transactionId: string;
  output: {
    resolvedAddresses: Array<{
      classification: string; // 'BUSINESS', 'RESIDENTIAL', 'UNKNOWN'
      resolved: boolean;
      address: {
        streetLines: string[];
        city: string;
        stateOrProvinceCode?: string;
        postalCode: string;
        countryCode: string;
      };
      attributes?: {
        dpv?: string;
        residential?: boolean;
      };
    }>;
    alerts?: Array<{
      code: string;
      message: string;
      alertType: string;
    }>;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export interface FedExError {
  transactionId?: string;
  errors: Array<{
    code: string;
    message: string;
    parameterList?: Array<{
      key: string;
      value: string;
    }>;
  }>;
}

// Common FedEx error codes
export enum FedExErrorCode {
  INVALID_INPUT = 'INVALID.INPUT.EXCEPTION',
  SHIPPER_ACCOUNT_REQUIRED = 'SHIPPER.ACCOUNT.REQUIRED',
  SERVICE_UNAVAILABLE = 'SERVICE.UNAVAILABLE.ERROR',
  TRACKING_NOT_FOUND = 'TRACKING.TRACKINGNUMBER.NOTFOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT.FOUND.ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL.SERVER.ERROR',
}

// ============================================================================
// Service Type Constants
// ============================================================================

export enum FedExServiceType {
  // Domestic services
  PRIORITY_OVERNIGHT = 'PRIORITY_OVERNIGHT',
  STANDARD_OVERNIGHT = 'STANDARD_OVERNIGHT',
  FIRST_OVERNIGHT = 'FIRST_OVERNIGHT',
  FEDEX_2_DAY = 'FEDEX_2_DAY',
  FEDEX_2_DAY_AM = 'FEDEX_2_DAY_AM',
  FEDEX_EXPRESS_SAVER = 'FEDEX_EXPRESS_SAVER',
  FEDEX_GROUND = 'FEDEX_GROUND',
  
  // International services
  INTERNATIONAL_PRIORITY = 'INTERNATIONAL_PRIORITY',
  INTERNATIONAL_ECONOMY = 'INTERNATIONAL_ECONOMY',
  INTERNATIONAL_FIRST = 'INTERNATIONAL_FIRST',
  INTERNATIONAL_PRIORITY_EXPRESS = 'INTERNATIONAL_PRIORITY_EXPRESS',
  INTERNATIONAL_GROUND = 'INTERNATIONAL_GROUND',
}
