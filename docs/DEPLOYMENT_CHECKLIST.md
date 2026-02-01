# Production Deployment Checklist

## Pre-Deployment Requirements

Before deploying to production, ensure all safety gates are addressed:

### ✅ GATE-001: Prisma Client Generation
- [ ] Prisma version 5.22.0 is specified in CI workflow
- [ ] Run `npx prisma@5.22.0 generate` succeeds locally
- [ ] CI pipeline passes without Prisma generation errors

### ✅ GATE-002: Carrier API Configuration (CRITICAL - NO-GO)

**DHL Configuration:**
```bash
# Required environment variables
DHL_API_URL=https://express.api.dhl.com
DHL_API_KEY=<your-production-api-key>
DHL_API_SECRET=<your-production-secret>
```

**FedEx Configuration:**
```bash
# Required environment variables
FEDEX_API_URL=https://apis.fedex.com
FEDEX_API_KEY=<your-production-api-key>
FEDEX_SECRET_KEY=<your-production-secret>
FEDEX_ACCOUNT_NUMBER=<your-account-number>
```

**Verification Steps:**
- [ ] Create test shipment with DHL production API
- [ ] Create test shipment with FedEx production API
- [ ] Verify tracking numbers are valid
- [ ] Confirm labels are generated correctly
- [ ] Ensure API URLs do NOT contain "sandbox" or "test"

### ✅ GATE-003: Multi-Tenant Isolation (CRITICAL - NO-GO)

- [ ] Run security tests: `npm run test:e2e:security`
- [ ] All cross-tenant access tests pass
- [ ] Database queries scoped by `organizationId`
- [ ] JWT guard validates organization context
- [ ] No 403 responses for cross-tenant access (must be 404)

### ✅ GATE-004: OAuth Stubs (CONDITIONAL - OK for Staging)

**For Production:**
- [ ] OAuth test controllers disabled in production build
- [ ] All OAuth flows use production provider endpoints
- [ ] Token refresh mechanisms work correctly
- [ ] Webhook signature validation tested with real payloads

**For Staging (OK to deploy with stubs):**
- [x] OAuth test endpoints available at `/test/*`
- [x] Sandbox API endpoints configured

### ✅ GATE-005: Inventory Concurrency (CONDITIONAL - Requires Verification)

- [ ] Run concurrency tests: `npm run test:e2e:concurrent-inventory`
- [ ] 30 concurrent orders test passes
- [ ] No inventory oversells detected
- [ ] Prisma transactions handle race conditions
- [ ] Database-level locking verified

**Production Monitoring:**
- [ ] Monitor `InventoryReservation` for orphaned records
- [ ] Track `InventoryLevel` adjustments
- [ ] Alert on negative inventory levels

### ✅ GATE-006: Subscription Enforcement (WARNING - Monitoring Required)

- [x] SubscriptionGuard is active
- [x] Blocked attempts are logged
- [ ] Log aggregation configured
- [ ] Dashboard created for subscription metrics
- [ ] Alerts configured for high violation rates

**Metrics Available:**
- `subscription_blocks_total{organization_id, subscription_status, endpoint}`

### ✅ GATE-007: Rate Limiting (WARNING - Observability Required)

- [x] Rate limiting is active
- [x] HTTP 429 responses with headers
- [x] Prometheus metrics exposed at `/metrics`
- [ ] Prometheus server configured to scrape metrics
- [ ] Grafana dashboard created
- [ ] Alerts configured for sustained violations

**Metrics Available:**
- `rate_limit_hits_total{type, organization_id, endpoint}`
- `rate_limit_blocks_total{type, organization_id, endpoint}`
- `rate_limit_remaining{type, organization_id, endpoint}`
- `http_requests_total{method, route, status_code}`
- `http_request_duration_ms{method, route}`

## Environment Configuration

### Required Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# Database
DATABASE_URL=postgresql://user:pass@production-db:5432/rappit

# Redis
REDIS_HOST=production-redis
REDIS_PORT=6379

# JWT
JWT_SECRET=<strong-random-secret-256-bits>

# DHL (see GATE-002)
DHL_API_URL=https://express.api.dhl.com
DHL_API_KEY=<production-key>
DHL_API_SECRET=<production-secret>

# FedEx (see GATE-002)
FEDEX_API_URL=https://apis.fedex.com
FEDEX_API_KEY=<production-key>
FEDEX_SECRET_KEY=<production-secret>
FEDEX_ACCOUNT_NUMBER=<account-number>

# Shopify
SHOPIFY_API_KEY=<production-key>
SHOPIFY_API_SECRET=<production-secret>

# WooCommerce
WOOCOMMERCE_CONSUMER_KEY=<production-key>
WOOCOMMERCE_CONSUMER_SECRET=<production-secret>

# Stripe
STRIPE_SECRET_KEY=<production-key>
STRIPE_WEBHOOK_SECRET=<webhook-secret>

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=<sentry-dsn>
```

## Pre-Deployment Tests

### 1. Run Full Test Suite
```bash
npm run test:ci
```

### 2. Run E2E Security Tests
```bash
npm run test:e2e:security
```

### 3. Run Inventory Concurrency Tests
```bash
npm run test:e2e:concurrent-inventory
```

### 4. Run Rate Limiting Tests
```bash
npm run test:e2e:rate-limiting
```

### 5. Generate Prisma Client
```bash
cd src && npx prisma@5.22.0 generate
```

### 6. Run Prisma Migrations
```bash
cd src && npx prisma@5.22.0 migrate deploy
```

## Deployment Steps

### 1. Pre-Deployment Validation
```bash
# Set environment to production
export NODE_ENV=production

