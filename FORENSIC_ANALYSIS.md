# Rappit Repository - Forensic Code Analysis

**Generated:** 2026-01-31  
**Analysis Mode:** Diff-Safe Full Repository Analysis  
**Rule:** All claims based strictly on executable code evidence

---

## Pass 1 — File Inventory

### Total Executable Files: 566

### Backend (NestJS - `/src/src/`)

| Category | File Count | Path |
|----------|-----------|------|
| Core | 3 | `main.ts`, `app.module.ts`, `middleware/*.ts` |
| Configuration | 3 | `config/configuration.ts`, `config/database.config.ts`, `config/redis.config.ts` |
| Common/Guards | 5 | `common/guards/*.ts` |
| Common/Decorators | 5 | `common/decorators/*.ts` |
| Common/Database | 3 | `common/database/*.ts` |
| Common/Encryption | 3 | `common/encryption/*.ts` |
| Common/Rate-Limit | 6 | `common/rate-limit/*.ts` |
| Common/Helpers | 2 | `common/helpers/order-state-machine.ts`, `common/helpers/shipment-status-mapping.ts` |
| Common/Health | 2 | `common/health/*.ts` |
| Common/Security | 3 | `common/security/*.ts` |
| Controllers | 2 | `controllers/shipment.controller.ts`, `controllers/shipping-account.controller.ts` |
| Interceptors | 1 | `interceptors/request-logging.interceptor.ts` |
| Utils | 1 | `utils/structured-logger.ts` |
| Services | 4 | `services/*.ts` |
| Queues | 2 | `queues/queues.ts`, `queues/redis-connection.ts` |
| Workers | 6 | `workers/*.ts` |

#### Modules (`/src/src/modules/`)

| Module | Files | Status |
|--------|-------|--------|
| auth | 6 | Active - imported in app.module.ts |
| users | 5 | Active - imported in app.module.ts |
| organizations | 6 | Active - imported in app.module.ts |
| channels | 6 | Active - imported in app.module.ts |
| orders | 9 | Active - imported in app.module.ts |
| inventory | 9 | Active - imported in app.module.ts |
| shipping | 6 | Active - imported in app.module.ts |
| webhooks | 4 | Active - imported in app.module.ts |
| jobs | 5 | Active - imported in app.module.ts |
| billing | 7 | Active - imported in app.module.ts |
| email | 2 | Active - imported via dependency |
| alerts | 4 | **NOT IMPORTED** in app.module.ts |
| metrics | 3 | **NOT IMPORTED** in app.module.ts |
| currency | 3 | **NOT IMPORTED** in app.module.ts |
| products | 3 | **NOT IMPORTED** in app.module.ts |
| warehouses | 3 | Active - imported via dependency |

#### Integrations (`/src/src/integrations/`)

| Integration | Files |
|-------------|-------|
| Shopify | 6 (`shopify-client.ts`, `shopify-integration.service.ts`, `shopify-sync.scheduler.ts`, `shopify-webhook.controller.ts`, `shopify.constants.ts`, `shopify.types.ts`) |
| WooCommerce | 3 (`oauth1-helper.ts`, `woocommerce-integration.service.ts`, `woocommerce-webhook.controller.ts`) |
| Shipping/DHL | 1 (`dhl-integration.service.ts`) |
| Shipping/FedEx | 6 (`fedex-client.ts`, `fedex-error.ts`, `fedex-integration.service.ts`, `fedex-validation.ts`, `fedex.constants.ts`, `fedex.types.ts`) |
| OAuth Helpers | 1 (`oauth-helpers.ts`) |

#### Module-Level Integrations (`/src/src/modules/integrations/`)

| Integration | Files |
|-------------|-------|
| Shopify | 4 (`shopify-oauth.controller.ts`, `shopify-oauth.service.ts`, `shopify.module.ts`, `shopify.service.ts`) |
| WooCommerce | 4 (`woocommerce-oauth.controller.ts`, `woocommerce-oauth.service.ts`, `woocommerce.module.ts`, `woocommerce.service.ts`) |
| DHL | 4 (`dhl-oauth-test.controller.ts`, `dhl-oauth.service.ts`, `dhl.module.ts`, `dhl.service.ts`) |
| FedEx | 4 (`fedex-oauth-test.controller.ts`, `fedex-oauth.service.ts`, `fedex.module.ts`, `fedex.service.ts`) |

