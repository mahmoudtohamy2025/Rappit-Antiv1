# Production Safety Gates - Quick Reference

This is a quick reference for the production safety gates. For detailed information, see [PRODUCTION_SAFETY_GATES.md](./PRODUCTION_SAFETY_GATES.md).

## 🚨 Critical NO-GO Gates (Must Fix Before Production)

### GATE-001: Prisma Client Generation ✅ RESOLVED
**Status:** Fixed  
**Action:** None required - CI now uses Prisma 5.22.0

### GATE-002: Carrier API Stubs ⚠️ REQUIRES CONFIGURATION
**Status:** Requires production configuration  
**Action Required:**
```bash
# Production .env MUST have:
NODE_ENV=production
DHL_API_URL=https://express.api.dhl.com
FEDEX_API_URL=https://apis.fedex.com
DHL_API_KEY=<production-key>
DHL_API_SECRET=<production-secret>
FEDEX_API_KEY=<production-key>
FEDEX_SECRET_KEY=<production-secret>
FEDEX_ACCOUNT_NUMBER=<account-number>
```

**Verification:**
- Application will fail to start if configuration is missing
- Test shipment creation before go-live

### GATE-003: Multi-Tenant Isolation ✅ VERIFIED
**Status:** Tests passing  
**Action:** Run before deployment
```bash
npm run test:e2e:security
```

---

## ⚠️ Conditional/Warning Gates

### GATE-004: OAuth Stubs ✅ OK FOR STAGING
**Status:** Conditional  
**Production:** Disable test OAuth endpoints  
**Staging:** OK to use with sandbox APIs

### GATE-005: Inventory Concurrency ✅ VERIFIED
**Status:** Tests passing  
**Action:** Run before deployment
```bash
npm run test:e2e:concurrent-inventory
```

### GATE-006: Subscription Enforcement ✅ MONITORING ACTIVE
**Status:** Monitoring required  
**Metrics:** `subscription_blocks_total`  
**Action:** Set up alerts for high block rates

### GATE-007: Rate Limiting ✅ OBSERVABILITY ACTIVE
**Status:** Monitoring required  
**Metrics:** `rate_limit_hits_total`, `rate_limit_blocks_total`  
**Action:** Configure Prometheus scraping at `/metrics`

---

## Quick Start - Production Deployment

### 1. Pre-Deployment Check
```bash
# Run all tests
npm run test:ci

# Security tests
npm run test:e2e:security

# Concurrency tests
npm run test:e2e:concurrent-inventory

# Generate Prisma client
cd src && npx prisma@5.22.0 generate

# Run migrations
cd src && npx prisma@5.22.0 migrate deploy
```

### 2. Configuration Check
```bash
# Verify environment variables
cat .env.production

# Required checks:
# ✓ NODE_ENV=production
# ✓ DHL_API_URL does NOT contain "sandbox"
# ✓ FEDEX_API_URL does NOT contain "sandbox"
# ✓ All API keys are production keys
# ✓ DATABASE_URL is production database
```

### 3. Deploy
```bash
# The application will run safety checks on startup
# It will exit with error if any NO-GO gate fails

docker run -d --env-file .env.production rappit:latest
```

### 4. Verify
```bash
# Health check
curl https://api.rappit.com/api/v1/health

# Metrics
curl https://api.rappit.com/metrics

# Create test shipment
# (See DEPLOYMENT_CHECKLIST.md for full smoke tests)
```

---

## Monitoring Endpoints

### Health Check
```
GET /api/v1/health
```

### Prometheus Metrics
```
GET /metrics
```

**Available Metrics:**
- `rate_limit_hits_total` - Rate limit requests
- `rate_limit_blocks_total` - Blocked requests (429)
- `rate_limit_remaining` - Remaining capacity
- `subscription_blocks_total` - Subscription blocks
- `http_requests_total` - All HTTP requests
- `http_request_duration_ms` - Request duration

### Swagger API Docs
```
GET /api/docs
```

---

## Emergency Contacts

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| Production Down | oncall@rappit.com | Immediate |
| Security Issue | security@rappit.com | < 1 hour |
| Carrier API Issue | backend@rappit.com | < 2 hours |
| General Support | support@rappit.com | < 4 hours |

---

## Rollback

If issues occur after deployment:

```bash
# Kubernetes
kubectl rollout undo deployment/rappit-api

# Docker
docker stop rappit-api
docker run -d --name rappit-api rappit:previous-version

# Verify
curl https://api.rappit.com/api/v1/health
```

---

## Files to Review

| File | Purpose |
|------|---------|
| [PRODUCTION_SAFETY_GATES.md](./PRODUCTION_SAFETY_GATES.md) | Complete safety gates documentation |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Step-by-step deployment guide |
| `.env.example` | Environment variables reference |
| `src/src/utils/production-safety-check.ts` | Safety check implementation |

---

## Decision Matrix

| Question | Answer | Gate |
|----------|--------|------|
| Can I deploy without configuring carrier APIs? | ❌ NO | GATE-002 (NO-GO) |
| Can I deploy to staging with sandbox APIs? | ✅ YES | GATE-002 (OK for staging) |
| Can I deploy without running security tests? | ❌ NO | GATE-003 (NO-GO) |
| Can I deploy without Prometheus configured? | ⚠️ YES (but not recommended) | GATE-007 (WARNING) |
| Can I deploy without subscription metrics? | ⚠️ YES (but not recommended) | GATE-006 (WARNING) |

---

## Status Summary

| Gate | Type | Status | Production Ready |
|------|------|--------|------------------|
| GATE-001 | NO-GO | ✅ Fixed | Yes |
| GATE-002 | NO-GO | ⚠️ Config Required | No* |
| GATE-003 | NO-GO | ✅ Verified | Yes |
| GATE-004 | CONDITIONAL | ✅ Documented | Yes (staging) |
| GATE-005 | CONDITIONAL | ✅ Verified | Yes |
| GATE-006 | WARNING | ✅ Monitoring Added | Yes |
| GATE-007 | WARNING | ✅ Observability Added | Yes |

**\*Note:** GATE-002 requires production carrier API credentials to be configured. The code is ready, but credentials must be added to environment variables.

---

Last Updated: 2024-02-01
