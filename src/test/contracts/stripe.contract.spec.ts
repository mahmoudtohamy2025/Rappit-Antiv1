/**
 * Stripe API Contract Tests
 * 
 * Uses Pact to verify API contract compatibility with Stripe.
 * These tests ensure our integration remains compatible with Stripe's API.
 * 
 * @packageDocumentation
 */

import { PactV4, LogLevel, MatchersV3 } from '@pact-foundation/pact';
import * as path from 'path';

const { like, eachLike, string, integer, boolean } = MatchersV3;

describe('Stripe API Contract', () => {
  // Create pact provider
  const provider = new PactV4({
    consumer: 'Rappit',
    provider: 'StripeAPI',
    dir: path.resolve(process.cwd(), 'pacts'),
    logLevel: (process.env.PACT_LOG_LEVEL as LogLevel) || 'warn',
  });

  describe('POST /v1/customers', () => {
    it('creates customer with valid API key', async () => {
      await provider
        .addInteraction()
        .given('valid Stripe API key')
        .uponReceiving('a request to create customer')
        .withRequest('POST', '/v1/customers', (builder) => {
          builder
            .headers({
              'Authorization': like('Bearer sk_test_xxxx'),
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            })
            .body('email=customer%40example.com&name=John%20Doe&metadata%5BorganizationId%5D=org_123');
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              id: string('cus_xxxxxxxxxxxxx'),
              object: string('customer'),
              address: like(null),
              balance: integer(0),
              created: integer(1705766400),
              currency: like(null),
              default_source: like(null),
              delinquent: boolean(false),
              description: like(null),
              discount: like(null),
              email: string('customer@example.com'),
              invoice_prefix: string('ABCD1234'),
              invoice_settings: {
                custom_fields: like(null),
                default_payment_method: like(null),
                footer: like(null),
                rendering_options: like(null),
              },
              livemode: boolean(false),
              metadata: {
                organizationId: string('org_123'),
              },
              name: string('John Doe'),
              next_invoice_sequence: integer(1),
              phone: like(null),
              preferred_locales: like([]),
              shipping: like(null),
              tax_exempt: string('none'),
              test_clock: like(null),
            });
        })
        .executeTest(async (mockServer) => {
          const formData = new URLSearchParams();
          formData.append('email', 'customer@example.com');
          formData.append('name', 'John Doe');
          formData.append('metadata[organizationId]', 'org_123');

          const response = await fetch(`${mockServer.url}/v1/customers`, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer sk_test_xxxx',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: formData.toString(),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.id).toBeDefined();
          expect(data.email).toBe('customer@example.com');
        });
    });

    it('returns 401 for invalid API key', async () => {
      await provider
        .addInteraction()
        .given('invalid Stripe API key')
        .uponReceiving('a request with invalid API key')
        .withRequest('POST', '/v1/customers', (builder) => {
          builder
            .headers({
              'Authorization': like('Bearer sk_test_invalid'),
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            });
        })
        .willRespondWith(401, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              error: {
                message: string('Invalid API Key provided: sk_test_*****alid'),
                type: string('invalid_request_error'),
                code: like(null),
                doc_url: like(null),
                param: like(null),
              },
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/v1/customers`, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer sk_test_invalid',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: '',
          });

          expect(response.status).toBe(401);
        });
    });
  });

  describe('POST /v1/subscriptions', () => {
    it('creates subscription for customer', async () => {
      await provider
        .addInteraction()
        .given('valid Stripe API key and customer exists')
        .uponReceiving('a request to create subscription')
        .withRequest('POST', '/v1/subscriptions', (builder) => {
          builder
            .headers({
              'Authorization': like('Bearer sk_test_xxxx'),
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            })
            .body('customer=cus_xxxxxxxxxxxxx&items%5B0%5D%5Bprice%5D=price_xxxxxxxxxxxxx');
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              id: string('sub_xxxxxxxxxxxxx'),
              object: string('subscription'),
              application: like(null),
              application_fee_percent: like(null),
              automatic_tax: {
                enabled: boolean(false),
                liability: like(null),
              },
              billing_cycle_anchor: integer(1705766400),
              billing_cycle_anchor_config: like(null),
              billing_thresholds: like(null),
              cancel_at: like(null),
              cancel_at_period_end: boolean(false),
              canceled_at: like(null),
              cancellation_details: {
                comment: like(null),
                feedback: like(null),
                reason: like(null),
              },
              collection_method: string('charge_automatically'),
              created: integer(1705766400),
              currency: string('sar'),
              current_period_end: integer(1708444800),
              current_period_start: integer(1705766400),
              customer: string('cus_xxxxxxxxxxxxx'),
              days_until_due: like(null),
              default_payment_method: like(null),
              default_source: like(null),
              default_tax_rates: like([]),
              description: like(null),
              discount: like(null),
              ended_at: like(null),
              invoice_settings: {
                account_tax_ids: like(null),
                issuer: {
                  type: string('self'),
                },
              },
              items: {
                object: string('list'),
                data: eachLike({
                  id: string('si_xxxxxxxxxxxxx'),
                  object: string('subscription_item'),
                  billing_thresholds: like(null),
                  created: integer(1705766400),
                  metadata: like({}),
                  plan: {
                    id: string('price_xxxxxxxxxxxxx'),
                    object: string('plan'),
                    active: boolean(true),
                    amount: integer(9900),
                    amount_decimal: string('9900'),
                    billing_scheme: string('per_unit'),
                    created: integer(1705000000),
                    currency: string('sar'),
                    interval: string('month'),
                    interval_count: integer(1),
                    livemode: boolean(false),
                    metadata: like({}),
                    nickname: like(null),
                    product: string('prod_xxxxxxxxxxxxx'),
                    tiers_mode: like(null),
                    transform_usage: like(null),
                    trial_period_days: like(null),
                    usage_type: string('licensed'),
                  },
                  price: {
                    id: string('price_xxxxxxxxxxxxx'),
                    object: string('price'),
                    active: boolean(true),
                    billing_scheme: string('per_unit'),
                    created: integer(1705000000),
                    currency: string('sar'),
                    custom_unit_amount: like(null),
                    livemode: boolean(false),
                    lookup_key: like(null),
                    metadata: like({}),
                    nickname: like(null),
                    product: string('prod_xxxxxxxxxxxxx'),
                    recurring: {
                      aggregate_usage: like(null),
                      interval: string('month'),
                      interval_count: integer(1),
                      trial_period_days: like(null),
                      usage_type: string('licensed'),
                    },
                    tax_behavior: string('unspecified'),
                    tiers_mode: like(null),
                    transform_quantity: like(null),
                    type: string('recurring'),
                    unit_amount: integer(9900),
                    unit_amount_decimal: string('9900'),
                  },
                  quantity: integer(1),
                  subscription: string('sub_xxxxxxxxxxxxx'),
                  tax_rates: like([]),
                }),
                has_more: boolean(false),
                total_count: integer(1),
                url: string('/v1/subscription_items?subscription=sub_xxxxxxxxxxxxx'),
              },
              latest_invoice: string('in_xxxxxxxxxxxxx'),
              livemode: boolean(false),
              metadata: like({}),
              next_pending_invoice_item_invoice: like(null),
              on_behalf_of: like(null),
              pause_collection: like(null),
              payment_settings: {
                payment_method_options: like(null),
                payment_method_types: like(null),
                save_default_payment_method: string('off'),
              },
              pending_invoice_item_interval: like(null),
              pending_setup_intent: like(null),
              pending_update: like(null),
              plan: {
                id: string('price_xxxxxxxxxxxxx'),
                object: string('plan'),
                active: boolean(true),
                amount: integer(9900),
                amount_decimal: string('9900'),
                billing_scheme: string('per_unit'),
                created: integer(1705000000),
                currency: string('sar'),
                interval: string('month'),
                interval_count: integer(1),
                livemode: boolean(false),
                metadata: like({}),
                nickname: like(null),
                product: string('prod_xxxxxxxxxxxxx'),
                tiers_mode: like(null),
                transform_usage: like(null),
                trial_period_days: like(null),
                usage_type: string('licensed'),
              },
              quantity: integer(1),
              schedule: like(null),
              start_date: integer(1705766400),
              status: string('active'),
              test_clock: like(null),
              transfer_data: like(null),
              trial_end: like(null),
              trial_settings: {
                end_behavior: {
                  missing_payment_method: string('create_invoice'),
                },
              },
              trial_start: like(null),
            });
        })
        .executeTest(async (mockServer) => {
          const formData = new URLSearchParams();
          formData.append('customer', 'cus_xxxxxxxxxxxxx');
          formData.append('items[0][price]', 'price_xxxxxxxxxxxxx');

          const response = await fetch(`${mockServer.url}/v1/subscriptions`, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer sk_test_xxxx',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: formData.toString(),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.id).toBeDefined();
          expect(data.status).toBe('active');
        });
    });
  });

  describe('GET /v1/subscriptions/:id', () => {
    it('retrieves subscription by ID', async () => {
      await provider
        .addInteraction()
        .given('valid Stripe API key and subscription exists')
        .uponReceiving('a request to retrieve subscription')
        .withRequest('GET', '/v1/subscriptions/sub_xxxxxxxxxxxxx', (builder) => {
          builder.headers({
            'Authorization': like('Bearer sk_test_xxxx'),
            'Accept': 'application/json',
          });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              id: string('sub_xxxxxxxxxxxxx'),
              object: string('subscription'),
              status: string('active'),
              customer: string('cus_xxxxxxxxxxxxx'),
              current_period_start: integer(1705766400),
              current_period_end: integer(1708444800),
              cancel_at_period_end: boolean(false),
              created: integer(1705766400),
              currency: string('sar'),
              collection_method: string('charge_automatically'),
              items: {
                object: string('list'),
                data: eachLike({
                  id: string('si_xxxxxxxxxxxxx'),
                  object: string('subscription_item'),
                  price: {
                    id: string('price_xxxxxxxxxxxxx'),
                    object: string('price'),
                    active: boolean(true),
                    currency: string('sar'),
                    unit_amount: integer(9900),
                    product: string('prod_xxxxxxxxxxxxx'),
                    recurring: {
                      interval: string('month'),
                      interval_count: integer(1),
                    },
                  },
                  quantity: integer(1),
                }),
                has_more: boolean(false),
                total_count: integer(1),
              },
              livemode: boolean(false),
              metadata: like({}),
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/v1/subscriptions/sub_xxxxxxxxxxxxx`,
            {
              headers: {
                'Authorization': 'Bearer sk_test_xxxx',
                'Accept': 'application/json',
              },
            },
          );

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.id).toBe('sub_xxxxxxxxxxxxx');
          expect(data.status).toBe('active');
        });
    });
  });

  describe('POST /v1/billing_portal/sessions', () => {
    it('creates billing portal session', async () => {
      await provider
        .addInteraction()
        .given('valid Stripe API key and customer exists')
        .uponReceiving('a request to create billing portal session')
        .withRequest('POST', '/v1/billing_portal/sessions', (builder) => {
          builder
            .headers({
              'Authorization': like('Bearer sk_test_xxxx'),
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            })
            .body('customer=cus_xxxxxxxxxxxxx&return_url=https%3A%2F%2Fexample.com%2Fbilling');
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              id: string('bps_xxxxxxxxxxxxx'),
              object: string('billing_portal.session'),
              configuration: string('bpc_xxxxxxxxxxxxx'),
              created: integer(1705766400),
              customer: string('cus_xxxxxxxxxxxxx'),
              flow: like(null),
              livemode: boolean(false),
              locale: like(null),
              on_behalf_of: like(null),
              return_url: string('https://example.com/billing'),
              url: string('https://billing.stripe.com/session/xxxxxxxxxxxxx'),
            });
        })
        .executeTest(async (mockServer) => {
          const formData = new URLSearchParams();
          formData.append('customer', 'cus_xxxxxxxxxxxxx');
          formData.append('return_url', 'https://example.com/billing');

          const response = await fetch(`${mockServer.url}/v1/billing_portal/sessions`, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer sk_test_xxxx',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: formData.toString(),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.url).toBeDefined();
        });
    });
  });

  describe('POST /v1/checkout/sessions', () => {
    it('creates checkout session', async () => {
      await provider
        .addInteraction()
        .given('valid Stripe API key')
        .uponReceiving('a request to create checkout session')
        .withRequest('POST', '/v1/checkout/sessions', (builder) => {
          builder
            .headers({
              'Authorization': like('Bearer sk_test_xxxx'),
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              id: string('cs_xxxxxxxxxxxxx'),
              object: string('checkout.session'),
              after_expiration: like(null),
              allow_promotion_codes: like(null),
              amount_subtotal: integer(9900),
              amount_total: integer(9900),
              automatic_tax: {
                enabled: boolean(false),
                liability: like(null),
                status: like(null),
              },
              billing_address_collection: like(null),
              cancel_url: string('https://example.com/cancel'),
              client_reference_id: like(null),
              client_secret: like(null),
              consent: like(null),
              consent_collection: like(null),
              created: integer(1705766400),
              currency: string('sar'),
              custom_fields: like([]),
              custom_text: {
                after_submit: like(null),
                shipping_address: like(null),
                submit: like(null),
                terms_of_service_acceptance: like(null),
              },
              customer: like(null),
              customer_creation: string('always'),
              customer_details: like(null),
              customer_email: like(null),
              expires_at: integer(1705852800),
              invoice: like(null),
              invoice_creation: like(null),
              livemode: boolean(false),
              locale: like(null),
              metadata: like({}),
              mode: string('subscription'),
              payment_intent: like(null),
              payment_link: like(null),
              payment_method_collection: string('always'),
              payment_method_configuration_details: like(null),
              payment_method_options: like({}),
              payment_method_types: eachLike(string('card')),
              payment_status: string('unpaid'),
              phone_number_collection: {
                enabled: boolean(false),
              },
              recovered_from: like(null),
              setup_intent: like(null),
              shipping_address_collection: like(null),
              shipping_cost: like(null),
              shipping_details: like(null),
              shipping_options: like([]),
              status: string('open'),
              submit_type: like(null),
              subscription: like(null),
              success_url: string('https://example.com/success'),
              total_details: {
                amount_discount: integer(0),
                amount_shipping: integer(0),
                amount_tax: integer(0),
              },
              ui_mode: string('hosted'),
              url: string('https://checkout.stripe.com/c/pay/cs_xxxxxxxxxxxxx'),
            });
        })
        .executeTest(async (mockServer) => {
          const formData = new URLSearchParams();
          formData.append('mode', 'subscription');
          formData.append('success_url', 'https://example.com/success');
          formData.append('cancel_url', 'https://example.com/cancel');
          formData.append('line_items[0][price]', 'price_xxxxxxxxxxxxx');
          formData.append('line_items[0][quantity]', '1');

          const response = await fetch(`${mockServer.url}/v1/checkout/sessions`, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer sk_test_xxxx',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: formData.toString(),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.url).toBeDefined();
        });
    });
  });
});
