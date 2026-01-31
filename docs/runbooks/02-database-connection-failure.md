# Database Connection Failure

## Alert Definition

**Trigger:** Database connection errors exceed 10 per minute
**Metric:** `postgres_connection_errors_total` rate > 10/min
**Severity:** Critical
**PagerDuty Service:** RAPPIT-Core

## Impact Assessment

### Affected Systems
- All API endpoints
- Order processing
- Inventory management
- User authentication
- Billing operations

### Business Impact
- Complete service outage possible
- Data consistency risks
- Customer-facing errors on all pages
- Revenue impact (no orders can process)

## Diagnostic Steps

### 1. Check Database Connectivity
```bash
# Test PostgreSQL connection
psql -h db.rappit.io -U rappit_app -d rappit_prod -c "SELECT 1"

# Check from application pod
kubectl exec -it deployment/rappit-api -n production -- \
  node -e "require('@prisma/client').PrismaClient().connect()"
```

### 2. Check Database Health
```bash
# Active connections
psql -h db.rappit.io -U rappit_admin -c \
  "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'"

# Connection pool status
psql -h db.rappit.io -U rappit_admin -c \
  "SELECT * FROM pg_stat_activity WHERE application_name LIKE 'rappit%'"
```

### 3. Check Database Resources
```bash
# AWS RDS metrics (if using RDS)
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=rappit-prod \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average
```

### 4. Check Network
```bash
# DNS resolution
dig db.rappit.io

# Network path
traceroute db.rappit.io
```

## Remediation Steps

### Immediate Actions

1. **Restart connection pools**
```bash
# Rolling restart of API pods
kubectl rollout restart deployment/rappit-api -n production
```

2. **Check for long-running queries**
```sql
-- Kill long-running queries (> 5 min)
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'active' 
  AND query_start < NOW() - INTERVAL '5 minutes'
  AND pid != pg_backend_pid();
```

3. **Scale API to reduce connection pressure**
```bash
kubectl scale deployment rappit-api --replicas=3 -n production
```

### Extended Actions

1. **Increase connection pool size**
```bash
kubectl set env deployment/rappit-api DATABASE_POOL_SIZE=50 -n production
```

2. **Enable read replicas** (if available)
```bash
kubectl set env deployment/rappit-api DATABASE_READ_REPLICA_URL=... -n production
```

3. **Database failover** (AWS RDS)
```bash
aws rds reboot-db-instance --db-instance-identifier rappit-prod --force-failover
```

## Escalation Path

| Time | Action |
|------|--------|
| 0-5 min | On-call: Basic connectivity checks |
| 5-15 min | DBA on-call |
| 15-30 min | Infrastructure Lead |
| 30+ min | Incident Commander declared |

### Contacts
- **DBA On-Call:** #database-oncall
- **AWS Support:** Case if RDS issue
- **Slack:** #incident-response
