# Carrier API Outage

## Alert Definition

**Trigger:** Carrier API error rate exceeds 50% for 5 minutes
**Metric:** `carrier_api_errors_total / carrier_api_requests_total > 0.5`
**Severity:** Critical
**PagerDuty Service:** RAPPIT-Shipping

## Impact Assessment

### Affected Systems
- Shipping label generation
- Rate calculation
- Tracking updates
- Shipment creation

### Business Impact
- Orders cannot be fulfilled
- Warehouse operations blocked
- Customer shipping delays
- SLA breach for fulfillment partners

### Affected Carriers
- DHL Express
- FedEx
- (Check specific carrier in alert labels)

## Diagnostic Steps

### 1. Identify Affected Carrier
```bash
# Check error rates by carrier
curl -s 'http://localhost:9090/api/v1/query?query=carrier_api_errors_total' | jq '.data.result'
```

### 2. Check Carrier Status Pages
- **DHL:** https://status.dhl.com
- **FedEx:** https://status.fedex.com
- Check Twitter for carrier outage reports

### 3. Verify API Credentials
```bash
# Test DHL credentials
curl -X POST https://api.dhl.com/express/rates \
  -H "Authorization: Bearer $DHL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Test FedEx credentials
curl -X POST https://apis.fedex.com/rate/v1/rates/quotes \
  -H "Authorization: Bearer $FEDEX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### 4. Check Application Logs
```bash
# Search for carrier errors
kubectl logs -l app=rappit-shipping -n production --since=30m | grep -i "carrier\|dhl\|fedex"
```

## Remediation Steps

### Immediate Actions

1. **Enable carrier failover** (if available)
```bash
# Route DHL traffic to FedEx (or vice versa)
kubectl set env deployment/rappit-shipping CARRIER_FAILOVER=enabled -n production
```

2. **Queue shipments for retry**
```bash
# Mark pending shipments for retry when carrier recovers
curl -X POST http://api.rappit.io/admin/shipping/queue-retry \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"carrier": "DHL", "status": "CARRIER_ERROR"}'
```

3. **Notify warehouse operations**
```bash
# Send Slack notification
curl -X POST $WAREHOUSE_SLACK_WEBHOOK \
  -d '{"text": "⚠️ Carrier API outage detected. Manual shipment processing may be needed."}'
```

### Extended Actions

1. **Enable manual shipping mode**
   - Warehouse can generate labels via carrier portal
   - Update orders manually with tracking numbers

2. **Contact carrier support**
   - DHL Support: 1-800-225-5345
   - FedEx Support: 1-800-463-3339
   - Reference account numbers in Vault

3. **Rate limit outgoing requests**
```bash
kubectl set env deployment/rappit-shipping CARRIER_RATE_LIMIT=10 -n production
```

## Escalation Path

| Time | Action |
|------|--------|
| 0-15 min | On-call: Verify outage, check status pages |
| 15-30 min | Carrier Account Manager contact |
| 30-60 min | Warehouse Operations Lead notified |
| 60+ min | Customer Success for customer communication |

### Contacts
- **Shipping Ops:** #shipping-operations
- **Carrier Contacts:** Vault secret `carrier-support-contacts`
- **Slack:** #incident-response
