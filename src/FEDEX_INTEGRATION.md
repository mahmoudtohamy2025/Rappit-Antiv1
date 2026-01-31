# FedEx Integration Documentation

## Overview

The FedEx integration provides complete shipping functionality through FedEx's REST API v1. This implementation includes shipment creation, tracking, rate quotes, address validation, and cancellation.

## Architecture

### Components

1. **FedExIntegrationService** (`src/integrations/shipping/fedex-integration.service.ts`)
   - Low-level integration with FedEx REST API
   - Handles OAuth2 authentication, rate limiting, and retry logic
   - Real API calls with mock mode for testing

2. **FedexService** (`src/modules/integrations/fedex/fedex.service.ts`)
   - High-level API for backward compatibility
   - Delegates to FedExIntegrationService
   - Simplified interface for application code

3. **FedExClient** (`src/integrations/shipping/fedex-client.ts`)
   - HTTP client with OAuth2 token management
   - Rate limiting (500 requests/minute)
   - Automatic retry with exponential backoff
   - Circuit breaker pattern for resilience
   - Integration logging

4. **Error Handling** (`src/integrations/shipping/fedex-error.ts`)
   - Custom error classes for different failure types
   - Retryable vs non-retryable error identification
   - Detailed error context for debugging

5. **Validation** (`src/integrations/shipping/fedex-validation.ts`)
   - Input validation before API calls
   - Request sanitization
   - FedEx-specific validation rules

## Features

### ✅ Implemented Features

- **Shipment Creation**: Create domestic and international shipments with labels
- **Tracking**: Real-time tracking with event history
- **Rate Quotes**: Get shipping rates for different service types
- **Address Validation**: Validate and standardize addresses
- **Shipment Cancellation**: Cancel shipments before pickup
- **OAuth2 Authentication**: Automatic token refresh
- **Rate Limiting**: 500 requests/minute with automatic throttling
- **Retry Logic**: 3 retries with exponential backoff for transient errors
- **Circuit Breaker**: Prevents cascading failures
- **Integration Logging**: All API calls logged for auditing
- **Multi-tenant**: Organization-level credential isolation
- **Test Mode**: Mock responses for development and testing

## Configuration

### Environment Variables

```bash
# FedEx API Credentials
FEDEX_API_KEY=your_api_key_here
FEDEX_SECRET_KEY=your_secret_key_here
FEDEX_ACCOUNT_NUMBER=your_account_number_here

# FedEx API URL (sandbox or production)
FEDEX_API_URL=https://apis-sandbox.fedex.com  # or https://apis.fedex.com for production

# Optional: Default shipper information
FEDEX_SHIPPER_NAME="Your Company Name"
FEDEX_SHIPPER_STREET="123 Main Street"
FEDEX_SHIPPER_CITY="Chicago"
FEDEX_SHIPPER_STATE="IL"
FEDEX_SHIPPER_POSTAL_CODE="60601"
FEDEX_SHIPPER_COUNTRY="US"
FEDEX_SHIPPER_PHONE="+13125551234"
```

### Database Configuration

Credentials can be stored per shipping account in the database:

```typescript
{
  carrier: 'FEDEX',
  accountNumber: '123456789',
  credentials: {
    apiKey: 'encrypted_api_key',
    secretKey: 'encrypted_secret_key',
    accountNumber: '123456789',
  },
  testMode: false,
  organizationId: 'org-123',
}
```

## Usage Examples

### Creating a Shipment

```typescript
import { FedExIntegrationService } from '@integrations/shipping/fedex-integration.service';

const service = new FedExIntegrationService(integrationLoggingService);

const request = {
  accountNumber: '123456789',
  testMode: false,
  shipper: {
    name: 'John Doe',
    company: 'Acme Corp',
    address: '123 Main St',
    city: 'Chicago',
    state: 'IL',
    postalCode: '60601',
    country: 'US',
    phone: '+13125551234',
  },
  recipient: {
    name: 'Jane Smith',
    address: '456 Oak Ave',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US',
    phone: '+12125555678',
  },
  packages: [
    {
      weightKg: 5.0,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 15,
    },
  ],
  serviceCode: 'FEDEX_GROUND',
};

const result = await service.createShipment(
  shippingAccount,
  request,
  'correlation-id-123',
);

console.log('Tracking Number:', result.trackingNumber);
console.log('Label:', result.label?.content); // PDF buffer
console.log('Cost:', result.cost);
```

### Tracking a Shipment

```typescript
const tracking = await service.getTracking(
  shippingAccount,
  '794608491820',
  'correlation-id-456',
);

console.log('Status:', tracking.status);
console.log('Events:', tracking.events);
console.log('Estimated Delivery:', tracking.estimatedDelivery);
```

### Getting Rate Quotes

