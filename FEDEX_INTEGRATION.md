# FedEx Integration Documentation

## Overview

This document provides complete documentation for the FedEx shipping integration in the Rappit platform. The integration uses the FedEx REST API v1 with OAuth2 authentication to create shipments, generate labels, and track packages.

## Table of Contents

1. [Setup Instructions](#setup-instructions)
2. [Configuration](#configuration)
3. [API Endpoints](#api-endpoints)
4. [Error Handling](#error-handling)
5. [Status Mappings](#status-mappings)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## Setup Instructions

### Prerequisites

- FedEx Developer Account: https://developer.fedex.com
- FedEx Shipping Account Number
- API Key and Secret Key (Client ID and Client Secret)

### Step 1: Obtain FedEx API Credentials

1. Register at https://developer.fedex.com
2. Create a new application
3. Note down your:
   - API Key (Client ID)
   - Secret Key (Client Secret)
   - Account Number
   - Shipper Account Number
   - Bill To Account Number

### Step 2: Configure Environment Variables

Add the following to your `.env` file:

```env
# FedEx Integration
FEDEX_API_KEY=l790f077185d904d3fbd9c4621fea42ca1
FEDEX_SECRET_KEY=730b5004660a48dc8fb1354a1f66afaf
FEDEX_ACCOUNT_NUMBER=740561073
FEDEX_API_URL=https://apis-sandbox.fedex.com
FEDEX_SHIPPER_ACCOUNT=510087020
FEDEX_BILL_TO_ACCOUNT=510051408

# Default Shipper Address (for testing)
FEDEX_SHIPPER_NAME=Rappit Fulfillment
FEDEX_SHIPPER_STREET=1202 Chalet Ln
FEDEX_SHIPPER_CITY=Harrison
FEDEX_SHIPPER_STATE=AR
FEDEX_SHIPPER_POSTAL_CODE=72601
FEDEX_SHIPPER_COUNTRY=US
FEDEX_SHIPPER_PHONE=5551234567
```

**For Production:**
```env
FEDEX_API_URL=https://apis.fedex.com
```

### Step 3: Create Shipping Account

In the Rappit admin panel:

1. Navigate to Shipping Accounts
2. Create new FedEx account
3. Configure credentials:
   - Account Number
   - API Key (stored encrypted)
   - Secret Key (stored encrypted)
4. Enable test mode for sandbox testing

## Configuration

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `FEDEX_API_KEY` | Yes | FedEx API Key (Client ID) | `l790f077...` |
| `FEDEX_SECRET_KEY` | Yes | FedEx Secret Key (Client Secret) | `730b5004...` |
| `FEDEX_ACCOUNT_NUMBER` | Yes | FedEx Account Number | `740561073` |
| `FEDEX_API_URL` | Yes | API Base URL (sandbox or production) | `https://apis-sandbox.fedex.com` |
| `FEDEX_SHIPPER_ACCOUNT` | Yes | Shipper Account Number | `510087020` |
| `FEDEX_BILL_TO_ACCOUNT` | Optional | Billing Account Number | `510051408` |
| `FEDEX_SHIPPER_NAME` | Optional | Default shipper name | `Rappit Fulfillment` |
| `FEDEX_SHIPPER_STREET` | Optional | Default shipper street | `1202 Chalet Ln` |
| `FEDEX_SHIPPER_CITY` | Optional | Default shipper city | `Harrison` |
| `FEDEX_SHIPPER_STATE` | Optional | Default shipper state | `AR` |
| `FEDEX_SHIPPER_POSTAL_CODE` | Optional | Default shipper postal code | `72601` |
| `FEDEX_SHIPPER_COUNTRY` | Optional | Default shipper country | `US` |
| `FEDEX_SHIPPER_PHONE` | Optional | Default shipper phone | `5551234567` |

### Service Types

The integration supports all FedEx service types:

**Domestic Services:**
- `PRIORITY_OVERNIGHT` - Next business day delivery
- `STANDARD_OVERNIGHT` - Next business day delivery (later)
- `FIRST_OVERNIGHT` - Next business day delivery (earliest)
- `FEDEX_2_DAY` - 2 business days
- `FEDEX_2_DAY_AM` - 2 business days (AM delivery)
- `FEDEX_EXPRESS_SAVER` - 3 business days
- `FEDEX_GROUND` - Ground delivery (default)

**International Services:**
- `INTERNATIONAL_PRIORITY` - 1-3 business days
- `INTERNATIONAL_ECONOMY` - 2-5 business days
- `INTERNATIONAL_FIRST` - 1-3 business days (earliest)
- `INTERNATIONAL_PRIORITY_EXPRESS` - 1-2 business days
- `INTERNATIONAL_GROUND` - Ground delivery

## API Endpoints

### OAuth Token

**Endpoint:** `POST /oauth/token`

**Request:**
```
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id={API_KEY}&client_secret={SECRET_KEY}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 3600,
  "scope": "CXS"
}
```

**Token Details:**
- Expires in 1 hour (3600 seconds)
- Automatically refreshed 5 minutes before expiry
- Cached per organization/account

### Create Shipment

**Endpoint:** `POST /ship/v1/shipments`

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "labelResponseOptions": "LABEL",
  "requestedShipment": {
    "shipper": {
      "contact": {
        "personName": "Shipper Name",
        "phoneNumber": "5551234567"
      },
      "address": {
        "streetLines": ["1202 Chalet Ln"],
        "city": "Harrison",
        "stateOrProvinceCode": "AR",
        "postalCode": "72601",
        "countryCode": "US"
      }
    },
    "recipients": [{
      "contact": {
        "personName": "Recipient Name",
        "phoneNumber": "5559876543"
      },
      "address": {
        "streetLines": ["123 Main St"],
        "city": "Memphis",
        "stateOrProvinceCode": "TN",
        "postalCode": "38101",
        "countryCode": "US"
      }
    }],
    "serviceType": "FEDEX_GROUND",
    "packagingType": "YOUR_PACKAGING",
    "pickupType": "USE_SCHEDULED_PICKUP",
    "shippingChargesPayment": {
      "paymentType": "SENDER",
      "payor": {
        "responsibleParty": {
          "accountNumber": {
            "value": "510087020"
          }
        }
      }
    },
    "labelSpecification": {
      "labelFormatType": "COMMON2D",
      "imageType": "PDF",
      "labelStockType": "PAPER_4X6"
    },
    "requestedPackageLineItems": [{
      "weight": {
        "units": "KG",
        "value": 1.0
      },
      "dimensions": {
        "length": 10,
        "width": 10,
        "height": 10,
        "units": "CM"
      }
    }]
  },
  "accountNumber": {
    "value": "740561073"
  }
}
```

**Response:**
```json
{
  "transactionId": "abc123...",
  "output": {
    "transactionShipments": [{
      "masterTrackingNumber": "794644790138",
      "serviceType": "FEDEX_GROUND",
      "completedShipmentDetail": {
        "completedPackageDetails": [{
          "trackingIds": [{
            "trackingNumber": "794644790138"
          }],
          "label": {
            "imageType": "PDF",
            "encodedLabel": "JVBERi0xLjQK..." // base64
          }
        }],
        "shipmentRating": {
          "shipmentRateDetails": [{
            "totalNetCharge": 12.50,
            "currency": "USD"
          }]
        }
      }
    }]
  }
}
```

### Track Shipment

**Endpoint:** `POST /track/v1/trackingnumbers`

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "includeDetailedScans": true,
  "trackingInfo": [{
    "trackingNumberInfo": {
      "trackingNumber": "794644790138"
    }
  }]
}
```

**Response:**
```json
{
  "transactionId": "xyz789...",
  "output": {
    "completeTrackResults": [{
      "trackResults": [{
        "trackingNumberInfo": {
          "trackingNumber": "794644790138"
        },
        "latestStatusDetail": {
          "code": "OD",
          "derivedCode": "OD",
          "description": "Out for delivery"
        },
        "scanEvents": [{
          "timestamp": "2024-01-15T08:30:00Z",
          "derivedStatusCode": "PU",
          "eventDescription": "Picked up",
          "scanLocation": {
            "city": "Harrison",
            "stateOrProvinceCode": "AR",
            "countryCode": "US"
          }
        }],
        "dateAndTimes": [{
          "type": "ESTIMATED_DELIVERY",
          "dateTime": "2024-01-17T20:00:00Z"
        }]
      }]
    }]
  }
}
```

### Cancel Shipment

**Endpoint:** `PUT /ship/v1/shipments/cancel`

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "accountNumber": {
    "value": "740561073"
  },
  "trackingNumber": "794644790138"
}
```

### Get Rate Quotes

**Endpoint:** `POST /rate/v1/rates/quotes`

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "accountNumber": {
    "value": "740561073"
  },
  "requestedShipment": {
    "shipper": {
      "address": {
        "postalCode": "72601",
        "countryCode": "US"
      }
    },
    "recipient": {
      "address": {
        "postalCode": "38101",
        "countryCode": "US"
      }
    },
    "pickupType": "USE_SCHEDULED_PICKUP",
    "rateRequestType": ["LIST", "ACCOUNT"],
    "requestedPackageLineItems": [{
      "weight": {
        "units": "KG",
        "value": 1.0
      }
    }]
  }
}
```

## Error Handling

### Common Error Codes

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `INVALID.INPUT.EXCEPTION` | Invalid input data | Check request payload format |
| `SHIPPER.ACCOUNT.REQUIRED` | Missing shipper account | Verify shipper account number |
| `SERVICE.UNAVAILABLE.ERROR` | FedEx service down | Retry with exponential backoff |
| `TRACKING.TRACKINGNUMBER.NOTFOUND` | Invalid tracking number | Verify tracking number format |
| `UNAUTHORIZED` | Authentication failed | Check API credentials |
| `FORBIDDEN` | Insufficient permissions | Verify account permissions |

### Error Response Format

```json
{
  "transactionId": "abc123...",
  "errors": [{
    "code": "INVALID.INPUT.EXCEPTION",
    "message": "Invalid postal code format",
    "parameterList": [{
      "key": "postalCode",
      "value": "INVALID"
    }]
  }]
}
```

### Retry Logic

The integration automatically retries failed requests:

- **Retryable Status Codes:** 429, 500, 502, 503, 504
- **Max Retries:** 3
- **Backoff:** Exponential (1s, 2s, 4s)
- **Max Delay:** 30 seconds

### Rate Limiting

FedEx allows approximately 500 requests per minute:

- **Requests per Minute:** 500
- **Min Request Interval:** 120ms
- **Enforcement:** Automatic throttling

## Status Mappings

### FedEx to Rappit Status Mapping

| FedEx Code | FedEx Description | Rappit Status | Terminal? |
|------------|-------------------|---------------|-----------|
| `PU` | Picked up | `IN_TRANSIT` | No |
| `IT` | In transit | `IN_TRANSIT` | No |
| `AR` | Arrived at location | `IN_TRANSIT` | No |
| `DP` | Departed location | `IN_TRANSIT` | No |
| `OD` | Out for delivery | `OUT_FOR_DELIVERY` | No |
| `DL` | Delivered | `DELIVERED` | Yes |
| `DE` | Delivery exception | `EXCEPTION` | No |
| `CA` | Cancelled | `CANCELLED` | Yes |
| `RS` | Returned to shipper | `RETURNED` | Yes |
| `PX` | Pickup exception | `EXCEPTION` | No |

## Testing

### Test with Sandbox

1. Use sandbox URL: `https://apis-sandbox.fedex.com`
2. Use test credentials provided above
3. Create test shipments
4. Track test shipments

### Test Commands

```bash
# Test OAuth authentication
./scripts/fedex-admin.sh test-auth

# Create test shipment
./scripts/fedex-admin.sh create-test-shipment

# Track shipment
./scripts/fedex-admin.sh track 794644790138

# Run full test suite
./scripts/fedex-test-suite.sh
```

### Integration Tests

Run the integration test suite:

```bash
npm run test:integration -- --grep "FedEx"
```

## Troubleshooting

### Token Issues

**Problem:** `UNAUTHORIZED` errors

**Solution:**
1. Verify API Key and Secret Key
2. Check token expiry
3. Force token refresh
4. Verify environment variables

### Shipment Creation Fails

**Problem:** `INVALID.INPUT.EXCEPTION`

**Solution:**
1. Validate address format
2. Check required fields
3. Verify postal codes
4. Review service type availability

### Tracking Not Found

**Problem:** `TRACKING.TRACKINGNUMBER.NOTFOUND`

**Solution:**
1. Wait 30 minutes after shipment creation
2. Verify tracking number format
3. Check if shipment was actually created
4. Try tracking directly on fedex.com

### Rate Limiting

**Problem:** 429 errors

**Solution:**
- Automatic retry with backoff
- Reduce request frequency
- Contact FedEx for rate limit increase

### Label Issues

**Problem:** Labels not displaying

**Solution:**
1. Verify base64 decoding
2. Check PDF format
3. Ensure label storage is working
4. Review label specification settings

## Monitoring

### View Integration Logs

```sql
SELECT * FROM integration_logs
WHERE integration_type = 'FEDEX'
ORDER BY created_at DESC
LIMIT 100;
```

### Check Success Rate

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM integration_logs
WHERE integration_type = 'FEDEX'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Monitor Response Times

```sql
SELECT 
  endpoint,
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  MIN(duration_ms) as min_duration_ms
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '1 day'
GROUP BY endpoint;
```

## Support

### FedEx Support

- Developer Portal: https://developer.fedex.com
- Support Email: devstudio@fedex.com
- API Documentation: https://developer.fedex.com/api/en-us/home.html

### Internal Support

- Check integration logs in database
- Review application logs
- Use monitoring dashboard
- Contact engineering team

## Appendix

### Validation Rules

- **Max Package Weight:** 68 kg (150 lbs)
- **Max Package Length:** 274 cm (108 inches)
- **Max Package Girth:** 419 cm (165 inches)
- **Tracking Number Format:** 12-22 digits
- **Phone Number Format:** 10-15 digits

### Label Formats

- **PDF:** 4x6, 4x6.75, 4x8
- **PNG:** 4x6
- **ZPLII:** For thermal printers

### Best Practices

1. Always use sandbox for testing
2. Store credentials encrypted
3. Log all API calls
4. Monitor error rates
5. Handle errors gracefully
6. Retry transient failures
7. Validate inputs before API calls
8. Use correlation IDs for tracing
