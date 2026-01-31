# Contract Tests

This directory contains **Pact** contract tests for external API integrations. Contract tests verify that our integration code remains compatible with the external APIs we consume.

## What are Contract Tests?

Contract tests ensure that:
1. Our integration code correctly handles API responses
2. We are notified when external APIs change their response format
3. We can verify API compatibility without making real API calls

## External APIs Covered

| Provider | Test File | Description |
|----------|-----------|-------------|
| Shopify REST | `shopify-rest.contract.spec.ts` | Shop, Orders, Products endpoints |
| Shopify GraphQL | `shopify-graphql.contract.spec.ts` | Shop, Orders, Products, Inventory, Fulfillments |
| WooCommerce REST | `woocommerce-rest.contract.spec.ts` | System status, Orders, Products |
| DHL Express | `dhl-express.contract.spec.ts` | Shipments, Tracking, Address validation |
| FedEx | `fedex.contract.spec.ts` | OAuth, Shipments, Tracking, Rates |
| Stripe | `stripe.contract.spec.ts` | Customers, Subscriptions, Checkout, Portal |

## Running Contract Tests

```bash
# Run all contract tests
npm run test:contracts

# Run specific provider tests
npm run test -- --testPathPattern=shopify-rest.contract
npm run test -- --testPathPattern=woocommerce-rest.contract
npm run test -- --testPathPattern=dhl-express.contract
npm run test -- --testPathPattern=fedex.contract
npm run test -- --testPathPattern=stripe.contract
```

## Pact Files

After running the tests, Pact files are generated in the `pacts/` directory:

- `Rappit-ShopifyREST.json`
- `Rappit-ShopifyGraphQL.json`
- `Rappit-WooCommerceREST.json`
- `Rappit-DHLExpress.json`
- `Rappit-FedExAPI.json`
- `Rappit-StripeAPI.json`

These files can be published to a Pact Broker for provider verification.

## Provider Verification (Optional)

To verify that external APIs still match the contract:

1. Set up a Pact Broker
2. Publish contracts: `npx pact-broker publish ./pacts --consumer-app-version=$(git rev-parse HEAD)`
3. Providers can then verify against these contracts

## Adding New Contract Tests

1. Create a new file: `<provider>.contract.spec.ts`
2. Use PactV4 for provider definition
3. Define interactions using `addInteraction()`
4. Use matchers (`like`, `eachLike`, `string`, etc.) for flexible matching
5. Execute tests against mock server

Example:

```typescript
import { PactV4, MatchersV3 } from '@pact-foundation/pact';

const { like, string } = MatchersV3;

describe('New API Contract', () => {
  const provider = new PactV4({
    consumer: 'Rappit',
    provider: 'NewAPI',
    dir: path.resolve(process.cwd(), 'pacts'),
  });

  it('handles expected response', async () => {
    await provider
      .addInteraction()
      .given('valid credentials')
      .uponReceiving('a request')
      .withRequest('GET', '/endpoint')
      .willRespondWith(200, (builder) => {
        builder.jsonBody({
          id: string('123'),
          name: like('Test'),
        });
      })
      .executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/endpoint`);
        expect(response.status).toBe(200);
      });
  });
});
```

## Best Practices

1. **Use Matchers**: Don't hardcode values; use `like()`, `string()`, `integer()` for flexibility
2. **Document States**: Use `.given()` to describe provider states clearly
3. **Cover Error Cases**: Test 401, 403, 404, and other error responses
4. **Keep Tests Focused**: One interaction per test for clarity
5. **Version Your API**: Include API version in paths (e.g., `/admin/api/2024-01/`)

## CI Integration

Contract tests run as part of the test suite. In CI:

1. Tests run against mock servers (no real API calls)
2. Pact files are generated
3. Contracts can be published to Pact Broker (optional)

## Resources

- [Pact Documentation](https://docs.pact.io/)
- [Pact JS](https://github.com/pact-foundation/pact-js)
- [Shopify API Documentation](https://shopify.dev/docs/api)
- [WooCommerce API Documentation](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- [DHL API Documentation](https://developer.dhl.com/)
- [FedEx API Documentation](https://developer.fedex.com/)
- [Stripe API Documentation](https://stripe.com/docs/api)
