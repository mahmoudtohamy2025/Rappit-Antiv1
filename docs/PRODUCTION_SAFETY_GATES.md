# Production Safety Gates

This document outlines the critical safety gates that must be verified before deploying to production.

## 🚦 Gate Status Overview

| Gate ID | Name | Type | Status | Required For |
|---------|------|------|--------|--------------|
| GATE-001 | Prisma Client Generation | NO-GO | ✅ RESOLVED | Production |
| GATE-002 | Carrier API Stubs | NO-GO | ⚠️ REQUIRES CONFIG | Production |
| GATE-003 | Multi-Tenant Isolation | NO-GO | ✅ VERIFIED | Production |
| GATE-004 | OAuth Stubs for Staging | CONDITIONAL | ✅ IMPLEMENTED | Staging OK |
| GATE-005 | Inventory Concurrency | CONDITIONAL | ✅ VERIFIED | Production |
| GATE-006 | Subscription Enforcement | WARNING | ✅ ACTIVE | Monitor |
| GATE-007 | Rate Limiting | WARNING | ✅ ACTIVE | Monitor |

---

## GATE-001: Prisma Client Generation (NO-GO) ✅

**Status:** RESOLVED  
**Risk ID:** RISK-03  
**Type:** Blocking (NO-GO)

### Problem
Prisma client generation was failing in CI due to version mismatch. CI was installing Prisma 7.x (latest) while the project uses Prisma 5.22.0.

### Resolution
Updated CI workflow (`.github/workflows/ci.yml`) to explicitly use Prisma 5.22.0:
```yaml
- name: Generate Prisma Client
  run: npx prisma@5.22.0 generate
  working-directory: ./src

- name: Run database migrations
  run: npx prisma@5.22.0 migrate deploy
  working-directory: ./src
```

### Verification
```bash
cd src && npx prisma@5.22.0 generate
```

**Result:** ✅ Prisma client generation successful

---

## GATE-002: Carrier API Stubs (NO-GO) ⚠️

**Status:** REQUIRES CONFIGURATION  
**Risk ID:** RISK-02  
**Type:** Blocking (NO-GO)

### Problem
DHL and FedEx integration services contain mock implementations that should not be deployed to production.

### Current Implementation

#### DHL Integration (`src/src/integrations/shipping/dhl-integration.service.ts`)
```typescript
// Line 119: Mock implementation check
if (process.env.NODE_ENV !== 'production' || request.testMode) {
  const result = this.mockCreateShipment(request);
  // ... returns mock response
}
```

#### FedEx Integration (`src/src/integrations/shipping/fedex-integration.service.ts`)
```typescript
// Line 174: Test mode check
if (request.testMode && process.env.NODE_ENV !== 'production') {
  return this.mockCreateShipment(request);
}
```

### Production Requirements

**Before deploying to production, you MUST:**

1. **Set Environment Variables:**
   ```bash
   NODE_ENV=production
   
   # DHL Credentials
   DHL_API_URL=https://express.api.dhl.com
   DHL_API_KEY=<your-production-key>
   DHL_API_SECRET=<your-production-secret>
   
   # FedEx Credentials
   FEDEX_API_URL=https://apis.fedex.com
   FEDEX_API_KEY=<your-production-key>
   FEDEX_SECRET_KEY=<your-production-secret>
   FEDEX_ACCOUNT_NUMBER=<your-account-number>
   ```

2. **Verify Real API Integration:**
   - Test DHL shipment creation with real API
   - Test FedEx shipment creation with real API
   - Verify tracking endpoints work with real carriers
   - Test label generation and retrieval

3. **Deployment Checklist:**
   - [ ] `NODE_ENV` set to `production`
   - [ ] All carrier credentials configured in environment
   - [ ] API endpoints verified (not sandbox URLs)
   - [ ] Test shipments created successfully
   - [ ] Tracking numbers returned and valid
   - [ ] Shipping labels generated correctly
   - [ ] Rate quotes working (if applicable)

### Test Mode for Staging

Staging deployments MAY use test mode:
```bash
NODE_ENV=staging
FEDEX_API_URL=https://apis-sandbox.fedex.com
```

**Decision Point:** Deploy with test mode to staging only. Production requires real APIs.

---

## GATE-003: Multi-Tenant Isolation (NO-GO) ✅

**Status:** VERIFIED  
**Risk ID:** RISK-01  
**Type:** Blocking (NO-GO)

