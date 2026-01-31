# Memory/CPU Threshold

## Alert Definition

**Trigger:** Memory > 90% OR CPU > 95% sustained for 5 minutes
**Metrics:**
- `process_resident_memory_bytes / container_memory_limit > 0.9`
- `rate(process_cpu_seconds_total[5m]) > 0.95`
**Severity:** Warning
**PagerDuty Service:** RAPPIT-Infrastructure

## Impact Assessment

### Affected Systems
- Performance degradation across platform
- Request timeouts
- Potential OOM kills
- Service restarts

### Business Impact
- Slow API responses
- Failed order imports
- Customer-facing latency
- Potential data loss if OOM during transaction

## Diagnostic Steps

### 1. Identify Affected Pods
```bash
# Check pod resource usage
kubectl top pods -n production --sort-by=memory

# Get detailed pod metrics
kubectl describe pod <pod-name> -n production | grep -A5 "Resources:"
```

### 2. Check Memory Details
```bash
# Memory breakdown in container
kubectl exec -it <pod-name> -n production -- cat /proc/meminfo

# Node.js heap (if applicable)
kubectl exec -it <pod-name> -n production -- \
  node -e "console.log(process.memoryUsage())"
```

### 3. Check for Memory Leaks
```bash
# Look for growing heap over time
kubectl logs <pod-name> -n production --since=1h | grep -i "memory\|heap\|gc"

# Check Prometheus for memory trend
curl -s 'http://localhost:9090/api/v1/query_range?query=process_resident_memory_bytes&start=2h&step=5m'
```

### 4. Check CPU-Intensive Operations
```bash
# Current CPU processes
kubectl exec -it <pod-name> -n production -- top -b -n1

# Check for stuck/expensive queries
kubectl logs <pod-name> -n production --since=30m | grep -i "slow\|timeout\|expensive"
```

## Remediation Steps

### Immediate Actions

1. **Restart affected pods**
```bash
# Rolling restart (no downtime)
kubectl rollout restart deployment/rappit-api -n production
```

2. **Scale horizontally**
```bash
# Add more replicas to distribute load
kubectl scale deployment/rappit-api --replicas=6 -n production
```

3. **Increase resource limits** (temporary)
```bash
kubectl set resources deployment/rappit-api \
  --limits=memory=2Gi,cpu=2 \
  --requests=memory=1Gi,cpu=1 \
  -n production
```

### Extended Actions

1. **Enable aggressive GC** (Node.js)
```bash
kubectl set env deployment/rappit-api NODE_OPTIONS="--max-old-space-size=1536" -n production
```

2. **Profile application**
   - Enable heap snapshots
   - Check for connection leaks
   - Review recent deployments

3. **Tune JVM** (if Java-based services)
```bash
kubectl set env deployment/rappit-worker JAVA_OPTS="-Xmx1g -Xms512m" -n production
```

4. **Check for runaway processes**
```bash
# Find and kill expensive queries
psql -h db.rappit.io -U rappit_admin -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '10 minutes'"
```

## Escalation Path

| Time | Action |
|------|--------|
| 0-15 min | On-call: Scale and restart |
| 15-30 min | Platform Engineer |
| 30-60 min | Check recent deploys, rollback if needed |
| 60+ min | Engineering Lead for architecture review |

### Contacts
- **Platform Team:** #platform-engineering
- **Slack:** #incident-response
