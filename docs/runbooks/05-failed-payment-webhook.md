# Failed Payment Webhook

## Alert Definition

**Trigger:** Stripe webhook failures exceed 5 in 10 minutes
**Metric:** `stripe_webhook_failures_total` rate > 5/10min
**Severity:** Critical
**PagerDuty Service:** RAPPIT-Billing

## Impact Assessment

### Affected Systems
- Subscription status updates
- Payment confirmation
- Invoice generation
- Usage metering

### Business Impact
- Customers may lose access incorrectly
- Revenue tracking discrepancies
- Billing disputes
- Subscription lifecycle errors

## Diagnostic Steps

### 1. Check Stripe Dashboard
- Login to [Stripe Dashboard](https://dashboard.stripe.com)
- Navigate to Developers → Webhooks
- Review failed webhook attempts

### 2. Verify Webhook Endpoint Health
```bash
# Test webhook endpoint
curl -X POST https://api.rappit.io/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: test" \
  -d '{"type": "ping"}'

# Check endpoint logs
kubectl logs -l app=rappit-billing -n production --since=30m | grep -i "stripe\|webhook"
```

### 3. Verify Webhook Secret
```bash
# Compare webhook secret in Stripe vs environment
kubectl get secret rappit-billing-secrets -n production -o jsonpath='{.data.STRIPE_WEBHOOK_SECRET}' | base64 -d
```

### 4. Check for Endpoint Timeouts
```bash
# Review response times
kubectl logs -l app=rappit-billing -n production --since=1h | grep -i "timeout\|slow"

# Check if billing service is healthy
kubectl get pods -l app=rappit-billing -n production
```

## Remediation Steps

### Immediate Actions

1. **Restart billing service**
```bash
kubectl rollout restart deployment/rappit-billing -n production
```

2. **Retry failed webhooks in Stripe**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Find failed events
   - Click "Resend" for each

3. **Check webhook signature verification**
```bash
# Verify secret matches
kubectl exec -it deployment/rappit-billing -n production -- \
  printenv STRIPE_WEBHOOK_SECRET
```

### Extended Actions

1. **Manually sync subscription status**
```bash
# Sync all subscriptions from Stripe
curl -X POST http://api.rappit.io/admin/billing/sync-subscriptions \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

2. **Recreate webhook endpoint** (if secret compromised)
   - Delete old webhook in Stripe
   - Create new webhook with new secret
   - Update Kubernetes secret
   ```bash
   kubectl create secret generic rappit-billing-secrets \
     --from-literal=STRIPE_WEBHOOK_SECRET=whsec_newvalue \
     -n production --dry-run=client -o yaml | kubectl apply -f -
   ```

3. **Process missed events**
   - List events in Stripe API
   - Manually trigger processing for missed events
   ```bash
   curl https://api.stripe.com/v1/events?created[gte]=$(date -d '1 hour ago' +%s) \
     -u $STRIPE_SECRET_KEY:
   ```

## Escalation Path

| Time | Action |
|------|--------|
| 0-15 min | On-call: Verify webhook, restart service |
| 15-30 min | Billing Team Lead |
| 30-60 min | Stripe Support if API issue |
| 60+ min | Finance Team for revenue reconciliation |

### Contacts
- **Billing Team:** #billing-support
- **Stripe Support:** support.stripe.com
- **Finance:** finance@rappit.io
- **Slack:** #incident-response