```typescript
const rates = await service.getRates(
  shippingAccount,
  {
    accountNumber: '123456789',
    shipper: {
      name: 'Shipper',
      address: '123 Main St',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'US',
      phone: '+13125551234',
    },
    recipient: {
      name: 'Recipient',
      address: '456 Oak Ave',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
      phone: '+12125555678',
    },
    packages: [{ weightKg: 5.0 }],
  },
  'correlation-id-789',
);

rates.forEach(rate => {
  console.log(`${rate.serviceName}: $${rate.cost}`);
});
```

### Validating an Address

```typescript
const validation = await service.validateAddress(
  shippingAccount,
  {
    street: '123 Main St',
    city: 'Chicago',
    state: 'IL',
    postalCode: '60601',
    country: 'US',
  },
  'correlation-id-abc',
);

if (validation.valid) {
  console.log('Address is valid');
  console.log('Classification:', validation.classification);
  console.log('Resolved Address:', validation.resolvedAddress);
} else {
  console.log('Warnings:', validation.warnings);
}
```

### Cancelling a Shipment

```typescript
const cancelled = await service.cancelShipment(
  shippingAccount,
  '794608491820',
  'correlation-id-def',
);

console.log('Cancelled:', cancelled);
```

## Error Handling

### Error Types

The integration uses custom error classes for different scenarios:

- **FedExError**: Base error class
- **FedExAuthError**: Authentication/authorization failures
- **FedExValidationError**: Input validation errors
- **FedExRateLimitError**: Rate limit exceeded (retryable)
- **FedExServiceUnavailableError**: FedEx service down (retryable)
- **FedExTrackingNotFoundError**: Tracking number not found
- **FedExNetworkError**: Network/timeout errors (retryable)
- **FedExConfigError**: Configuration errors

### Error Handling Example

```typescript
import { FedExError, isFedExError, isRetryableFedExError } from '@integrations/shipping/fedex-error';

try {
  const result = await service.createShipment(shippingAccount, request);
} catch (error) {
  if (isFedExError(error)) {
    console.error('FedEx Error Code:', error.code);
    console.error('Transaction ID:', error.transactionId);
    console.error('Details:', error.details);
    
    if (isRetryableFedExError(error)) {
      // Retry logic
      console.log('Error is retryable, will retry...');
    } else {
      // Handle non-retryable error
      console.error('Error is not retryable');
    }
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

### Common Error Codes

| Error Code | Description | Retryable |
|------------|-------------|-----------|
| `INVALID.INPUT.EXCEPTION` | Invalid input provided | No |
| `SHIPPER.ACCOUNT.REQUIRED` | Account number missing | No |
| `SERVICE.UNAVAILABLE.ERROR` | FedEx service down | Yes |
| `TRACKING.TRACKINGNUMBER.NOTFOUND` | Invalid tracking number | No |
| `UNAUTHORIZED` | Authentication failed | No |
| `FORBIDDEN` | Access denied | No |
| `INTERNAL.SERVER.ERROR` | FedEx internal error | Yes |

## Status Mapping

FedEx status codes are mapped to internal `ShipmentStatus` enum:

| FedEx Code | Internal Status | Description |
|------------|----------------|-------------|
| PU | IN_TRANSIT | Picked up |
| IT, AR, DP | IN_TRANSIT | In transit |
| OD | OUT_FOR_DELIVERY | Out for delivery |
| DL | DELIVERED | Delivered |
| DE, PX | EXCEPTION | Exception occurred |
| CA | CANCELLED | Shipment cancelled |
| RS | RETURNED | Returned to sender |

## Validation Rules

### Package Constraints

- **Maximum Weight**: 68 kg (150 lbs)
- **Maximum Length**: 274 cm (108 inches)
- **Maximum Girth**: 419 cm (165 inches) - length + 2×width + 2×height

### Address Constraints

- **Street Lines**: Maximum 3 lines, 35 characters each
- **City**: Maximum 35 characters
- **Postal Code**: 3-12 alphanumeric characters
- **Phone**: 10-15 digits

### Tracking Number Format

- Must be 12-22 digits
- No letters or special characters

## Testing

### Test Mode

Set `testMode: true` in shipment requests to use mock responses:

```typescript
const request = {
  ...
  testMode: true, // Uses mock implementation
};
```

### Running Tests

```bash
# Run all tests
npm test

# Run FedEx integration tests
npm test -- fedex-integration.spec.ts