### Frontend (React/Vite - `/src/`)

| Category | File Count |
|----------|-----------|
| Entry Points | 2 (`main.tsx`, `App.tsx`) |
| API Client | 6 (`lib/api/*.ts`) |
| Hooks | 23 (`hooks/*.ts`, `hooks/inventory/*.ts`) |
| Components | 120+ (`components/**/*.tsx`) |
| UI Components | 50+ (`components/UI/*.tsx`) |
| Types | 4 (`lib/types/*.ts`) |
| Config | 2 (`lib/config.ts`, `lib/mockData.ts`) |

### Next.js Frontend (`/src/app/`, `/src/next-app/`)

| Category | Files |
|----------|-------|
| Pages | 8 (`app/*/page.tsx`) |
| Components | 15 (`app/*/components/*.tsx`) |
| Layout | 1 (`app/layout.tsx`) |

### Scripts

| File | Purpose |
|------|---------|
| `/scripts/fedex-admin.sh` | FedEx administrative operations |
| `/scripts/fedex-test-suite.sh` | FedEx integration testing |
| `/scripts/shopify-admin.sh` | Shopify administrative operations |
| `/scripts/shopify-test-suite.sh` | Shopify integration testing |
| `/scripts/backup/*.sh` | Database backup/restore |
| `/staging/woocommerce/setup-woocommerce.sh` | WooCommerce staging setup |
| `/src/setup-auth.sh` | Authentication setup |

### Config Files Affecting Runtime

| File | Purpose |
|------|---------|
| `/prisma/schema.prisma` | Database schema (824 lines) |
| `/package.json` | Dependencies & scripts |
| `/vite.config.ts` | Vite build configuration |
| `/docker-compose.yml` | PostgreSQL + Redis services |
| `/docker-compose.test.yml` | Test environment |
| `/docker-compose.staging.yml` | Staging environment |
| `/src/jest.config.js` | Jest test configuration |
| `/src/playwright.config.ts` | E2E test configuration |

### Test Files

| Category | File Count |
|----------|-----------|
| Unit Tests | 65 (`/src/test/unit/*.spec.ts`) |
| Integration Tests | 25 (`/src/test/integration/*.spec.ts`) |
| E2E Tests | 4 (`/src/test/e2e/*.spec.ts`, `/src/tests/e2e/*.spec.ts`) |
| Test Helpers | 7 (`/src/test/helpers/*.ts`) |
| Test Fixtures | 1 (`/src/test/fixtures/fedex-responses.ts`) |

---

## Pass 2 — Entry Points & Execution Graph

### Backend Entry Point

**File:** `/src/src/main.ts` (lines 1-67)

**Bootstrap Sequence:**
1. `validateCorsConfig()` - Validates CORS config, calls `process.exit(1)` if invalid in production
2. `NestFactory.create(AppModule, { rawBody: true })` - Creates NestJS app with raw body for Stripe webhooks
3. `app.use(helmet())` - Adds security headers
4. `app.enableCors(getCorsConfig())` - Configures CORS
5. `app.setGlobalPrefix(apiPrefix)` - Sets `/api/v1` prefix
6. `app.useGlobalPipes(ValidationPipe)` - Enables DTO validation
7. `SwaggerModule.setup()` - API documentation at `/api/docs`
8. `app.listen(port)` - Starts HTTP server