# Validate configuration (will exit if any NO-GO gates fail)
npm run start:dev
```

The application will run production safety checks on startup and fail if:
- Prisma client is not generated
- Carrier API credentials are missing or pointing to sandbox
- Database URL appears to be development/test

### 2. Deploy Application
```bash
# Build Docker image
docker build -t rappit:latest .

# Run container
docker run -d \
  --name rappit-api \
  --env-file .env.production \
  -p 3000:3000 \
  rappit:latest
```

Or using Kubernetes (configure k8s deployment files for your environment):
```bash
# Example - adjust paths and configuration for your setup
kubectl apply -f k8s/deployment.yaml
```

### 3. Verify Deployment
```bash
# Check health endpoint
curl https://api.rappit.com/api/v1/health

# Check metrics endpoint
curl https://api.rappit.com/metrics

# Check Swagger docs
curl https://api.rappit.com/api/docs
```

### 4. Smoke Tests
- [ ] Login with test account
- [ ] Create test order
- [ ] Create test shipment (DHL/FedEx)
- [ ] Verify webhook processing
- [ ] Check inventory reservation
- [ ] Test rate limiting (make 10 rapid requests)

## Post-Deployment Monitoring

### Immediate (First Hour)
- [ ] Monitor application logs for errors
- [ ] Check error rate in monitoring dashboard
- [ ] Verify database connections stable
- [ ] Confirm Redis connection working
- [ ] Check rate limit metrics

### First 24 Hours
- [ ] Monitor subscription enforcement blocks
- [ ] Track rate limit violations
- [ ] Review carrier API integration logs
- [ ] Check inventory level accuracy
- [ ] Monitor database performance

### Ongoing
- [ ] Set up alerts for high error rates
- [ ] Monitor subscription blocks > 50/hour per org
- [ ] Track rate limit blocks by endpoint
- [ ] Review carrier API costs
- [ ] Monitor database query performance

## Rollback Procedure

If critical issues are detected:

### 1. Immediate Rollback
```bash
# Kubernetes
kubectl rollout undo deployment/rappit-api

# Docker
docker stop rappit-api
docker run -d --name rappit-api rappit:previous-version
```

### 2. Verify Rollback
```bash
curl https://api.rappit.com/api/v1/health
```

### 3. Investigate
- Review deployment logs
- Check for failed migrations
- Verify environment configuration
- Review recent code changes

## Monitoring Dashboards

### Grafana Dashboard Panels

**1. Rate Limiting**
- Rate limit hits by type and organization
- Rate limit blocks over time
- Top organizations hitting limits
- Rate limit remaining capacity

**2. Subscription Enforcement**
- Subscription blocks by organization
- Blocks by subscription status
- Blocked endpoints frequency

**3. API Performance**
- Request rate by endpoint
- Response times
- Error rates
- Status code distribution

**4. Carrier Integrations**
- DHL API calls and errors
- FedEx API calls and errors
- Shipment creation success rate
- Label generation time

## Security Considerations

### 1. Secrets Management
- [ ] All secrets stored in secure vault (AWS Secrets Manager, HashiCorp Vault)
- [ ] No secrets in code or version control
- [ ] Database credentials rotated regularly
- [ ] API keys rotated according to provider policy

### 2. Network Security
- [ ] API behind WAF (Web Application Firewall)
- [ ] Rate limiting at infrastructure level
- [ ] DDoS protection enabled
- [ ] HTTPS only (TLS 1.2+)
- [ ] CORS configured for production domains only

### 3. Database Security
- [ ] Database not publicly accessible
- [ ] Backup encryption enabled
- [ ] Point-in-time recovery configured
- [ ] Query logging enabled
- [ ] Connection pooling configured

## Support and Escalation

### On-Call Contacts
- **Backend Team:** backend@rappit.com
- **DevOps Team:** devops@rappit.com
- **Security Team:** security@rappit.com
- **Emergency Hotline:** +1-XXX-XXX-XXXX

### Escalation Path
1. Check monitoring dashboards
2. Review application logs
3. Contact backend team
4. If critical: Page on-call engineer
5. If security: Contact security team immediately

## Documentation Links

- [Production Safety Gates](./PRODUCTION_SAFETY_GATES.md)
- [API Documentation](https://api.rappit.com/api/docs)
- [Grafana Dashboards](https://grafana.rappit.com)
- [Sentry Error Tracking](https://sentry.io)

---

## Sign-Off

Before deploying to production, this checklist must be reviewed and signed off by:

- [ ] Backend Engineer: ________________ Date: ________
- [ ] DevOps Engineer: ________________ Date: ________
- [ ] Security Review: _________________ Date: ________
- [ ] Technical Lead: __________________ Date: ________

**Deployment Date:** ________________  
**Deployed By:** ____________________  
**Approved By:** ____________________
