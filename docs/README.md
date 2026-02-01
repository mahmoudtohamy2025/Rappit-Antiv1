# Rappit Documentation

Welcome to the Rappit documentation. This directory contains comprehensive guides for deploying, operating, and maintaining the Rappit platform.

## 📋 Quick Links

### Production Deployment
- **[Production Safety Gates](./PRODUCTION_SAFETY_GATES.md)** - Complete safety gates documentation
- **[Quick Reference Guide](./PRODUCTION_SAFETY_GATES_QUICK_REF.md)** - TL;DR for production deployment
- **[Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)** - Step-by-step deployment guide

## 🚦 Production Safety Gates

Before deploying to production, you must address all safety gates:

| Gate | Type | Description | Status |
|------|------|-------------|--------|
| **GATE-001** | NO-GO | Prisma Client Generation | ✅ Fixed |
| **GATE-002** | NO-GO | Carrier API Stubs | ⚠️ Config Required |
| **GATE-003** | NO-GO | Multi-Tenant Isolation | ✅ Verified |
| **GATE-004** | CONDITIONAL | OAuth Stubs | ✅ OK for Staging |
| **GATE-005** | CONDITIONAL | Inventory Concurrency | ✅ Verified |
| **GATE-006** | WARNING | Subscription Enforcement | ✅ Monitoring Active |
| **GATE-007** | WARNING | Rate Limiting | ✅ Observability Active |

### Critical Blockers (NO-GO)

These MUST be resolved before production deployment:

1. **GATE-001: Prisma Client Generation** ✅  
   Status: Fixed - CI now uses Prisma 5.22.0

2. **GATE-002: Carrier API Configuration** ⚠️  
   Status: Requires configuration - See [configuration guide](./PRODUCTION_SAFETY_GATES.md#gate-002-carrier-api-stubs-no-go)

3. **GATE-003: Multi-Tenant Isolation** ✅  
   Status: Tests passing - Run `npm run test:e2e:security`

## 📚 Documentation Structure

### For Developers
- **[PRODUCTION_SAFETY_GATES.md](./PRODUCTION_SAFETY_GATES.md)**  
  Comprehensive documentation of all 7 safety gates with resolution steps

- **[PRODUCTION_SAFETY_GATES_QUICK_REF.md](./PRODUCTION_SAFETY_GATES_QUICK_REF.md)**  
  Quick reference guide for rapid deployment decisions

### For DevOps
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)**  
  Complete deployment checklist with verification steps, monitoring setup, and rollback procedures

### Environment Configuration
- **[.env.example](../.env.example)**  
  Reference for all environment variables with production requirements noted

## 🚀 Quick Start - First Time Deployment

### 1. Review Documentation
```bash
# Read the quick reference first
cat docs/PRODUCTION_SAFETY_GATES_QUICK_REF.md

# Then review the full documentation
cat docs/PRODUCTION_SAFETY_GATES.md

# Follow the deployment checklist
cat docs/DEPLOYMENT_CHECKLIST.md
```

### 2. Verify Safety Gates
```bash
# Run all tests
npm run test:ci

# Security tests (GATE-003)
npm run test:e2e:security

# Concurrency tests (GATE-005)
npm run test:e2e:concurrent-inventory
```

### 3. Configure Production Environment
```bash
# Copy and configure production environment
cp .env.example .env.production

# Edit and set:
# - NODE_ENV=production
# - Production database URL
# - Production carrier API URLs (NOT sandbox)
# - All production API credentials
```

### 4. Deploy
```bash
# Application will validate configuration on startup
# Will exit with error if any NO-GO gate fails

docker run -d --env-file .env.production rappit:latest
```

## 🔍 What's New in This Release

### Safety Checks
- ✅ Automatic production safety validation on startup
- ✅ Prevents deployment with carrier API stubs
- ✅ Validates Prisma client generation
- ✅ Checks database configuration

### Monitoring & Observability
- ✅ Prometheus metrics endpoint at `/metrics`
- ✅ Rate limiting metrics
- ✅ Subscription enforcement metrics
- ✅ HTTP request metrics

### Documentation
- ✅ Complete production safety gates guide
- ✅ Step-by-step deployment checklist
- ✅ Quick reference guide
- ✅ Monitoring and alerting recommendations

## 🆘 Support

### Need Help?

| Resource | Description |
|----------|-------------|
| **Production Issues** | Contact: oncall@rappit.com |
| **Security Concerns** | Contact: security@rappit.com |
| **General Questions** | Contact: support@rappit.com |

### Emergency Contacts
- **Oncall Hotline:** +1-XXX-XXX-XXXX
- **Slack:** #rappit-oncall

## 📊 Monitoring

### Health Checks
```bash
# Application health
curl https://api.rappit.com/api/v1/health

# Prometheus metrics
curl https://api.rappit.com/metrics

# API documentation
open https://api.rappit.com/api/docs
```

### Key Metrics to Monitor

1. **Rate Limiting**
   - `rate_limit_hits_total` - Total rate limit checks
   - `rate_limit_blocks_total` - Blocked requests (429)
   - `rate_limit_remaining` - Remaining capacity

2. **Subscription Enforcement**
   - `subscription_blocks_total` - Write operations blocked

3. **API Performance**
   - `http_requests_total` - Request count
   - `http_request_duration_ms` - Response times

## 🔐 Security

### Security Checklist
- [ ] All secrets in secure vault (not in code)
- [ ] Database not publicly accessible
- [ ] API behind WAF
- [ ] HTTPS only (TLS 1.2+)
- [ ] CORS configured for production domains
- [ ] Rate limiting enabled
- [ ] Multi-tenant isolation verified

### Security Tests
```bash
# Run security test suite
npm run test:e2e:security

# Expected: All tests pass
# - Cross-tenant access blocked
# - SQL injection prevented
# - JWT validation working
```

## 📝 Version History

### 2024-02-01 - Production Safety Gates Implementation
- Implemented all 7 production safety gates
- Added automatic safety validation
- Enhanced monitoring and observability
- Created comprehensive documentation

---

## Contributing

When adding new features, please:
1. Update relevant safety gates documentation
2. Add appropriate metrics for monitoring
3. Update deployment checklist if needed
4. Run all security tests

---

Last Updated: 2024-02-01  
Maintained by: Rappit Backend Team
