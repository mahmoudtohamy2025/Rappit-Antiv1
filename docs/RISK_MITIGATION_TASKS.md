# Risk Mitigation Tasks

**Generated From:** Test-to-Production Risk Mapping Report  
**Date:** 2026-01-31  
**Total Tasks:** 18 actionable items

---

## Task Categories

| Category | Task Count | Priority Range |
|----------|------------|----------------|
| Immediate Actions (Before Production) | 6 | P0-P1 |
| Structural Fixes (Require Code Changes) | 8 | P0-P2 |
| Test Strategy Adjustments | 5 | P1-P2 |
| Production Safety Gates | 7 | Blocking/Conditional/Warning |
| Deployment Prerequisites | 4 | Mandatory |

---

## 🚨 Section 1 — Immediate Actions (Before Production)

### TASK-001: Generate Prisma Client in Test Environment
| Field | Value |
|-------|-------|
| **Priority** | P0 (Critical) |
| **Risk IDs** | RISK-03, C-01 |
| **Effort** | Low |
| **Type** | CI/CD Configuration |
| **Description** | Run `npx prisma generate` before test execution to resolve module resolution failures |
| **Acceptance Criteria** | All 60 failing test suites initialize successfully |
| **Evidence** | Jest output shows `Cannot find module '.prisma/client/default'` error across 60 test files |

**Implementation:**
```yaml
# Add to CI workflow before running tests
# Note: Verify Prisma schema location - this project uses src/prisma/schema.prisma
- name: Generate Prisma Client
  run: |
    cd src
    npx prisma generate
    # Alternative if schema is at root: npx prisma generate --schema=prisma/schema.prisma
```

---

### TASK-002: Add @nestjs/schedule to Test Dependencies
| Field | Value |
|-------|-------|
| **Priority** | P0 (Critical) |
| **Risk IDs** | B-02 |
| **Effort** | Low |
| **Type** | Dependency Management |
| **Description** | Add missing `@nestjs/schedule` dependency to enable tracking scheduler tests |
| **Acceptance Criteria** | `tracking-scheduler.spec.ts` initializes without module resolution errors |
| **Evidence** | `Cannot find module '@nestjs/schedule'` in `tracking-scheduler.spec.ts` |

**Implementation:**
```bash
npm install --save-dev @nestjs/schedule
```

---

### TASK-003: Verify Multi-Tenant Isolation Manually
| Field | Value |
|-------|-------|
| **Priority** | P0 (Critical) |
| **Risk IDs** | RISK-01 |
| **Effort** | Medium |
| **Type** | Manual Verification |
| **Description** | Until automated tests run, manually verify organization scoping across all entities |
| **Acceptance Criteria** | Document confirming Tenant A cannot access Tenant B data for all entities |
| **Evidence** | `multi-tenant.e2e-spec.ts` failed to initialize; security-critical functionality unverified |

**Verification Checklist:**
- [ ] Orders are scoped by organizationId
- [ ] Inventory is scoped by organizationId
- [ ] Customers are scoped by organizationId
- [ ] Products/SKUs are scoped by organizationId
- [ ] Channels are scoped by organizationId
- [ ] Shipments are scoped by organizationId
- [ ] Users can only access their organization's data
- [ ] API endpoints enforce organization scoping

---

### TASK-004: Replace Placeholder Test Assertions
| Field | Value |
|-------|-------|
| **Priority** | P1 (High) |
| **Risk IDs** | RISK-06, D-01, D-02, D-03, D-04, D-05, D-06, D-07 |
| **Effort** | Medium |
| **Type** | Test Code Changes |
| **Description** | Change `expect(true).toBe(true)` and similar placeholder assertions to actual behavior tests |
| **Acceptance Criteria** | No tests contain placeholder assertions; all tests verify actual behavior |
| **Evidence** | `test/unit/billing.spec.ts` line 46: `const submitted = true; expect(submitted).toBe(true);` |

**Files Requiring Updates:**
- [ ] `test/unit/billing.spec.ts` - Replace mock data verification with behavior tests
- [ ] `test/unit/auth-client.spec.ts` - Test actual HTTP requests, not in-memory logic
- [ ] `test/unit/orders.spec.ts` - Test database queries, not JS filter operations
- [ ] `test/unit/filters.spec.ts` - Verify filtering logic, not just array lengths
- [ ] `test/unit/dashboard-analytics.spec.ts` - Test real data aggregations

---