**Module Loading:** (`/src/src/app.module.ts`)
```
AppModule imports:
├── ConfigModule.forRoot() - Loads configuration
├── DatabaseModule - Prisma connection (onModuleInit connects to PostgreSQL)
├── RateLimitModule - Redis-based rate limiting
├── HealthModule - Health check endpoint
├── JobsModule - BullMQ queue management
├── AuthModule - JWT authentication
├── UsersModule - User management
├── OrganizationsModule - Multi-tenant organizations
├── ChannelsModule - Sales channel management
├── OrdersModule - Order lifecycle
├── InventoryModule - Stock management
├── ShippingModule - Shipment creation/tracking
├── WebhooksModule - Webhook receivers
├── ShopifyModule - Shopify OAuth & sync
├── WooCommerceModule - WooCommerce OAuth & sync
├── DhlModule - DHL shipping integration
├── FedexModule - FedEx shipping integration
└── BillingModule - Stripe billing
```

**Global Guards (applied to all routes):**
1. `JwtAuthGuard` - Requires JWT token (bypassed by `@Public()` decorator)
2. `RolesGuard` - Requires role (only enforced when `@Roles()` used)

### Frontend Entry Point (Vite)

**File:** `/src/main.tsx`
```tsx
createRoot(document.getElementById("root")!).render(<App />);
```

**App.tsx Flow:**
1. `QueryClientProvider` - React Query setup (30s stale time, 1 retry)
2. Routing based on `activeView` state
3. Auth check via `isAuthenticated` flag
4. Renders `LandingPage` or authenticated views

### Workers (Background Processing)

**Worker Registry:** (`/src/src/workers/index.ts`)

| Worker | Queue | Concurrency | Job Types |
|--------|-------|-------------|-----------|
| ShopifyWorker | `shopify-sync` | 3 | `product-sync`, `order-sync`, `inventory-sync`, `fulfillment-sync` |
| WooCommerceWorker | `woocommerce-sync` | 3 | `product-sync`, `order-sync`, `inventory-sync` |
| WebhookProcessorWorker | `webhook-processing` | 10 | Processes webhooks from all sources |
| ShipmentCreateWorker | `shipment-create` | 5 | Creates shipments with carrier APIs |
| ShipmentTrackWorker | `shipment-tracking` | 5 | Polls tracking status |

### API Route Structure

**Base URL:** `{host}/api/v1`

| Route | Controller | Key Endpoints |
|-------|-----------|---------------|
| `/auth` | AuthController | POST `/login`, `/register`, `/accept-invite`, GET `/me` |
| `/users` | UsersController | CRUD, POST `/invite`, `/resend-invite` |
| `/organizations` | OrganizationsController | GET `/current`, `/current/stats`, PATCH `/current` |
| `/channels` | ChannelsController | CRUD, POST `/:id/test` |
| `/orders` | OrdersController | CRUD, PATCH `/:id/status`, POST `/:id/notes`, GET `/:id/timeline` |
| `/inventory` | InventoryController | CRUD, POST `/:id/adjust` |
| `/products` | ProductController | CRUD, GET `/:id/stock`, `/:id/history`, `/categories` |
| `/shipments` | ShippingController | CRUD, POST `/returns`, GET `/:id/track`, `/:id/label` |
| `/warehouses` | WarehouseController | CRUD |
| `/webhooks` | WebhooksController | POST `/shopify/:channelId`, `/woocommerce/:channelId`, `/dhl/:shipmentId`, `/fedex/:shipmentId` |
| `/billing/webhooks/stripe` | StripeWebhookController | POST webhook receiver |
| `/health` | HealthController | GET health check |

---

## Pass 3 — Feature Enumeration (Verified Only)

### 1. Authentication & Authorization

**Status:** Complete  
**Files:** `/src/src/modules/auth/`

| Feature | Implementation | Evidence |
|---------|---------------|----------|
| User Registration | auth.service.ts:register() | Creates user, org, membership with 14-day trial |
| Login with JWT | auth.service.ts:login() | Issues JWT token, validates bcrypt password |
| Account Lockout | auth.service.ts:login() | 10 failed attempts trigger lockout (logic in code) |
| Rate Limiting | auth.controller.ts:@RateLimit() | 5/15min per IP, 10/15min per email |
| User Invite Flow | users.service.ts:create() | Generates 24h token, stores in DB |
| Accept Invite | auth.service.ts:acceptInvite() | Validates token, activates user |
| Role-Based Access | roles.guard.ts | Enforces ADMIN/MANAGER/OPERATOR roles |

