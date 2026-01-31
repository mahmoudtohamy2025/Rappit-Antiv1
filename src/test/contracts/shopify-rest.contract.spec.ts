/**
 * Shopify REST API Contract Tests
 * 
 * Uses Pact to verify API contract compatibility with Shopify.
 * These tests ensure our integration remains compatible with Shopify's API.
 * 
 * @packageDocumentation
 */

import { PactV4, LogLevel, MatchersV3 } from '@pact-foundation/pact';
import * as path from 'path';

const { like, eachLike, datetime, string, integer } = MatchersV3;

describe('Shopify REST API Contract', () => {
  // Create pact provider
  const provider = new PactV4({
    consumer: 'Rappit',
    provider: 'ShopifyREST',
    dir: path.resolve(process.cwd(), 'pacts'),
    logLevel: (process.env.PACT_LOG_LEVEL as LogLevel) || 'warn',
  });

  describe('GET /admin/api/2024-01/shop.json', () => {
    it('returns shop information for valid credentials', async () => {
      await provider
        .addInteraction()
        .given('valid Shopify access token')
        .uponReceiving('a request for shop information')
        .withRequest('GET', '/admin/api/2024-01/shop.json', (builder) => {
          builder.headers({
            'X-Shopify-Access-Token': 'valid-access-token',
            'Accept': 'application/json',
          });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              shop: {
                id: integer(12345),
                name: string('Test Shop'),
                email: string('shop@example.com'),
                domain: string('test-shop.myshopify.com'),
                province: string(''),
                country: string('SA'),
                address1: string('123 Main St'),
                zip: string('12345'),
                city: string('Riyadh'),
                source: like(null),
                phone: string('+966123456789'),
                latitude: like(24.7136),
                longitude: like(46.6753),
                primary_locale: string('en'),
                address2: like(''),
                created_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                updated_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                country_code: string('SA'),
                country_name: string('Saudi Arabia'),
                currency: string('SAR'),
                customer_email: string('support@example.com'),
                timezone: string('(GMT+03:00) Asia/Riyadh'),
                iana_timezone: string('Asia/Riyadh'),
                shop_owner: string('Shop Owner'),
                money_format: string('SAR {{ amount }}'),
                money_with_currency_format: string('SAR {{ amount }} SAR'),
                weight_unit: string('kg'),
                province_code: like(null),
                taxes_included: like(true),
                auto_configure_tax_inclusivity: like(null),
                tax_shipping: like(null),
                county_taxes: like(true),
                plan_display_name: string('Basic'),
                plan_name: string('basic'),
                has_discounts: like(false),
                has_gift_cards: like(false),
                myshopify_domain: string('test-shop.myshopify.com'),
                google_apps_domain: like(null),
                google_apps_login_enabled: like(null),
                money_in_emails_format: string('SAR {{amount}}'),
                money_with_currency_in_emails_format: string('SAR {{amount}} SAR'),
                eligible_for_payments: like(true),
                requires_extra_payments_agreement: like(false),
                password_enabled: like(false),
                has_storefront: like(true),
                eligible_for_card_reader_giveaway: like(false),
                finances: like(true),
                primary_location_id: integer(12345678),
                cookie_consent_level: string('implicit'),
                visitor_tracking_consent_preference: string('allow_all'),
                checkout_api_supported: like(true),
                multi_location_enabled: like(true),
                setup_required: like(false),
                pre_launch_enabled: like(false),
                enabled_presentment_currencies: eachLike('SAR'),
                transactional_sms_disabled: like(false),
                marketing_sms_consent_enabled_at_checkout: like(false),
              },
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/admin/api/2024-01/shop.json`, {
            headers: {
              'X-Shopify-Access-Token': 'valid-access-token',
              'Accept': 'application/json',
            },
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.shop).toBeDefined();
          expect(data.shop.name).toBeDefined();
          expect(data.shop.currency).toBeDefined();
        });
    });

    it('returns 401 for invalid credentials', async () => {
      await provider
        .addInteraction()
        .given('invalid Shopify access token')
        .uponReceiving('a request with invalid token')
        .withRequest('GET', '/admin/api/2024-01/shop.json', (builder) => {
          builder.headers({
            'X-Shopify-Access-Token': 'invalid-token',
            'Accept': 'application/json',
          });
        })
        .willRespondWith(401, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              errors: string('[API] Invalid API key or access token (unrecognized login or wrong password)'),
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/admin/api/2024-01/shop.json`, {
            headers: {
              'X-Shopify-Access-Token': 'invalid-token',
              'Accept': 'application/json',
            },
          });

          expect(response.status).toBe(401);
        });
    });
  });

  describe('GET /admin/api/2024-01/orders.json', () => {
    it('returns orders list for valid credentials', async () => {
      await provider
        .addInteraction()
        .given('valid Shopify access token and orders exist')
        .uponReceiving('a request for orders list')
        .withRequest('GET', '/admin/api/2024-01/orders.json', (builder) => {
          builder
            .headers({
              'X-Shopify-Access-Token': 'valid-access-token',
              'Accept': 'application/json',
            })
            .query({ status: 'any', limit: '50' });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              orders: eachLike({
                id: integer(12345),
                email: string('customer@example.com'),
                closed_at: like(null),
                created_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                updated_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                number: integer(1),
                note: like(null),
                token: string('abc123'),
                gateway: string('manual'),
                test: like(false),
                total_price: string('100.00'),
                subtotal_price: string('90.00'),
                total_weight: integer(1000),
                total_tax: string('10.00'),
                taxes_included: like(false),
                currency: string('SAR'),
                financial_status: string('paid'),
                confirmed: like(true),
                total_discounts: string('0.00'),
                total_line_items_price: string('90.00'),
                cart_token: like(null),
                buyer_accepts_marketing: like(false),
                name: string('#1001'),
                referring_site: like(null),
                landing_site: like(null),
                cancelled_at: like(null),
                cancel_reason: like(null),
                total_price_usd: string('26.67'),
                checkout_token: like(null),
                reference: like(null),
                user_id: like(null),
                location_id: like(null),
                source_identifier: like(null),
                source_url: like(null),
                processed_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                device_id: like(null),
                phone: string('+966500000000'),
                customer_locale: string('en'),
                app_id: integer(12345),
                browser_ip: like('192.168.1.1'),
                fulfillment_status: like(null),
                order_status_url: string('https://test-shop.myshopify.com/orders/abc123'),
                line_items: eachLike({
                  id: integer(12345),
                  variant_id: integer(12345),
                  title: string('Test Product'),
                  quantity: integer(1),
                  sku: string('TEST-SKU-001'),
                  variant_title: string('Default'),
                  vendor: like(null),
                  fulfillment_service: string('manual'),
                  product_id: integer(12345),
                  requires_shipping: like(true),
                  taxable: like(true),
                  gift_card: like(false),
                  name: string('Test Product - Default'),
                  variant_inventory_management: string('shopify'),
                  properties: like([]),
                  product_exists: like(true),
                  fulfillable_quantity: integer(1),
                  grams: integer(1000),
                  price: string('90.00'),
                  total_discount: string('0.00'),
                  fulfillment_status: like(null),
                }),
                billing_address: like({
                  first_name: string('John'),
                  address1: string('123 Main St'),
                  phone: string('+966500000000'),
                  city: string('Riyadh'),
                  zip: string('12345'),
                  province: like(null),
                  country: string('Saudi Arabia'),
                  last_name: string('Doe'),
                  address2: like(''),
                  company: like(null),
                  latitude: like(24.7136),
                  longitude: like(46.6753),
                  name: string('John Doe'),
                  country_code: string('SA'),
                  province_code: like(null),
                }),
                shipping_address: like({
                  first_name: string('John'),
                  address1: string('123 Main St'),
                  phone: string('+966500000000'),
                  city: string('Riyadh'),
                  zip: string('12345'),
                  province: like(null),
                  country: string('Saudi Arabia'),
                  last_name: string('Doe'),
                  address2: like(''),
                  company: like(null),
                  latitude: like(24.7136),
                  longitude: like(46.6753),
                  name: string('John Doe'),
                  country_code: string('SA'),
                  province_code: like(null),
                }),
                customer: {
                  id: integer(12345),
                  email: string('customer@example.com'),
                  accepts_marketing: like(false),
                  created_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                  updated_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                  first_name: string('John'),
                  last_name: string('Doe'),
                  orders_count: integer(1),
                  state: string('disabled'),
                  total_spent: string('100.00'),
                  last_order_id: integer(12345),
                  note: like(null),
                  verified_email: like(true),
                  multipass_identifier: like(null),
                  tax_exempt: like(false),
                  phone: string('+966500000000'),
                  tags: string(''),
                  last_order_name: string('#1001'),
                  currency: string('SAR'),
                  accepts_marketing_updated_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                  marketing_opt_in_level: like(null),
                  admin_graphql_api_id: string('gid://shopify/Customer/12345'),
                },
              }),
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/admin/api/2024-01/orders.json?status=any&limit=50`, {
            headers: {
              'X-Shopify-Access-Token': 'valid-access-token',
              'Accept': 'application/json',
            },
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.orders).toBeDefined();
          expect(Array.isArray(data.orders)).toBe(true);
        });
    });
  });

  describe('GET /admin/api/2024-01/products.json', () => {
    it('returns products list for valid credentials', async () => {
      await provider
        .addInteraction()
        .given('valid Shopify access token and products exist')
        .uponReceiving('a request for products list')
        .withRequest('GET', '/admin/api/2024-01/products.json', (builder) => {
          builder
            .headers({
              'X-Shopify-Access-Token': 'valid-access-token',
              'Accept': 'application/json',
            })
            .query({ limit: '50' });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              products: eachLike({
                id: integer(12345),
                title: string('Test Product'),
                body_html: like('<p>Product description</p>'),
                vendor: string('Test Vendor'),
                product_type: string('Test Category'),
                created_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                handle: string('test-product'),
                updated_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                published_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                template_suffix: like(null),
                status: string('active'),
                published_scope: string('web'),
                tags: string('tag1, tag2'),
                admin_graphql_api_id: string('gid://shopify/Product/12345'),
                variants: eachLike({
                  id: integer(12345),
                  product_id: integer(12345),
                  title: string('Default'),
                  price: string('100.00'),
                  sku: string('TEST-SKU-001'),
                  position: integer(1),
                  inventory_policy: string('deny'),
                  compare_at_price: like(null),
                  fulfillment_service: string('manual'),
                  inventory_management: string('shopify'),
                  option1: string('Default'),
                  option2: like(null),
                  option3: like(null),
                  created_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                  updated_at: datetime("yyyy-MM-dd'T'HH:mm:ssXXX"),
                  taxable: like(true),
                  barcode: like(null),
                  grams: integer(1000),
                  image_id: like(null),
                  weight: integer(1),
                  weight_unit: string('kg'),
                  inventory_item_id: integer(12345),
                  inventory_quantity: integer(100),
                  old_inventory_quantity: integer(100),
                  requires_shipping: like(true),
                  admin_graphql_api_id: string('gid://shopify/ProductVariant/12345'),
                }),
                options: eachLike({
                  id: integer(12345),
                  product_id: integer(12345),
                  name: string('Title'),
                  position: integer(1),
                  values: eachLike('Default'),
                }),
                images: like([]),
                image: like(null),
              }),
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/admin/api/2024-01/products.json?limit=50`, {
            headers: {
              'X-Shopify-Access-Token': 'valid-access-token',
              'Accept': 'application/json',
            },
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.products).toBeDefined();
          expect(Array.isArray(data.products)).toBe(true);
        });
    });
  });
});