### TASK-005: Add Assertions for Error Messages
| Field | Value |
|-------|-------|
| **Priority** | P1 (High) |
| **Risk IDs** | D-07 |
| **Effort** | Medium |
| **Type** | Test Code Changes |
| **Description** | Tests should verify error content, not just exception type |
| **Acceptance Criteria** | All error path tests assert on error message content |
| **Evidence** | Tests check for exceptions but not error content |

**Pattern to Follow:**
```typescript
// Before (weak)
expect(() => service.method()).toThrow();

// After (strong)
expect(() => service.method()).toThrow('Specific error message');
// Or
await expect(service.method()).rejects.toMatchObject({
  message: expect.stringContaining('expected content'),
  statusCode: 400
});
```

---

### TASK-006: Run Inventory Concurrency Tests Manually
| Field | Value |
|-------|-------|
| **Priority** | P1 (High) |
| **Risk IDs** | RISK-04 |
| **Effort** | Medium |
| **Type** | Manual Testing |
| **Description** | Execute inventory concurrency tests with actual database to verify no overselling |
| **Acceptance Criteria** | Concurrent reservation attempts do not result in negative inventory |
| **Evidence** | `inventory.concurrency.e2e-spec.ts` failed to initialize |

**Test Scenarios:**
- [ ] Two concurrent orders for same SKU with quantity = available stock
- [ ] Multiple concurrent reservations exceeding available stock
- [ ] Concurrent reserve and release operations
- [ ] High-volume concurrent order placement (10+ simultaneous)

---

## 🔧 Section 2 — Structural Fixes (Require Code Changes)

### TASK-007: Implement Actual DHL API Calls
| Field | Value |
|-------|-------|
| **Priority** | P0 (Critical) |
| **Risk IDs** | RISK-02, A-01 |
| **Effort** | High |
| **Type** | Production Code Changes |
| **Description** | Replace DHL API stubs with real HTTP calls |
| **Acceptance Criteria** | Shipments can be created via DHL API in production |
| **Evidence** | `dhl-integration.service.ts` lines 205-250 marked with 7 `PRODUCTION TODO` comments; all HTTP methods are stubs |

**Implementation Requirements:**
- [ ] Implement `createShipment` HTTP call to DHL API
- [ ] Implement `getTrackingStatus` HTTP call
- [ ] Implement `cancelShipment` HTTP call
- [ ] Add retry logic with exponential backoff
- [ ] Add rate limiting
- [ ] Add timeout handling
- [ ] Decrypt credentials before use
- [ ] Build payload according to DHL API documentation
- [ ] Parse DHL API response correctly
- [ ] Parse DHL tracking API response

**Files to Modify:**
- `src/src/integrations/shipping/dhl-integration.service.ts`

---

### TASK-008: Implement Actual FedEx API Calls
| Field | Value |
|-------|-------|
| **Priority** | P0 (Critical) |
| **Risk IDs** | RISK-02, A-02 |
| **Effort** | High |
| **Type** | Production Code Changes |
| **Description** | Replace FedEx API stubs with real HTTP calls (similar pattern to DHL) |
| **Acceptance Criteria** | Shipments can be created via FedEx API in production |
| **Evidence** | Test file `fedex-integration.spec.ts` failed to initialize due to missing Prisma client |

**Implementation Requirements:**
- [ ] Implement `createShipment` HTTP call to FedEx API
- [ ] Implement `getTrackingStatus` HTTP call
- [ ] Implement `cancelShipment` HTTP call
- [ ] Add OAuth2 authentication flow for FedEx
- [ ] Add retry logic with exponential backoff
- [ ] Add rate limiting
- [ ] Add timeout handling

---

### TASK-009: Implement Shopify OAuth Token Exchange
| Field | Value |
|-------|-------|
| **Priority** | P0 (Critical) |
| **Risk IDs** | RISK-05, A-03 |
| **Effort** | Medium |
| **Type** | Production Code Changes |
| **Description** | Replace Shopify OAuth stubs with real HTTP calls |
| **Acceptance Criteria** | Merchants can connect Shopify stores in production |
| **Evidence** | `oauth-helpers.ts` lines 23-45 contain 3 `TODO: Implement actual HTTP` comments |

**Implementation Requirements:**
- [ ] Implement actual HTTP POST to Shopify OAuth token endpoint
- [ ] Handle access token response
- [ ] Store encrypted tokens
- [ ] Implement token refresh flow

**Files to Modify:**
- `src/src/integrations/oauth-helpers.ts`

---

