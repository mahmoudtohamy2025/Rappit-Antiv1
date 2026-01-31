/**
 * WooCommerce REST API Contract Tests
 * 
 * Uses Pact to verify API contract compatibility with WooCommerce.
 * These tests ensure our integration remains compatible with WooCommerce's REST API.
 * 
 * @packageDocumentation
 */

import { PactV4, LogLevel, MatchersV3 } from '@pact-foundation/pact';
import * as path from 'path';

const { like, eachLike, datetime, string, integer, boolean, number } = MatchersV3;

describe('WooCommerce REST API Contract', () => {
  // Create pact provider
  const provider = new PactV4({
    consumer: 'Rappit',
    provider: 'WooCommerceREST',
    dir: path.resolve(process.cwd(), 'pacts'),
    logLevel: (process.env.PACT_LOG_LEVEL as LogLevel) || 'warn',
  });

  describe('GET /wp-json/wc/v3/system_status', () => {
    it('returns system status for valid credentials', async () => {
      await provider
        .addInteraction()
        .given('valid WooCommerce API credentials')
        .uponReceiving('a request for system status')
        .withRequest('GET', '/wp-json/wc/v3/system_status', (builder) => {
          builder.headers({
            'Authorization': like('Basic dXNlcjpwYXNz'),
            'Accept': 'application/json',
          });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json; charset=UTF-8' })
            .jsonBody({
              environment: {
                home_url: string('https://example.com'),
                site_url: string('https://example.com'),
                version: string('8.3.0'),
                log_directory: string('/var/www/html/wp-content/uploads/wc-logs/'),
                log_directory_writable: boolean(true),
                wp_version: string('6.4.2'),
                wp_multisite: boolean(false),
                wp_memory_limit: integer(268435456),
                wp_debug_mode: boolean(false),
                wp_cron: boolean(true),
                language: string('en_US'),
                external_object_cache: like(null),
                server_info: string('Apache/2.4.57'),
                php_version: string('8.1.25'),
                php_post_max_size: integer(8388608),
                php_max_execution_time: integer(300),
                php_max_input_vars: integer(1000),
                curl_version: string('7.81.0'),
                suhosin_installed: boolean(false),
                max_upload_size: integer(8388608),
                mysql_version: string('8.0.35'),
                mysql_version_string: string('8.0.35-0ubuntu0.22.04.1'),
                default_timezone: string('UTC'),
                fsockopen_or_curl_enabled: boolean(true),
                soapclient_enabled: boolean(true),
                domdocument_enabled: boolean(true),
                gzip_enabled: boolean(true),
                mbstring_enabled: boolean(true),
                remote_post_successful: boolean(true),
                remote_post_response: string('200'),
                remote_get_successful: boolean(true),
                remote_get_response: string('200'),
              },
              database: {
                wc_database_version: string('8.3.0'),
                database_prefix: string('wp_'),
                database_tables: like({}),
                database_size: like({
                  data: number(10.5),
                  index: number(5.2),
                }),
              },
              active_plugins: eachLike({
                plugin: string('woocommerce/woocommerce.php'),
                name: string('WooCommerce'),
                version: string('8.3.0'),
                version_latest: string('8.3.0'),
                url: string('https://woocommerce.com/'),
                author_name: string('Automattic'),
                author_url: string('https://woocommerce.com/'),
                network_activated: boolean(false),
              }),
              theme: {
                name: string('Storefront'),
                version: string('4.4.0'),
                version_latest: string('4.4.0'),
                author_url: string('https://woocommerce.com/'),
                is_child_theme: boolean(false),
                has_woocommerce_support: boolean(true),
                has_woocommerce_file: boolean(true),
                has_outdated_templates: boolean(false),
                overrides: like([]),
                parent_name: string(''),
                parent_version: string(''),
                parent_author_url: string(''),
              },
              settings: {
                api_enabled: boolean(true),
                force_ssl: boolean(false),
                currency: string('SAR'),
                currency_symbol: string('SAR'),
                currency_position: string('left'),
                thousand_separator: string(','),
                decimal_separator: string('.'),
                number_of_decimals: integer(2),
                geolocation_enabled: boolean(false),
                taxonomies: like({}),
                product_visibility_terms: like([]),
              },
              security: {
                secure_connection: boolean(true),
                hide_errors: boolean(true),
              },
              pages: eachLike({
                page_name: string('Shop base'),
                page_id: string('5'),
                page_set: boolean(true),
                page_exists: boolean(true),
                page_visible: boolean(true),
                shortcode: string('[products]'),
                shortcode_required: boolean(true),
                shortcode_present: boolean(true),
              }),
            });
        })
        .executeTest(async (mockServer) => {
          const authString = Buffer.from('user:pass').toString('base64');
          const response = await fetch(`${mockServer.url}/wp-json/wc/v3/system_status`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json',
            },
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.environment).toBeDefined();
          expect(data.environment.version).toBeDefined();
        });
    });

    it('returns 401 for invalid credentials', async () => {
      await provider
        .addInteraction()
        .given('invalid WooCommerce API credentials')
        .uponReceiving('a request with invalid credentials')
        .withRequest('GET', '/wp-json/wc/v3/system_status', (builder) => {
          builder.headers({
            'Authorization': like('Basic aW52YWxpZDppbnZhbGlk'),
            'Accept': 'application/json',
          });
        })
        .willRespondWith(401, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json; charset=UTF-8' })
            .jsonBody({
              code: string('woocommerce_rest_cannot_view'),
              message: string('Sorry, you cannot view this resource.'),
              data: {
                status: integer(401),
              },
            });
        })
        .executeTest(async (mockServer) => {
          const authString = Buffer.from('invalid:invalid').toString('base64');
          const response = await fetch(`${mockServer.url}/wp-json/wc/v3/system_status`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json',
            },
          });

          expect(response.status).toBe(401);
        });
    });
  });

  describe('GET /wp-json/wc/v3/orders', () => {
    it('returns orders list for valid credentials', async () => {
      await provider
        .addInteraction()
        .given('valid WooCommerce API credentials and orders exist')
        .uponReceiving('a request for orders list')
        .withRequest('GET', '/wp-json/wc/v3/orders', (builder) => {
          builder
            .headers({
              'Authorization': like('Basic dXNlcjpwYXNz'),
              'Accept': 'application/json',
            })
            .query({ per_page: '50' });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({
              'Content-Type': 'application/json; charset=UTF-8',
              'X-WP-Total': string('100'),
              'X-WP-TotalPages': string('2'),
            })
            .jsonBody(
              eachLike({
                id: integer(12345),
                parent_id: integer(0),
                status: string('processing'),
                currency: string('SAR'),
                version: string('8.3.0'),
                prices_include_tax: boolean(false),
                date_created: string('2024-01-15T10:00:00'),
                date_created_gmt: string('2024-01-15T07:00:00'),
                date_modified: string('2024-01-15T10:30:00'),
                date_modified_gmt: string('2024-01-15T07:30:00'),
                discount_total: string('0.00'),
                discount_tax: string('0.00'),
                shipping_total: string('10.00'),
                shipping_tax: string('0.00'),
                cart_tax: string('0.00'),
                total: string('100.00'),
                total_tax: string('0.00'),
                customer_id: integer(1),
                order_key: string('wc_order_abc123'),
                billing: {
                  first_name: string('John'),
                  last_name: string('Doe'),
                  company: string(''),
                  address_1: string('123 Main St'),
                  address_2: string(''),
                  city: string('Riyadh'),
                  state: string(''),
                  postcode: string('12345'),
                  country: string('SA'),
                  email: string('customer@example.com'),
                  phone: string('+966500000000'),
                },
                shipping: {
                  first_name: string('John'),
                  last_name: string('Doe'),
                  company: string(''),
                  address_1: string('123 Main St'),
                  address_2: string(''),
                  city: string('Riyadh'),
                  state: string(''),
                  postcode: string('12345'),
                  country: string('SA'),
                  phone: string('+966500000000'),
                },
                payment_method: string('cod'),
                payment_method_title: string('Cash on delivery'),
                transaction_id: string(''),
                customer_ip_address: string('192.168.1.1'),
                customer_user_agent: string('Mozilla/5.0'),
                created_via: string('checkout'),
                customer_note: string(''),
                date_completed: like(null),
                date_paid: like(null),
                cart_hash: string('abc123'),
                number: string('12345'),
                meta_data: like([]),
                line_items: eachLike({
                  id: integer(1),
                  name: string('Test Product'),
                  product_id: integer(100),
                  variation_id: integer(0),
                  quantity: integer(1),
                  tax_class: string(''),
                  subtotal: string('90.00'),
                  subtotal_tax: string('0.00'),
                  total: string('90.00'),
                  total_tax: string('0.00'),
                  taxes: like([]),
                  meta_data: like([]),
                  sku: string('TEST-SKU-001'),
                  price: number(90),
                  image: like({
                    id: integer(0),
                    src: string(''),
                  }),
                  parent_name: like(null),
                }),
                tax_lines: like([]),
                shipping_lines: eachLike({
                  id: integer(1),
                  method_title: string('Flat rate'),
                  method_id: string('flat_rate'),
                  instance_id: string('1'),
                  total: string('10.00'),
                  total_tax: string('0.00'),
                  taxes: like([]),
                  meta_data: like([]),
                }),
                fee_lines: like([]),
                coupon_lines: like([]),
                refunds: like([]),
                payment_url: string('https://example.com/checkout/order-pay/12345'),
                is_editable: boolean(false),
                needs_payment: boolean(false),
                needs_processing: boolean(true),
                date_created_gmt: string('2024-01-15T07:00:00'),
                date_modified_gmt: string('2024-01-15T07:30:00'),
                date_completed_gmt: like(null),
                date_paid_gmt: like(null),
                currency_symbol: string('SAR'),
                _links: like({
                  self: eachLike({ href: string('https://example.com/wp-json/wc/v3/orders/12345') }),
                  collection: eachLike({ href: string('https://example.com/wp-json/wc/v3/orders') }),
                }),
              }),
            );
        })
        .executeTest(async (mockServer) => {
          const authString = Buffer.from('user:pass').toString('base64');
          const response = await fetch(`${mockServer.url}/wp-json/wc/v3/orders?per_page=50`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json',
            },
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(Array.isArray(data)).toBe(true);
        });
    });
  });

  describe('GET /wp-json/wc/v3/products', () => {
    it('returns products list for valid credentials', async () => {
      await provider
        .addInteraction()
        .given('valid WooCommerce API credentials and products exist')
        .uponReceiving('a request for products list')
        .withRequest('GET', '/wp-json/wc/v3/products', (builder) => {
          builder
            .headers({
              'Authorization': like('Basic dXNlcjpwYXNz'),
              'Accept': 'application/json',
            })
            .query({ per_page: '50' });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({
              'Content-Type': 'application/json; charset=UTF-8',
              'X-WP-Total': string('50'),
              'X-WP-TotalPages': string('1'),
            })
            .jsonBody(
              eachLike({
                id: integer(100),
                name: string('Test Product'),
                slug: string('test-product'),
                permalink: string('https://example.com/product/test-product'),
                date_created: string('2024-01-01T10:00:00'),
                date_created_gmt: string('2024-01-01T07:00:00'),
                date_modified: string('2024-01-15T10:00:00'),
                date_modified_gmt: string('2024-01-15T07:00:00'),
                type: string('simple'),
                status: string('publish'),
                featured: boolean(false),
                catalog_visibility: string('visible'),
                description: string('<p>Product description</p>'),
                short_description: string('Short description'),
                sku: string('TEST-SKU-001'),
                price: string('100.00'),
                regular_price: string('100.00'),
                sale_price: string(''),
                date_on_sale_from: like(null),
                date_on_sale_from_gmt: like(null),
                date_on_sale_to: like(null),
                date_on_sale_to_gmt: like(null),
                on_sale: boolean(false),
                purchasable: boolean(true),
                total_sales: integer(10),
                virtual: boolean(false),
                downloadable: boolean(false),
                downloads: like([]),
                download_limit: integer(-1),
                download_expiry: integer(-1),
                external_url: string(''),
                button_text: string(''),
                tax_status: string('taxable'),
                tax_class: string(''),
                manage_stock: boolean(true),
                stock_quantity: integer(100),
                backorders: string('no'),
                backorders_allowed: boolean(false),
                backordered: boolean(false),
                low_stock_amount: like(null),
                sold_individually: boolean(false),
                weight: string('1'),
                dimensions: {
                  length: string('10'),
                  width: string('10'),
                  height: string('10'),
                },
                shipping_required: boolean(true),
                shipping_taxable: boolean(true),
                shipping_class: string(''),
                shipping_class_id: integer(0),
                reviews_allowed: boolean(true),
                average_rating: string('0.00'),
                rating_count: integer(0),
                upsell_ids: like([]),
                cross_sell_ids: like([]),
                parent_id: integer(0),
                purchase_note: string(''),
                categories: eachLike({
                  id: integer(1),
                  name: string('Uncategorized'),
                  slug: string('uncategorized'),
                }),
                tags: like([]),
                images: like([]),
                attributes: like([]),
                default_attributes: like([]),
                variations: like([]),
                grouped_products: like([]),
                menu_order: integer(0),
                price_html: string('<span class="woocommerce-Price-amount amount"><bdi>SAR&nbsp;<span class="woocommerce-Price-currencySymbol">SAR</span>100.00</bdi></span>'),
                related_ids: like([]),
                meta_data: like([]),
                stock_status: string('instock'),
                has_options: boolean(false),
                _links: like({
                  self: eachLike({ href: string('https://example.com/wp-json/wc/v3/products/100') }),
                  collection: eachLike({ href: string('https://example.com/wp-json/wc/v3/products') }),
                }),
              }),
            );
        })
        .executeTest(async (mockServer) => {
          const authString = Buffer.from('user:pass').toString('base64');
          const response = await fetch(`${mockServer.url}/wp-json/wc/v3/products?per_page=50`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json',
            },
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(Array.isArray(data)).toBe(true);
        });
    });
  });
});