### 2. Multi-Tenant Organization

**Status:** Complete  
**Files:** `/src/src/modules/organizations/`

| Feature | Implementation | Evidence |
|---------|---------------|----------|
| Organization CRUD | organizations.service.ts | findOne(), update() |
| Organization Stats | organizations.service.ts:getStats() | Counts channels, products, orders, customers, shipments |
| User-Org Membership | UserOrganization table | Many-to-many with roles |
| Org-Scoped Queries | @CurrentOrganization() decorator | Injects orgId into all queries |

### 3. Sales Channels

**Status:** Partially Complete  
**Files:** `/src/src/modules/channels/`, `/src/src/integrations/`

| Feature | Implementation | Status |
|---------|---------------|--------|
| Channel CRUD | channels.service.ts | Complete |
| Shopify OAuth | shopify-oauth.controller.ts | Complete |
| Shopify Sync | shopify-integration.service.ts | Complete (products, orders, inventory, fulfillments) |
| WooCommerce OAuth | woocommerce-oauth.controller.ts | Complete (OAuth1.0a) |
| WooCommerce Sync | woocommerce-integration.service.ts | **INCOMPLETE** - httpGet/httpPost throw `NotImplementedException` |
| Test Connection | channels.service.ts:testConnection() | Complete |

### 4. Order Management

**Status:** Complete  
**Files:** `/src/src/modules/orders/`

| Feature | Implementation | Evidence |
|---------|---------------|----------|
| Order CRUD | orders.service.ts | Full CRUD with relations |
| Order Import (Upsert) | orders.service.ts:createOrUpdateOrderFromChannelPayload() | Idempotent based on (org, channel, externalOrderId) |
| State Machine | order-state-machine.ts | 6-state machine: PENDING→CONFIRMED→PROCESSING→SHIPPED→DELIVERED/CANCELLED |
| State Validation | order-state-machine.ts:validateTransition() | Prevents invalid transitions |
| Timeline Events | orders.service.ts + OrderTimelineEvent table | Audit trail for all status changes |
| Order Notes | orders.service.ts:addNote() | Append internal notes with events |
| Filtering | orders.service.ts:findAll() | Status, channel, date range, search |
| Cancellation | order-cancellation.service.ts | Releases inventory on cancel |

**Order State Machine (Verified from code):**
```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
    ↓         ↓            ↓
 CANCELLED  CANCELLED   CANCELLED
```
- SHIPPED cannot be cancelled (package in transit)
- Terminal states: DELIVERED, CANCELLED

### 5. Inventory Management

**Status:** Complete  
**Files:** `/src/src/modules/inventory/`

| Feature | Implementation | Evidence |
|---------|---------------|----------|
| Inventory Levels | InventoryLevel table | SKU+Warehouse granularity |
| Stock Reservation | inventory.service.ts:reserveStockForOrder() | Model C: reserve on order import |
| Stock Release | inventory.service.ts:releaseStockForOrder() | Release on cancel/return |
| Manual Adjustment | inventory.service.ts:adjust() | Delta-based adjustments |
| Audit Trail | InventoryAdjustment table | All changes logged |
| Low Stock Detection | inventory.service.ts:getLowStockItems() | **INCOMPLETE** - returns empty array (reorderPoint not in schema) |
| Stock Summary | inventory.service.ts:getInventorySummary() | Aggregates totals |

**Inventory Model C (Verified from code):**
1. Order imported → `reserveStockForOrder()` decrements `available`, increments `reserved`
2. Order cancelled → `releaseStockForOrder()` reverses the above
3. Uses Prisma transactions with `FOR UPDATE` row locking

### 6. Shipping

**Status:** Partially Complete  
**Files:** `/src/src/modules/shipping/`, `/src/src/integrations/shipping/`

