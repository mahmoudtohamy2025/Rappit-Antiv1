# High Queue Depth

## Alert Definition

**Trigger:** Queue depth exceeds 1,000 jobs for more than 5 minutes
**Metric:** `queue_depth_total{status="waiting"} > 1000`
**Severity:** Critical
**PagerDuty Service:** RAPPIT-Core

## Impact Assessment

### Affected Systems
- Order processing delays
- Inventory reservation timeouts
- Shipping label generation backlog
- Customer-facing order status delays

### Business Impact
- SLA breach risk for order fulfillment
- Potential overselling if inventory reservations queue
- Customer complaints about slow order updates

## Diagnostic Steps

### 1. Identify Affected Queue(s)
```bash
# Check Prometheus for queue depths
curl -s 'http://localhost:9090/api/v1/query?query=queue_depth_total' | jq '.data.result'

# Expected queues: orders, inventory, shipping
```

### 2. Check Worker Health
```bash
# Verify worker pods are running
kubectl get pods -l app=rappit-worker -n production

# Check worker logs for errors
kubectl logs -l app=rappit-worker -n production --tail=100
```

### 3. Check Redis Health
```bash
# Redis connection test
redis-cli -h redis.rappit.io ping

# Memory usage
redis-cli -h redis.rappit.io info memory | grep used_memory_human
```

### 4. Check for Upstream Issues
- Database connection errors
- External API timeouts (Shopify, WooCommerce, carriers)
- Memory pressure on workers

## Remediation Steps

### Immediate Actions

1. **Scale up workers**
```bash
kubectl scale deployment rappit-worker --replicas=10 -n production
```

2. **Check for stuck jobs**
```bash
# List failed jobs in last hour
redis-cli -h redis.rappit.io lrange bull:orders:failed 0 10
```

3. **Clear poison pill jobs (if identified)**
```bash
# Move specific job to DLQ
curl -X POST http://api.rappit.io/admin/jobs/{jobId}/move-to-dlq
```

### Extended Actions

1. **Pause incoming webhooks** (if needed)
```bash
kubectl patch deployment rappit-webhook --patch '{"spec":{"replicas":0}}' -n production
```

2. **Increase worker concurrency**
```bash
kubectl set env deployment/rappit-worker QUEUE_CONCURRENCY=20 -n production
```

## Escalation Path

| Time | Action |
|------|--------|
| 0-15 min | On-call engineer diagnoses |
| 15-30 min | Escalate to Senior Engineer |
| 30+ min | Escalate to Engineering Lead |
| 60+ min | Incident Commander + Status page update |

### Contacts
- **Slack:** #incident-response
- **PagerDuty:** Auto-escalation enabled
- **Email:** oncall@rappit.io