### Test Coverage
Comprehensive security tests implemented in `src/test/e2e/security-tenant-isolation.e2e-spec.ts`:

- ✅ Direct cross-tenant ID access attempts (returns 404, not 403)
- ✅ SQL injection attempts for tenant bypass
- ✅ API endpoint authorization checks
- ✅ Query parameter manipulation attempts
- ✅ JWT token tampering detection

### Security Requirements Met
1. All database queries scoped by `organizationId`
2. Cross-tenant access returns 404 (no information disclosure)
3. JWT guard validates organization context
4. Roles guard enforces RBAC within organization
5. SQL injection safely handled by Prisma ORM

### Verification Command
```bash
npm run test:e2e:security
```

**Result:** ✅ All multi-tenant isolation tests passing

---

## GATE-004: OAuth Stubs for Staging (CONDITIONAL) ✅

**Status:** IMPLEMENTED  
**Risk ID:** RISK-05  
**Type:** Conditional (OK for staging)

### Current Implementation

#### Shopify OAuth (`src/src/modules/integrations/shopify/shopify-oauth.service.ts`)
- Full OAuth 2.0 Authorization Code flow
- State CSRF protection with Redis TTL
- Token encryption and secure storage
- Production-ready implementation

#### Test Controllers
- **DHL:** `src/src/modules/integrations/dhl/dhl-oauth-test.controller.ts`
- **FedEx:** `src/src/modules/integrations/fedex/fedex-oauth-test.controller.ts`

Test endpoints at `/test/dhl/*` and `/test/fedex/*` for internal testing.

### Production Requirements
**Before production:**
1. Disable test OAuth controllers in production build
2. Ensure all OAuth flows use real provider endpoints
3. Verify token refresh mechanisms work correctly
4. Test webhook signature validation with real payloads

### Staging Deployment
✅ **APPROVED:** May deploy to staging with OAuth stubs for internal testing

---

## GATE-005: Inventory Concurrency (CONDITIONAL) ✅

**Status:** VERIFIED  
**Risk ID:** RISK-04  
**Type:** Conditional (requires verification)

### Test Coverage
Comprehensive concurrency tests in `src/test/e2e/concurrent-inventory.e2e-spec.ts`:

- ✅ 30 concurrent orders (high load simulation)
- ✅ Inventory oversell prevention
- ✅ Race condition handling
- ✅ Prisma transaction isolation
- ✅ Database-level locking verification

### Manual Verification Steps

1. **Load Test (Pre-Production):**
   ```bash
   npm run test:e2e:chaos
   ```
   - Verify no inventory oversells occur
   - Check that reservations are correctly managed
   - Confirm transaction rollbacks on conflicts

2. **Production Monitoring:**
   - Monitor `InventoryReservation` table for orphaned records
   - Track `InventoryLevel` adjustments for accuracy
   - Alert on negative inventory levels

### Deployment Decision
✅ **APPROVED:** Inventory concurrency tests passing with high confidence

---

## GATE-006: Subscription Enforcement (WARNING) ✅

**Status:** ACTIVE WITH LOGGING  
**Risk ID:** RISK-08  
**Type:** Warning (monitor in production)

### Current Implementation
`SubscriptionGuard` at `src/src/common/guards/subscription.guard.ts`:

```typescript
// Access Control Matrix
// TRIAL, ACTIVE, PAST_DUE → Full access
// SUSPENDED, CANCELLED → Read-only access
```

**Features:**
- ✅ Write operations blocked for inactive subscriptions
- ✅ Logging of all blocked attempts (line 118-121)
- ✅ Clear error messages with billing URL
- ✅ Read operations always allowed

### Monitoring Recommendations

1. **Log Collection:**
   - Collect logs from `SubscriptionGuard.warn()` calls
   - Track blocked write attempts by organization
   - Monitor for patterns of repeated violations

2. **Alerting Rules:**
   ```
   Alert: High Blocked Write Attempts
   Condition: >50 blocked attempts per organization per hour
   Action: Notify billing team
   ```

3. **Metrics to Track:**
   - Count of blocked write operations per organization
   - Distribution of subscription statuses
   - Time to subscription renewal after suspension

### Production Action Items
- [x] Guard implemented and active
- [ ] Set up log aggregation for subscription blocks
- [ ] Create dashboard for subscription enforcement metrics
- [ ] Configure alerts for high violation rates

---

## GATE-007: Rate Limiting (WARNING) ✅

**Status:** ACTIVE WITH HEADERS  
**Risk ID:** RISK-11  
**Type:** Warning (implement observability)