# Run error handling tests
npm test -- fedex-error-handling.spec.ts
```

### Test Fixtures

Pre-defined test responses are available in `test/fixtures/fedex-responses.ts`:

- `FEDEX_CREATE_SHIPMENT_SUCCESS`
- `FEDEX_TRACKING_IN_TRANSIT`
- `FEDEX_TRACKING_DELIVERED`
- `FEDEX_RATE_QUOTE_SUCCESS`
- `FEDEX_ERROR_INVALID_INPUT`
- And more...

## Performance Characteristics

### Rate Limiting

- **Maximum Rate**: 500 requests/minute
- **Throttling**: Automatic delay between requests (120ms minimum)
- **Circuit Breaker**: Opens after 5 consecutive failures, closes after 1 minute

### Retry Strategy

- **Max Retries**: 3 attempts
- **Initial Delay**: 1 second
- **Backoff**: Exponential (1s, 2s, 4s)
- **Max Delay**: 30 seconds
- **Retryable Status Codes**: 429, 500, 502, 503, 504

### Token Management

- **Token Lifetime**: 3600 seconds (1 hour)
- **Refresh Buffer**: 5 minutes before expiry
- **Automatic Refresh**: Yes
- **Concurrent Refresh**: Prevented with promise deduplication

## Monitoring and Logging

### Integration Logging

All API calls are logged to the `IntegrationLog` table:

- **Organization ID**: For multi-tenant isolation
- **Request/Response**: Full payload logging
- **Duration**: Response time tracking
- **Correlation ID**: For request tracing
- **Error Details**: Captured on failures

### Metrics to Monitor

1. **Success Rate**: Percentage of successful API calls
2. **Average Response Time**: Latency of FedEx API
3. **Error Rate by Type**: Track specific error codes
4. **Circuit Breaker State**: Monitor for extended outages
5. **Token Refresh Frequency**: Detect authentication issues

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Symptom**: `UNAUTHORIZED` or `FORBIDDEN` errors

**Solutions**:
- Verify API key and secret key are correct
- Check if credentials are for correct environment (sandbox vs production)
- Ensure account number matches credentials
- Verify account has necessary permissions

#### 2. Invalid Input Errors

**Symptom**: `INVALID.INPUT.EXCEPTION` errors

**Solutions**:
- Use validation utilities before API calls
- Check address format (especially postal codes)
- Verify package dimensions are within limits
- Ensure phone numbers are in correct format

#### 3. Rate Limiting

**Symptom**: `429 Too Many Requests` errors

**Solutions**:
- Reduce request frequency
- Implement request queuing
- Check for concurrent requests from multiple instances
- Consider upgrading FedEx account limits

#### 4. Service Unavailable

**Symptom**: `SERVICE.UNAVAILABLE.ERROR` or timeout errors

**Solutions**:
- Check FedEx service status
- Wait for circuit breaker to reset
- Verify network connectivity
- Check firewall rules

#### 5. Tracking Not Found

**Symptom**: `TRACKING.TRACKINGNUMBER.NOTFOUND` errors

**Solutions**:
- Verify tracking number format
- Wait a few minutes after shipment creation
- Check if shipment was created in correct environment
- Verify tracking number wasn't manually entered incorrectly

## Security Considerations

### Credential Storage

- Store API keys encrypted in database
- Use environment variables for default credentials
- Implement credential rotation policy
- Restrict access to credentials by role

### API Security

- All requests use HTTPS (TLS 1.2+)
- OAuth2 bearer tokens for authentication
- Tokens expire after 1 hour
- Organization-level credential isolation

### Data Privacy

- PII is logged in encrypted integration logs
- Logs are scoped by organization ID
- Implement data retention policy
- Regular security audits recommended

## Production Checklist

Before deploying to production:

- [ ] Configure production FedEx API URL
- [ ] Set production API credentials
- [ ] Test with production account in sandbox
- [ ] Configure monitoring and alerting
- [ ] Set up log retention policies
- [ ] Implement credential rotation
- [ ] Test error handling scenarios
- [ ] Verify rate limiting configuration
- [ ] Document operational procedures
- [ ] Train support team on troubleshooting

## Support and Resources

### Official FedEx Documentation

- [FedEx Developer Portal](https://developer.fedex.com)
- [FedEx REST API Reference](https://developer.fedex.com/api/en-us/home.html)
- [FedEx Service Guide](https://www.fedex.com/en-us/service-guide.html)

### Internal Resources

- Issue Tracker: GitHub Issues
- Code Review: Pull Requests
- Monitoring: Integration Logs Dashboard
- Support: DevOps Team

### Version History

- **v1.0**: Initial implementation with core features
- **v1.1**: Added address validation
- **v1.2**: Enhanced error handling and validation
- **v1.3**: Comprehensive test coverage

## Future Enhancements

Potential improvements for future versions:

1. **Label Storage Service**: Persistent storage and retrieval of labels
2. **Pickup Scheduling**: Schedule FedEx pickups
3. **Signature Options**: Enhanced delivery signature requirements
4. **Insurance**: Shipment insurance management
5. **Customs Documentation**: International customs forms
6. **Multi-piece Shipments**: Better support for multiple packages
7. **Return Labels**: Generate return shipping labels
8. **Webhooks**: Receive push notifications from FedEx

## Contributing

When contributing to the FedEx integration:

1. Follow existing code patterns
2. Add tests for new features
3. Update this documentation
4. Test in sandbox environment first
5. Include error handling
6. Add logging for debugging
7. Update type definitions
8. Run linter and tests before committing

## License

This integration is part of the Rappit platform. All rights reserved.