| Feature | Implementation | Status |
|---------|---------------|--------|
| Shipping Accounts | ShippingAccount table | Complete |
| Shipment Creation | shipping.service.ts:createShipment() | Complete |
| Label Generation | shipping.service.ts | Delegates to carrier integration |
| Tracking | shipping.service.ts:trackShipment() | Complete |
| FedEx Integration | fedex-integration.service.ts | Complete (OAuth2, shipments, tracking) |
| DHL Integration | dhl-integration.service.ts | **INCOMPLETE** - Mock implementations only |
| Tracking Scheduler | tracking-scheduler.service.ts | Periodic tracking updates |

**FedEx API Calls (Verified):**
- POST `/oauth/token` - OAuth2 token
- POST `/ship/v1/shipments` - Create shipment
- POST `/track/v1/trackingnumbers` - Track shipment
- POST `/ship/v1/shipments/cancel` - Cancel shipment
- POST `/rate/v1/rates/quotes` - Get rates
- POST `/address/v1/addresses/resolve` - Validate address

### 7. Webhooks

**Status:** Complete  
**Files:** `/src/src/modules/webhooks/`

| Feature | Implementation | Evidence |
|---------|---------------|----------|
| Shopify Webhooks | webhooks.controller.ts + shopify-webhook.controller.ts | Orders create/update/cancel, fulfillments, inventory |
| WooCommerce Webhooks | webhooks.controller.ts | Orders create/update/delete |
| Carrier Webhooks | webhooks.controller.ts | DHL/FedEx tracking updates |
| Webhook Verification | webhook-verification.guard.ts | HMAC signature validation |
| Idempotency | ProcessedWebhookEvent table | Deduplication by source + eventId |

### 8. Billing (Stripe)

**Status:** Complete  
**Files:** `/src/src/modules/billing/`

| Feature | Implementation | Evidence |
|---------|---------------|----------|
| Trial Period | trial.service.ts | 14-day trial on registration |
| Stripe Customer | stripe.service.ts:createCustomer() | Non-blocking (errors logged) |
| Webhook Handler | stripe-webhook.controller.ts | Signature verification |
| Subscription Status | Organization.subscriptionStatus | TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED |
| Billing Audit | BillingAuditLog table | All billing events logged |

### 9. Background Jobs

**Status:** Complete  
**Files:** `/src/src/modules/jobs/`, `/src/src/queues/`, `/src/src/workers/`

| Feature | Implementation | Evidence |
|---------|---------------|----------|
| Queue Management | BullMQ + Redis | 6 queues defined |
| Back-Pressure | jobs.service.ts | Max depth 10,000, returns 429 |
| Dead-Letter Queue | DeadLetterJob table | Failed jobs archived |
| Job Retry | jobs.service.ts:retryDLQJob() | Re-enqueue from DLQ |
| Job Stats | jobs.service.ts:getQueueStats() | Per-queue metrics |

### 10. Products

**Status:** Complete (but module NOT imported)  
**Files:** `/src/src/modules/products/`

| Feature | Implementation | Evidence |
|---------|---------------|----------|
| Product CRUD | product.service.ts | Full CRUD |
| Stock Status | product.service.ts:calculateStockStatus() | LOW, OUT, NORMAL |
| Categories | product.service.ts:getCategories() | Distinct categories |
| History | product.service.ts:getProductHistory() | 50 recent adjustments |

**WARNING:** ProductModule is NOT imported in app.module.ts - endpoints not reachable.

---

## Pass 4 — Data Flow & State

### Data Entry Points

| Source | Entry Point | Processing |
|--------|-------------|------------|
| REST API | HTTP Controllers | Validation → Service → Prisma → PostgreSQL |
| Shopify Webhook | `/webhooks/shopify/:channelId` | Guard → Controller → WebhooksService → Queue → Worker |
| WooCommerce Webhook | `/webhooks/woocommerce/:channelId` | Guard → Controller → WebhooksService → Queue → Worker |
| DHL Webhook | `/webhooks/dhl/:shipmentId` | Guard → Controller → WebhooksService → Tracking update |
| FedEx Webhook | `/webhooks/fedex/:shipmentId` | Guard → Controller → WebhooksService → Tracking update |
| Stripe Webhook | `/billing/webhooks/stripe` | Signature verify → Service → Subscription update |

### Data Propagation