### TASK-010: Implement WooCommerce OAuth1 Signature
| Field | Value |
|-------|-------|
| **Priority** | P0 (Critical) |
| **Risk IDs** | RISK-05, A-04 |
| **Effort** | Medium |
| **Type** | Production Code Changes |
| **Description** | Replace WooCommerce OAuth1 stubs with real implementation |
| **Acceptance Criteria** | Merchants can connect WooCommerce stores in production |
| **Evidence** | `oauth-helpers.ts` lines 78-95: `TODO: Implement actual HTTP request with OAuth1 signature` |

**Implementation Requirements:**
- [ ] Implement OAuth1 signature generation
- [ ] Implement actual HTTP request with OAuth1 signature
- [ ] Handle WooCommerce API responses

**Files to Modify:**
- `src/src/integrations/oauth-helpers.ts`
- `src/src/integrations/woocommerce/woocommerce-integration.service.ts`

---

### TASK-011: Implement Channel Connection Tests
| Field | Value |
|-------|-------|
| **Priority** | P1 (High) |
| **Risk IDs** | RISK-09, A-05 |
| **Effort** | Medium |
| **Type** | Production Code Changes |
| **Description** | Actually validate channel credentials when testing connection |
| **Acceptance Criteria** | Connection test returns true only if credentials are valid |
| **Evidence** | `channel-connection.service.ts` lines 45-80: `TODO: Implement actual API validation calls` |

**Implementation Requirements:**
- [ ] Implement actual API test based on channel type
- [ ] Test Shopify connection with real API call
- [ ] Test WooCommerce connection with real API call
- [ ] Return accurate success/failure status

**Files to Modify:**
- `src/src/services/channel-connection.service.ts`

---

### TASK-012: Implement Shipping Account Carrier API Test
| Field | Value |
|-------|-------|
| **Priority** | P1 (High) |
| **Risk IDs** | RISK-09, A-06 |
| **Effort** | Medium |
| **Type** | Production Code Changes |
| **Description** | Actually verify carrier credentials when testing shipping account connection |
| **Acceptance Criteria** | Connection test returns true only if carrier credentials are valid |
| **Evidence** | `shipping-account.controller.ts`: `TODO: Implement actual connection test with carrier API` |

**Files to Modify:**
- `src/src/controllers/shipping-account.controller.ts`

---

### TASK-013: Add Contract Tests for External APIs
| Field | Value |
|-------|-------|
| **Priority** | P1 (High) |
| **Risk IDs** | RISK-12, B-03 |
| **Effort** | High |
| **Type** | Test Infrastructure |
| **Description** | Use Pact or similar tool to add contract tests for external APIs |
| **Acceptance Criteria** | Contract tests verify API compatibility before deployment |
| **Evidence** | All carrier services use stub implementations; API contract changes undetected until production |

**APIs Requiring Contract Tests:**
- [ ] Shopify REST API
- [ ] Shopify GraphQL API
- [ ] WooCommerce REST API
- [ ] DHL Express API
- [ ] FedEx API
- [ ] Stripe API

---

### TASK-014: Separate Pure Logic from Side Effects
| Field | Value |
|-------|-------|
| **Priority** | P2 (Medium) |
| **Risk IDs** | B-05 |
| **Effort** | High |
| **Type** | Architecture Refactoring |
| **Description** | Make inventory logic testable without database by separating pure business logic |
| **Acceptance Criteria** | Core inventory calculations can be unit tested without database |
| **Evidence** | Concurrent inventory operations require actual database with row-level locking to test |

**Refactoring Approach:**
- [ ] Extract reservation calculation logic to pure functions
- [ ] Extract stock level validation to pure functions
- [ ] Use dependency injection for database operations
- [ ] Create in-memory repository implementations for testing

---

## 📋 Section 3 — Test Strategy Adjustments

### TASK-015: Add Integration Tests with Test Containers
| Field | Value |
|-------|-------|
| **Priority** | P1 (High) |
| **Risk IDs** | RISK-03, RISK-04 |
| **Effort** | High |
| **Type** | Test Infrastructure |
| **Description** | Add integration tests using test containers for database-dependent behavior |
| **Acceptance Criteria** | Integration tests run with real PostgreSQL and Redis in containers |
| **Rationale** | Unit tests insufficient for database-dependent behavior |

**Implementation:**
- [ ] Add testcontainers-node dependency
- [ ] Create PostgreSQL container configuration
- [ ] Create Redis container configuration
- [ ] Update test setup to start containers
- [ ] Add container cleanup in teardown

---

### TASK-016: Add End-to-End Tests with Real Database
| Field | Value |
|-------|-------|
| **Priority** | P1 (High) |
| **Risk IDs** | E-01, E-02, E-03, E-04, E-05, E-06, E-07 |
| **Effort** | High |
| **Type** | Test Infrastructure |
| **Description** | Add comprehensive E2E tests with real database connections |
| **Acceptance Criteria** | Full order lifecycle can be verified end-to-end |
| **Rationale** | System-level behavior cannot be verified via unit tests |