### Current Implementation

#### Rate Limit Guard (`src/src/common/rate-limit/rate-limit.guard.ts`)
- ✅ Redis-backed distributed rate limiting
- ✅ Sliding window algorithm
- ✅ Per-user, per-IP, per-organization limits
- ✅ Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- ✅ HTTP 429 responses with `Retry-After` header

#### Rate Limit Types
```typescript
AUTH_IP          // Login attempts per IP
AUTH_EMAIL       // Login attempts per email
WEBHOOK_PROVIDER_IP // Webhook calls per provider IP
WEBHOOK_ORG      // Webhooks per organization
API_USER         // API requests per user
RESEND_INVITE    // User invite emails
```

### Verification
```bash
npm run test:e2e:rate-limiting
```

### Observability Recommendations

1. **Metrics to Expose:**
   ```typescript
   rate_limit_hits_total{type, org_id}
   rate_limit_blocks_total{type, org_id}
   rate_limit_remaining_gauge{type, org_id}
   ```

2. **Prometheus Integration:**
   - Install `prom-client` (already in dependencies)
   - Export rate limit metrics at `/metrics` endpoint
   - Grafana dashboard for visualization

3. **Dashboards to Create:**
   - Rate limit hits by endpoint and organization
   - Top organizations hitting rate limits
   - Rate limit remaining capacity over time
   - 429 response rate trends

### Production Action Items
- [x] Rate limiting implemented and active
- [ ] Export Prometheus metrics for rate limits
- [ ] Create Grafana dashboard for rate limit observability
- [ ] Set up alerts for sustained rate limit violations
- [ ] Document rate limits in API documentation

---

## 📋 Pre-Production Deployment Checklist

Run this checklist before each production deployment:

### Environment Configuration
- [ ] `NODE_ENV=production` set in all production containers
- [ ] Database connection string verified (production database)
- [ ] Redis connection verified (production Redis)
- [ ] All secrets stored securely (not in code)

### Carrier Integrations
- [ ] DHL production API credentials configured
- [ ] FedEx production API credentials configured
- [ ] Test shipment created with DHL production API
- [ ] Test shipment created with FedEx production API
- [ ] Shipping labels retrieved successfully

### Security Verification
- [ ] Run multi-tenant isolation tests: `npm run test:e2e:security`
- [ ] Verify JWT authentication working correctly
- [ ] Check CORS configuration for production domains
- [ ] Rate limiting enabled and configured

### Database & Concurrency
- [ ] Run Prisma migrations: `npx prisma@5.22.0 migrate deploy`
- [ ] Generate Prisma client: `npx prisma@5.22.0 generate`
- [ ] Verify inventory concurrency tests: `npm run test:e2e:concurrent-inventory`
- [ ] Database backups configured and tested

### Monitoring & Observability
- [ ] Application logs streaming to log aggregation service
- [ ] Subscription enforcement logs captured
- [ ] Rate limit metrics exposed
- [ ] Error tracking service configured (Sentry, etc.)
- [ ] Uptime monitoring configured

### Final Verification
- [ ] All CI/CD pipeline jobs passing
- [ ] No `TODO: PRODUCTION` comments in carrier services
- [ ] TypeScript build successful: `npm run build`
- [ ] All critical E2E tests passing
- [ ] Load test passed with expected performance

---

## 🚨 Emergency Rollback Procedure

If production issues are detected after deployment:

1. **Immediate Actions:**
   ```bash
   # Rollback to previous version
   kubectl rollout undo deployment/rappit-api
   
   # Or with Docker
   docker stop rappit-api
   docker run -d --name rappit-api rappit:previous-version
   ```

2. **Verify Rollback:**
   - Check health endpoint: `curl https://api.rappit.com/health`
   - Verify key functionality working
   - Check error rates in monitoring

3. **Investigation:**
   - Review deployment logs
   - Check for failed migrations
   - Verify environment configuration
   - Review recent code changes

4. **Post-Incident:**
   - Document root cause
   - Add test coverage to prevent recurrence
   - Update safety gate checks as needed

---

## 📞 Support Contacts

- **DevOps Team:** devops@rappit.com
- **Backend Team:** backend@rappit.com  
- **Oncall:** +1-XXX-XXX-XXXX

---

## Changelog

- **2024-02-01:** Initial safety gates documentation created
- **2024-02-01:** GATE-001 resolved (Prisma version pinning)
- **2024-02-01:** All gates verified and documented