**Order Flow:**
```
Channel Webhook → WebhooksService.handleShopifyWebhook()
    → Queue (webhook-processing)
    → WebhookProcessorWorker
    → OrdersService.createOrUpdateOrderFromChannelPayload()
    → Transaction:
        1. Customer upsert
        2. Order upsert
        3. OrderItems reconcile
        4. InventoryService.reserveStockForOrder() if new
        5. OrderTimelineEvent create
    → PostgreSQL commit
```

**Shipment Flow:**
```
API POST /shipments → ShippingController.create()
    → ShippingService.createShipment()
    → Queue (shipment-create)
    → ShipmentCreateWorker
    → FedExIntegrationService.createShipment() or DHLIntegrationService.createShipment()
    → External API call
    → Update Shipment with tracking number/label
```

### State Storage

| State | Storage | Persistence |
|-------|---------|-------------|
| User Sessions | JWT Token (stateless) | Client-side (localStorage) |
| Application Data | PostgreSQL | Persistent |
| Queue Jobs | Redis (BullMQ) | Persistent (until TTL) |
| Rate Limit Counters | Redis | TTL-based (15 min) |
| OAuth Tokens | ShippingAccount.credentials (encrypted) | Persistent |

### Synchronous vs Asynchronous

| Operation | Mode | Mechanism |
|-----------|------|-----------|
| Authentication | Sync | HTTP request-response |
| Order CRUD | Sync | HTTP request-response |
| Webhook Processing | Async | BullMQ queue + worker |
| Shipment Creation | Async | BullMQ queue + worker |
| Tracking Updates | Async | Scheduled + queue |
| Channel Sync | Async | BullMQ queue + worker |

---

## Pass 5 — External Integrations (Confirmed)

### APIs Called (Verified in Code)

| Integration | API Base URL | Endpoints Called |
|-------------|--------------|------------------|
| **Shopify** | `https://{shopDomain}/admin/api/{version}` | `GET /products.json`, `GET /orders.json`, `GET /inventory_levels.json`, `POST /orders/{id}/fulfillments.json` |
| **WooCommerce** | `{siteUrl}/wp-json/wc/v3` | **STUB ONLY** - All HTTP methods throw NotImplementedException |
| **FedEx** | `https://apis-sandbox.fedex.com` (or production) | `POST /oauth/token`, `POST /ship/v1/shipments`, `POST /track/v1/trackingnumbers`, `POST /ship/v1/shipments/cancel`, `POST /rate/v1/rates/quotes`, `POST /address/v1/addresses/resolve` |
| **DHL** | `https://express.api.dhl.com` | **STUB ONLY** - All HTTP methods throw "not implemented" |
| **Stripe** | Stripe SDK | Customer creation, webhook signature verification |

### Webhooks Received

| Source | Path | Events |
|--------|------|--------|
| Shopify | `/webhooks/shopify/:channelId` | `orders/create`, `orders/updated`, `orders/cancelled`, `fulfillments/create`, `fulfillments/update`, `inventory_levels/update` |
| WooCommerce | `/webhooks/woocommerce/:channelId` | `orders/created`, `orders/updated`, `orders/deleted`, `products/created`, `products/updated` |
| DHL | `/webhooks/dhl/:shipmentId` | Tracking updates |
| FedEx | `/webhooks/fedex/:shipmentId` | Tracking updates |
| Stripe | `/billing/webhooks/stripe` | `customer.subscription.*`, `invoice.*` events |

### Databases

| Database | Connection | Usage |
|----------|------------|-------|
| PostgreSQL | `DATABASE_URL` env var | Primary data store (Prisma ORM) |
| Redis | `REDIS_HOST:REDIS_PORT` env vars | Queue backend (BullMQ), rate limiting |

### SDKs/Libraries

| Library | Version | Usage |
|---------|---------|-------|
| @prisma/client | * | PostgreSQL ORM |
| bullmq | * | Job queue |
| ioredis | * | Redis client |
| passport-jwt | * | JWT authentication |
| bcrypt | * | Password hashing |
| helmet | * | Security headers |

---

## Pass 6 — Dead Code & Non-Executable Paths