**E2E Test Scenarios:**
- [ ] Full order lifecycle: Import → Reserve → Ship → Deliver
- [ ] Multi-tenant data isolation across all entities
- [ ] Webhook → Queue → Worker → Database flow
- [ ] Inventory reservation across concurrent orders
- [ ] Order cancellation with inventory release
- [ ] Stripe subscription → billing enforcement
- [ ] Rate limiting under load

---

### TASK-017: Add Chaos Engineering Tests
| Field | Value |
|-------|-------|
| **Priority** | P2 (Medium) |
| **Risk IDs** | RISK-04 |
| **Effort** | High |
| **Type** | Test Infrastructure |
| **Description** | Add chaos/load tests for inventory race conditions |
| **Acceptance Criteria** | System handles concurrent load without data corruption |
| **Rationale** | Inventory race conditions require concurrent load testing |

**Test Scenarios:**
- [ ] High-volume concurrent order placement
- [ ] Database connection pool exhaustion
- [ ] Redis connection failures
- [ ] Carrier API timeouts
- [ ] Network partition simulation

---

### TASK-018: Add Security-Focused Tests for Tenant Isolation
| Field | Value |
|-------|-------|
| **Priority** | P0 (Critical) |
| **Risk IDs** | RISK-01 |
| **Effort** | Medium |
| **Type** | Security Testing |
| **Description** | Add dedicated security test suite for multi-tenant isolation |
| **Acceptance Criteria** | Automated tests verify tenant isolation for all entities |
| **Rationale** | Critical security requirement needs dedicated test suite |

**Security Test Cases:**
- [ ] Direct ID access attempts across tenants
- [ ] SQL injection attempts for tenant bypass
- [ ] API endpoint authorization for wrong tenant
- [ ] Query parameter manipulation for tenant access
- [ ] JWT token with wrong organization claim

---

## 🚦 Section 4 — Production Safety Gates

### GATE-001: Prisma Client Generation (NO-GO)
| Field | Value |
|-------|-------|
| **Type** | NO-GO (Blocking) |
| **Risk IDs** | RISK-03 |
| **Condition** | Do not deploy while Prisma client generation is broken in CI |
| **Resolution** | Complete TASK-001 |

---

### GATE-002: Carrier API Stubs (NO-GO)
| Field | Value |
|-------|-------|
| **Type** | NO-GO (Blocking) |
| **Risk IDs** | RISK-02 |
| **Condition** | Do not deploy with carrier API stubs to production |
| **Resolution** | Complete TASK-007 (DHL) and/or TASK-008 (FedEx) |

---

### GATE-003: Multi-Tenant Isolation (NO-GO)
| Field | Value |
|-------|-------|
| **Type** | NO-GO (Blocking) |
| **Risk IDs** | RISK-01 |
| **Condition** | Do not deploy without verifying multi-tenant isolation |
| **Resolution** | Complete TASK-003 or TASK-018 |

---

### GATE-004: OAuth Stubs for Staging (CONDITIONAL)
| Field | Value |
|-------|-------|
| **Type** | CONDITIONAL |
| **Risk IDs** | RISK-05 |
| **Condition** | May deploy to staging with OAuth stubs for internal testing only |
| **Resolution** | Complete TASK-009 and TASK-010 before production |

---

### GATE-005: Inventory Concurrency (CONDITIONAL)
| Field | Value |
|-------|-------|
| **Type** | CONDITIONAL |
| **Risk IDs** | RISK-04 |
| **Condition** | May deploy after manual verification of inventory concurrency |
| **Resolution** | Complete TASK-006 |

---

### GATE-006: Subscription Enforcement (WARNING)
| Field | Value |
|-------|-------|
| **Type** | WARNING |
| **Risk IDs** | RISK-08 |
| **Condition** | Monitor subscription enforcement in production |
| **Action** | Add monitoring/alerting for subscription status violations |

---

### GATE-007: Rate Limiting (WARNING)
| Field | Value |
|-------|-------|
| **Type** | WARNING |
| **Risk IDs** | RISK-11 |
| **Condition** | Implement rate limiting observability |
| **Action** | Add metrics/dashboards for rate limit hits |

---

## ✅ Section 5 — Deployment Prerequisites

### PREREQ-001: Fix Prisma Client Generation
| Field | Value |
|-------|-------|
| **Mandatory** | Yes |
| **Task Reference** | TASK-001 |
| **Verification** | All 60 test suites must pass initialization |

