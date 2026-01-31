/**
 * Shopify GraphQL API Contract Tests
 * 
 * Uses Pact to verify API contract compatibility with Shopify's GraphQL Admin API.
 * These tests ensure our integration remains compatible with Shopify's GraphQL schema.
 * 
 * @packageDocumentation
 */

import { PactV4, LogLevel, MatchersV3 } from '@pact-foundation/pact';
import * as path from 'path';

const { like, eachLike, string, integer, boolean, number } = MatchersV3;

describe('Shopify GraphQL API Contract', () => {
  // Create pact provider
  const provider = new PactV4({
    consumer: 'Rappit',
    provider: 'ShopifyGraphQL',
    dir: path.resolve(process.cwd(), 'pacts'),
    logLevel: (process.env.PACT_LOG_LEVEL as LogLevel) || 'warn',
  });

  describe('POST /admin/api/2024-01/graphql.json - Shop Query', () => {
    it('returns shop information for valid credentials', async () => {
      await provider
        .addInteraction()
        .given('valid Shopify access token')
        .uponReceiving('a GraphQL query for shop information')
        .withRequest('POST', '/admin/api/2024-01/graphql.json', (builder) => {
          builder
            .headers({
              'X-Shopify-Access-Token': 'valid-access-token',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            })
            .jsonBody({
              query: like(`query {
                shop {
                  name
                  email
                  primaryDomain {
                    url
                  }
                  currencyCode
                  timezoneAbbreviation
                }
              }`),
            });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              data: {
                shop: {
                  name: string('Test Shop'),
                  email: string('shop@example.com'),
                  primaryDomain: {
                    url: string('https://test-shop.myshopify.com'),
                  },
                  currencyCode: string('SAR'),
                  timezoneAbbreviation: string('AST'),
                },
              },
              extensions: {
                cost: {
                  requestedQueryCost: integer(3),
                  actualQueryCost: integer(3),
                  throttleStatus: {
                    maximumAvailable: number(1000),
                    currentlyAvailable: integer(997),
                    restoreRate: number(50),
                  },
                },
              },
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/admin/api/2024-01/graphql.json`, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': 'valid-access-token',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              query: `query {
                shop {
                  name
                  email
                  primaryDomain {
                    url
                  }
                  currencyCode
                  timezoneAbbreviation
                }
              }`,
            }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.data.shop).toBeDefined();
          expect(data.data.shop.name).toBeDefined();
        });
    });
  });

  describe('POST /admin/api/2024-01/graphql.json - Orders Query', () => {
    it('returns orders list for valid credentials', async () => {
      await provider
        .addInteraction()
        .given('valid Shopify access token and orders exist')
        .uponReceiving('a GraphQL query for orders')
        .withRequest('POST', '/admin/api/2024-01/graphql.json', (builder) => {
          builder
            .headers({
              'X-Shopify-Access-Token': 'valid-access-token',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            })
            .jsonBody({
              query: like(`query($first: Int!) {
                orders(first: $first) {
                  edges {
                    node {
                      id
                      name
                      email
                      createdAt
                      totalPriceSet {
                        shopMoney {
                          amount
                          currencyCode
                        }
                      }
                      displayFinancialStatus
                      displayFulfillmentStatus
                    }
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                }
              }`),
              variables: like({ first: 50 }),
            });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              data: {
                orders: {
                  edges: eachLike({
                    node: {
                      id: string('gid://shopify/Order/12345'),
                      name: string('#1001'),
                      email: string('customer@example.com'),
                      createdAt: string('2024-01-15T10:00:00Z'),
                      totalPriceSet: {
                        shopMoney: {
                          amount: string('100.00'),
                          currencyCode: string('SAR'),
                        },
                      },
                      displayFinancialStatus: string('PAID'),
                      displayFulfillmentStatus: string('UNFULFILLED'),
                    },
                  }),
                  pageInfo: {
                    hasNextPage: boolean(true),
                    endCursor: string('eyJsYXN0X2lkIjoxMjM0NX0='),
                  },
                },
              },
              extensions: {
                cost: {
                  requestedQueryCost: integer(52),
                  actualQueryCost: integer(52),
                  throttleStatus: {
                    maximumAvailable: number(1000),
                    currentlyAvailable: integer(948),
                    restoreRate: number(50),
                  },
                },
              },
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/admin/api/2024-01/graphql.json`, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': 'valid-access-token',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              query: `query($first: Int!) {
                orders(first: $first) {
                  edges {
                    node {
                      id
                      name
                      email
                      createdAt
                      totalPriceSet {
                        shopMoney {
                          amount
                          currencyCode
                        }
                      }
                      displayFinancialStatus
                      displayFulfillmentStatus
                    }
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                }
              }`,
              variables: { first: 50 },
            }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.data.orders.edges).toBeDefined();
        });
    });
  });

  describe('POST /admin/api/2024-01/graphql.json - Products Query', () => {
    it('returns products list for valid credentials', async () => {
      await provider
        .addInteraction()
        .given('valid Shopify access token and products exist')
        .uponReceiving('a GraphQL query for products')
        .withRequest('POST', '/admin/api/2024-01/graphql.json', (builder) => {
          builder
            .headers({
              'X-Shopify-Access-Token': 'valid-access-token',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            })
            .jsonBody({
              query: like(`query($first: Int!) {
                products(first: $first) {
                  edges {
                    node {
                      id
                      title
                      handle
                      status
                      variants(first: 10) {
                        edges {
                          node {
                            id
                            title
                            sku
                            price
                            inventoryQuantity
                          }
                        }
                      }
                    }
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                }
              }`),
              variables: like({ first: 50 }),
            });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              data: {
                products: {
                  edges: eachLike({
                    node: {
                      id: string('gid://shopify/Product/12345'),
                      title: string('Test Product'),
                      handle: string('test-product'),
                      status: string('ACTIVE'),
                      variants: {
                        edges: eachLike({
                          node: {
                            id: string('gid://shopify/ProductVariant/12345'),
                            title: string('Default'),
                            sku: string('TEST-SKU-001'),
                            price: string('100.00'),
                            inventoryQuantity: integer(100),
                          },
                        }),
                      },
                    },
                  }),
                  pageInfo: {
                    hasNextPage: boolean(false),
                    endCursor: string('eyJsYXN0X2lkIjoxMjM0NX0='),
                  },
                },
              },
              extensions: {
                cost: {
                  requestedQueryCost: integer(102),
                  actualQueryCost: integer(54),
                  throttleStatus: {
                    maximumAvailable: number(1000),
                    currentlyAvailable: integer(946),
                    restoreRate: number(50),
                  },
                },
              },
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/admin/api/2024-01/graphql.json`, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': 'valid-access-token',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              query: `query($first: Int!) {
                products(first: $first) {
                  edges {
                    node {
                      id
                      title
                      handle
                      status
                      variants(first: 10) {
                        edges {
                          node {
                            id
                            title
                            sku
                            price
                            inventoryQuantity
                          }
                        }
                      }
                    }
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                }
              }`,
              variables: { first: 50 },
            }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.data.products.edges).toBeDefined();
        });
    });
  });

  describe('POST /admin/api/2024-01/graphql.json - Inventory Update Mutation', () => {
    it('updates inventory level', async () => {
      await provider
        .addInteraction()
        .given('valid Shopify access token and inventory item exists')
        .uponReceiving('a GraphQL mutation to update inventory')
        .withRequest('POST', '/admin/api/2024-01/graphql.json', (builder) => {
          builder
            .headers({
              'X-Shopify-Access-Token': 'valid-access-token',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            })
            .jsonBody({
              query: like(`mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
                inventoryAdjustQuantities(input: $input) {
                  inventoryAdjustmentGroup {
                    createdAt
                    reason
                    changes {
                      name
                      delta
                    }
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }`),
              variables: like({
                input: {
                  name: 'available',
                  reason: 'correction',
                  changes: [
                    {
                      inventoryItemId: 'gid://shopify/InventoryItem/12345',
                      locationId: 'gid://shopify/Location/12345',
                      delta: 10,
                    },
                  ],
                },
              }),
            });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              data: {
                inventoryAdjustQuantities: {
                  inventoryAdjustmentGroup: {
                    createdAt: string('2024-01-15T10:00:00Z'),
                    reason: string('correction'),
                    changes: eachLike({
                      name: string('available'),
                      delta: integer(10),
                    }),
                  },
                  userErrors: like([]),
                },
              },
              extensions: {
                cost: {
                  requestedQueryCost: integer(10),
                  actualQueryCost: integer(10),
                  throttleStatus: {
                    maximumAvailable: number(1000),
                    currentlyAvailable: integer(990),
                    restoreRate: number(50),
                  },
                },
              },
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/admin/api/2024-01/graphql.json`, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': 'valid-access-token',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              query: `mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
                inventoryAdjustQuantities(input: $input) {
                  inventoryAdjustmentGroup {
                    createdAt
                    reason
                    changes {
                      name
                      delta
                    }
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }`,
              variables: {
                input: {
                  name: 'available',
                  reason: 'correction',
                  changes: [
                    {
                      inventoryItemId: 'gid://shopify/InventoryItem/12345',
                      locationId: 'gid://shopify/Location/12345',
                      delta: 10,
                    },
                  ],
                },
              },
            }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.data.inventoryAdjustQuantities).toBeDefined();
        });
    });
  });

  describe('POST /admin/api/2024-01/graphql.json - Fulfillment Creation', () => {
    it('creates fulfillment for order', async () => {
      await provider
        .addInteraction()
        .given('valid Shopify access token and order exists')
        .uponReceiving('a GraphQL mutation to create fulfillment')
        .withRequest('POST', '/admin/api/2024-01/graphql.json', (builder) => {
          builder
            .headers({
              'X-Shopify-Access-Token': 'valid-access-token',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            })
            .jsonBody({
              query: like(`mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
                fulfillmentCreateV2(fulfillment: $fulfillment) {
                  fulfillment {
                    id
                    status
                    trackingInfo {
                      number
                      url
                      company
                    }
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }`),
              variables: like({
                fulfillment: {
                  lineItemsByFulfillmentOrder: [
                    {
                      fulfillmentOrderId: 'gid://shopify/FulfillmentOrder/12345',
                    },
                  ],
                  trackingInfo: {
                    company: 'DHL Express',
                    number: 'DHL1234567890',
                    url: 'https://www.dhl.com/track?id=DHL1234567890',
                  },
                  notifyCustomer: true,
                },
              }),
            });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              data: {
                fulfillmentCreateV2: {
                  fulfillment: {
                    id: string('gid://shopify/Fulfillment/12345'),
                    status: string('SUCCESS'),
                    trackingInfo: eachLike({
                      number: string('DHL1234567890'),
                      url: string('https://www.dhl.com/track?id=DHL1234567890'),
                      company: string('DHL Express'),
                    }),
                  },
                  userErrors: like([]),
                },
              },
              extensions: {
                cost: {
                  requestedQueryCost: integer(10),
                  actualQueryCost: integer(10),
                  throttleStatus: {
                    maximumAvailable: number(1000),
                    currentlyAvailable: integer(990),
                    restoreRate: number(50),
                  },
                },
              },
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/admin/api/2024-01/graphql.json`, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': 'valid-access-token',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              query: `mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
                fulfillmentCreateV2(fulfillment: $fulfillment) {
                  fulfillment {
                    id
                    status
                    trackingInfo {
                      number
                      url
                      company
                    }
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }`,
              variables: {
                fulfillment: {
                  lineItemsByFulfillmentOrder: [
                    {
                      fulfillmentOrderId: 'gid://shopify/FulfillmentOrder/12345',
                    },
                  ],
                  trackingInfo: {
                    company: 'DHL Express',
                    number: 'DHL1234567890',
                    url: 'https://www.dhl.com/track?id=DHL1234567890',
                  },
                  notifyCustomer: true,
                },
              },
            }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.data.fulfillmentCreateV2.fulfillment).toBeDefined();
        });
    });
  });
});