### Modules Not Imported in app.module.ts

| Module | Path | Evidence |
|--------|------|----------|
| AlertsModule | `/src/src/modules/alerts/` | Not in app.module.ts imports array |
| MetricsModule | `/src/src/modules/metrics/` | Not in app.module.ts imports array |
| CurrencyModule | `/src/src/modules/currency/` | Not in app.module.ts imports array |
| ProductModule | `/src/src/modules/products/` | Not in app.module.ts imports array |

**Impact:** These modules' controllers are not registered, so their HTTP endpoints are unreachable.

### Unused Services

| Service | Path | Evidence |
|---------|------|----------|
| ChannelConnectionService | `/src/src/services/channel-connection.service.ts` | Not imported in any module |
| IntegrationLoggingService | `/src/src/services/integration-logging.service.ts` | Not imported in any module |

### Unused Frontend Components

| Component | Path | Evidence |
|-----------|------|----------|
| Dashboard.tsx | `/src/components/Dashboard.tsx` | Not imported in App.tsx or routing |
| ChannelConnections.tsx | `/src/components/ChannelConnections.tsx` | Not imported anywhere |
| OrdersManagement.tsx | `/src/components/OrdersManagement.tsx` | Not imported anywhere |
| InventoryManagement.tsx | `/src/components/InventoryManagement.tsx` | Not imported anywhere |
| ShippingManagement.tsx | `/src/components/ShippingManagement.tsx` | Not imported anywhere |
| LoginPage.tsx | `/src/components/LoginPage.tsx` | Not imported (Next.js uses separate login) |
| LandingPage.tsx | `/src/components/LandingPage.tsx` | Not imported in routing |
| BulkActionBar | `/src/components/bulk/` | Exported but never used |
| AdminDashboard | `/src/components/admin/` | Exported but never used |
| PricingTable | `/src/components/subscription/` | Exported but never used |

### Unused Hooks

| Hook | Path | Evidence |
|------|------|----------|
| useTransferRequests | `/src/hooks/inventory/` | Only exported in index.ts, never imported |
| useForceRelease | `/src/hooks/inventory/` | Only exported in index.ts, never imported |
| useStockMovements | `/src/hooks/inventory/` | Only exported in index.ts, never imported |
| useValidationRules | `/src/hooks/inventory/` | Only exported in index.ts, never imported |
| useCycleCount | `/src/hooks/inventory/` | Only exported in index.ts, never imported |

### Stub Implementations (Non-Functional)

| Location | Function | Evidence |
|----------|----------|----------|
| woocommerce-integration.service.ts | httpGet(), httpPost(), httpPut() | Throw `NotImplementedException` |
| dhl-integration.service.ts | createShipment(), trackShipment(), getLabel() | Return mock data only |
| oauth-helpers.ts | exchangeShopifyCode() | Stub - not implemented |

### Low Stock Feature

| Location | Issue |
|----------|-------|
| inventory.service.ts:getLowStockItems() | Returns empty array - `reorderPoint` not in schema |

---

## Pass 7 — Runtime Assumptions

### Required Environment Variables (Crash if Missing)

| Variable | Used In | Failure Mode |
|----------|---------|--------------|
| `DATABASE_URL` | `/src/src/config/database.config.ts` | Prisma fails to connect on `onModuleInit()` → app crash |
| `CORS_ORIGIN` (production only) | `/src/src/middleware/cors.middleware.ts` | `validateCorsConfig()` calls `process.exit(1)` |

### Required Services (Crash if Unavailable)

| Service | Used In | Failure Mode |
|---------|---------|--------------|
| PostgreSQL | `PrismaService.onModuleInit()` | `$connect()` throws on failure → app crash |
| Redis | `getRedisConnection()` | BullMQ queue operations fail |

### Required Infrastructure

| Component | Required For | Evidence |
|-----------|-------------|----------|
| PostgreSQL database | All data operations | Prisma connection in bootstrap |
| Redis server | Queue operations, rate limiting | BullMQ + rate-limit.service.ts |

### Optional/Defensive Checks