---

### PREREQ-002: Verify Multi-Tenant Isolation
| Field | Value |
|-------|-------|
| **Mandatory** | Yes |
| **Task Reference** | TASK-003 or TASK-018 |
| **Verification** | Either via automated tests or manual verification document |

---

### PREREQ-003: Implement At Least One Carrier API
| Field | Value |
|-------|-------|
| **Mandatory** | Yes |
| **Task Reference** | TASK-007 (DHL) or TASK-008 (FedEx) |
| **Verification** | Shipments can be created via real carrier API |

---

### PREREQ-004: Implement At Least One OAuth Flow
| Field | Value |
|-------|-------|
| **Mandatory** | Yes |
| **Task Reference** | TASK-009 (Shopify) or TASK-010 (WooCommerce) |
| **Verification** | Merchants can connect at least one sales channel |

---

## 📊 Task Summary by Priority

### P0 (Critical) - Must Complete Before Any Deployment
| Task ID | Description | Effort | Status |
|---------|-------------|--------|--------|
| TASK-001 | Generate Prisma client in CI | Low | ⬜ Not Started |
| TASK-002 | Add @nestjs/schedule dependency | Low | ⬜ Not Started |
| TASK-003 | Verify multi-tenant isolation manually | Medium | ⬜ Not Started |
| TASK-007 | Implement DHL API calls | High | ⬜ Not Started |
| TASK-008 | Implement FedEx API calls | High | ⬜ Not Started |
| TASK-009 | Implement Shopify OAuth | Medium | ⬜ Not Started |
| TASK-010 | Implement WooCommerce OAuth | Medium | ⬜ Not Started |
| TASK-018 | Security tests for tenant isolation | Medium | ⬜ Not Started |

### P1 (High) - Complete This Sprint
| Task ID | Description | Effort | Status |
|---------|-------------|--------|--------|
| TASK-004 | Replace placeholder assertions | Medium | ⬜ Not Started |
| TASK-005 | Add error message assertions | Medium | ⬜ Not Started |
| TASK-006 | Run inventory concurrency tests | Medium | ⬜ Not Started |
| TASK-011 | Implement channel connection tests | Medium | ⬜ Not Started |
| TASK-012 | Implement shipping account tests | Medium | ⬜ Not Started |
| TASK-013 | Add contract tests for APIs | High | ⬜ Not Started |
| TASK-015 | Add integration tests with containers | High | ⬜ Not Started |
| TASK-016 | Add E2E tests with real database | High | ⬜ Not Started |

### P2 (Medium) - Complete Next Sprint
| Task ID | Description | Effort | Status |
|---------|-------------|--------|--------|
| TASK-014 | Separate pure logic from side effects | High | ⬜ Not Started |
| TASK-017 | Add chaos engineering tests | High | ⬜ Not Started |

---

## 📈 Progress Tracking

**Total Tasks:** 18  
**Completed:** 0  
**In Progress:** 0  
**Not Started:** 18  

**Deployment Readiness:** ⛔ NOT READY

**Minimum for Staging Deployment:**
- [ ] TASK-001 (Prisma generation)
- [ ] TASK-002 (@nestjs/schedule)
- [ ] TASK-003 (Manual multi-tenant verification)

**Minimum for Production Deployment:**
- [ ] All staging requirements
- [ ] TASK-007 or TASK-008 (At least one carrier)
- [ ] TASK-009 or TASK-010 (At least one OAuth)
- [ ] GATE-001 through GATE-003 resolved

---

## Appendix: Risk-to-Task Mapping

| Risk ID | Severity | Related Tasks |
|---------|----------|---------------|
| RISK-01 | CRITICAL | TASK-003, TASK-018, GATE-003 |
| RISK-02 | HIGH | TASK-007, TASK-008, GATE-002 |
| RISK-03 | HIGH | TASK-001, TASK-015, GATE-001 |
| RISK-04 | HIGH | TASK-006, TASK-017, GATE-005 |
| RISK-05 | HIGH | TASK-009, TASK-010, GATE-004 |
| RISK-06 | MEDIUM | TASK-004, TASK-005 |
| RISK-07 | MEDIUM | TASK-016 |
| RISK-08 | MEDIUM | GATE-006 |
| RISK-09 | MEDIUM | TASK-011, TASK-012 |
| RISK-10 | LOW | TASK-002 |
| RISK-11 | MEDIUM | GATE-007 |
| RISK-12 | MEDIUM | TASK-013 |

---

*Tasks generated from Test-to-Production Risk Mapping Report. All tasks are traceable to specific risks and evidence.*