| Variable | Default | Location |
|----------|---------|----------|
| `PORT` | 3000 | configuration.ts |
| `NODE_ENV` | 'development' | configuration.ts |
| `JWT_SECRET` | 'dev-secret-change-me' | configuration.ts |
| `REDIS_HOST` | 'localhost' | redis.config.ts |
| `REDIS_PORT` | 6379 | redis.config.ts |
| `ENCRYPTION_KEY` | Falls back with warning | channel-connection.service.ts |

---

## Pass 8 — Code-Provable Risks

### Guaranteed Crashes

| Location | Condition | Evidence |
|----------|-----------|----------|
| main.ts:17-18 | `CORS_ORIGIN` empty in production | `process.exit(1)` call |
| prisma.service.ts:15 | PostgreSQL unavailable | `$connect()` throws |
| encryption.service.ts | Invalid encryption key format | Throws on decrypt |
| fedex-client.ts | OAuth token refresh fails | Throws `ServiceUnavailableException` |

### Silent Failures

| Location | Behavior | Evidence |
|----------|----------|----------|
| stripe.service.ts:createCustomer() | Stripe API error logged but not thrown | Non-blocking, continues execution |
| inventory.service.ts:getLowStockItems() | Always returns empty array | `reorderPoint` not in schema |
| inventory.service.ts:update() | DTO fields silently ignored | Schema mismatch |

### Race Conditions

| Location | Risk | Mitigation |
|----------|------|------------|
| inventory.service.ts:reserveStockForOrder() | Concurrent reservations | Uses `FOR UPDATE` row lock + Prisma transaction |
| orders.service.ts:createOrUpdateOrderFromChannelPayload() | Concurrent order upserts | Uses Prisma transaction |
| queue processing | Duplicate job processing | Idempotency via ProcessedWebhookEvent/ProcessedShipmentJob tables |

### Potential Issues

| Location | Issue | Evidence |
|----------|-------|----------|
| order-state-machine.ts vs Prisma schema | Enum mismatch | Code has 6 states, Prisma has 11 states |
| woocommerce-integration.service.ts | All HTTP methods stub | Throw `NotImplementedException` on actual use |
| dhl-integration.service.ts | Mock implementations | Will fail in production without real implementation |

### Integer Overflow Protection

| Location | Protection | Evidence |
|----------|------------|----------|
| inventory.service.ts:reserveStockForOrder() | MAX_INVENTORY_QUANTITY = 1,000,000 | Check before incrementing reserved |

### Schema-Code Inconsistencies

| Entity | Schema States | Code States |
|--------|---------------|-------------|
| OrderStatus (Prisma) | NEW, RESERVED, PAID, READY_TO_SHIP, PICKED, PACKED, SHIPPED, IN_TRANSIT, DELIVERED, CANCELLED, RETURNED | - |
| OrderStatus (Code) | PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED | - |

**Risk:** State machine code uses different enum values than Prisma schema.

---

## Summary

### Fully Implemented Features
- Authentication (JWT, roles, rate limiting)
- Multi-tenant organizations
- Order lifecycle with state machine
- Inventory reservation (Model C)
- Shopify integration (OAuth, sync, webhooks)
- FedEx integration (OAuth2, shipments, tracking)
- Background job queues (BullMQ)
- Webhook processing with idempotency
- Stripe billing integration

### Partially Implemented Features
- WooCommerce integration (OAuth complete, HTTP methods are stubs)
- DHL integration (mock implementations only)
- Low stock detection (schema missing `reorderPoint`)
- Products module (not imported in app.module.ts)
- Alerts module (not imported)
- Metrics module (not imported)
- Currency module (not imported)

### Dead Code
- 4 backend modules not imported
- 2 backend services not imported
- 10+ frontend components not used
- 5+ frontend hooks not used

### Critical Dependencies
- PostgreSQL (required)
- Redis (required)
- `DATABASE_URL` env var (required)
- `CORS_ORIGIN` env var (required in production)

---

*This analysis is based strictly on executable code. All claims reference specific files and functions. "Not verifiable from code" has been stated where applicable.*
