-- ============================================================================
-- FedEx Integration Monitoring Dashboard
-- 
-- SQL queries for monitoring FedEx integration health, performance, and usage
-- ============================================================================

-- ============================================================================
-- SUCCESS/FAILURE RATES
-- ============================================================================

-- Overall success rate (last 24 hours)
SELECT 
  COUNT(*) as total_requests,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful_requests,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed_requests,
  ROUND(100.0 * SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate_percent
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '24 hours';

-- Success rate by endpoint (last 24 hours)
SELECT 
  endpoint,
  COUNT(*) as total_requests,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY total_requests DESC;

-- Daily success rate trend (last 7 days)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================================
-- PERFORMANCE METRICS
-- ============================================================================

-- Average response times by endpoint (last 24 hours)
SELECT 
  endpoint,
  COUNT(*) as request_count,
  ROUND(AVG(duration_ms)::numeric, 2) as avg_duration_ms,
  ROUND(MAX(duration_ms)::numeric, 2) as max_duration_ms,
  ROUND(MIN(duration_ms)::numeric, 2) as min_duration_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) as p50_duration_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) as p95_duration_ms,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) as p99_duration_ms
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '24 hours'
  AND duration_ms IS NOT NULL
GROUP BY endpoint
ORDER BY avg_duration_ms DESC;

-- Slow requests (>5 seconds, last 24 hours)
SELECT 
  id,
  endpoint,
  method,
  duration_ms,
  created_at,
  error_message
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '24 hours'
  AND duration_ms > 5000
ORDER BY duration_ms DESC
LIMIT 20;

-- Response time trend (last 7 days, daily average)
SELECT 
  DATE(created_at) as date,
  endpoint,
  COUNT(*) as request_count,
  ROUND(AVG(duration_ms)::numeric, 2) as avg_duration_ms
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '7 days'
  AND duration_ms IS NOT NULL
GROUP BY DATE(created_at), endpoint
ORDER BY date DESC, endpoint;

-- ============================================================================
-- ERROR ANALYSIS
-- ============================================================================

-- Most common errors (last 24 hours)
SELECT 
  error_message,
  COUNT(*) as error_count,
  MAX(created_at) as last_occurrence
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '24 hours'
  AND error_message IS NOT NULL
GROUP BY error_message
ORDER BY error_count DESC
LIMIT 20;

-- Errors by status code (last 24 hours)
SELECT 
  status_code,
  COUNT(*) as error_count,
  ARRAY_AGG(DISTINCT SUBSTRING(error_message, 1, 100)) as sample_errors
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '24 hours'
  AND error_message IS NOT NULL
GROUP BY status_code
ORDER BY error_count DESC;

-- Recent errors (last 50)
SELECT 
  id,
  endpoint,
  method,
  status_code,
  error_message,
  duration_ms,
  created_at
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND error_message IS NOT NULL
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- SHIPMENT STATISTICS
-- ============================================================================

-- Shipment creation statistics (last 24 hours)
SELECT 
  COUNT(*) as total_shipments,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful_shipments,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed_shipments,
  ROUND(AVG(duration_ms)::numeric, 2) as avg_creation_time_ms
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND endpoint LIKE '%/ship/v1/shipments'
  AND method = 'POST'
  AND created_at > NOW() - INTERVAL '24 hours';

-- Shipment creation trend (last 7 days)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_shipments,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND endpoint LIKE '%/ship/v1/shipments'
  AND method = 'POST'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Shipment status by organization (last 24 hours)
SELECT 
  organization_id,
  COUNT(*) as total_shipments,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND endpoint LIKE '%/ship/v1/shipments'
  AND method = 'POST'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY organization_id
ORDER BY total_shipments DESC
LIMIT 20;

-- ============================================================================
-- TRACKING STATISTICS
-- ============================================================================

-- Tracking lookup statistics (last 24 hours)
SELECT 
  COUNT(*) as total_tracking_requests,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful_requests,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed_requests,
  ROUND(AVG(duration_ms)::numeric, 2) as avg_lookup_time_ms
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND endpoint LIKE '%/track/v1/trackingnumbers'
  AND created_at > NOW() - INTERVAL '24 hours';

-- Tracking update frequency (last 24 hours)
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as tracking_requests
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND endpoint LIKE '%/track/v1/trackingnumbers'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- ============================================================================
-- USAGE BY ORGANIZATION
-- ============================================================================

-- API usage by organization (last 24 hours)
SELECT 
  organization_id,
  COUNT(*) as total_requests,
  COUNT(DISTINCT endpoint) as unique_endpoints,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed,
  ROUND(AVG(duration_ms)::numeric, 2) as avg_duration_ms
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY organization_id
ORDER BY total_requests DESC;

-- Top API users (last 7 days)
SELECT 
  organization_id,
  COUNT(*) as total_requests,
  DATE(MIN(created_at)) as first_request,
  DATE(MAX(created_at)) as last_request
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY organization_id
ORDER BY total_requests DESC
LIMIT 20;

-- ============================================================================
-- OAUTH TOKEN HEALTH
-- ============================================================================

-- OAuth token requests (last 24 hours)
SELECT 
  COUNT(*) as token_requests,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed,
  ROUND(AVG(duration_ms)::numeric, 2) as avg_duration_ms
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND endpoint LIKE '%/oauth/token'
  AND created_at > NOW() - INTERVAL '24 hours';

-- Failed token requests (last 24 hours)
SELECT 
  id,
  organization_id,
  error_message,
  status_code,
  created_at
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND endpoint LIKE '%/oauth/token'
  AND error_message IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- ============================================================================
-- RATE LIMITING
-- ============================================================================

-- Requests per minute (last hour)
SELECT 
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as requests_per_minute
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY DATE_TRUNC('minute', created_at)
ORDER BY minute DESC;

-- 429 (Rate Limit) errors (last 24 hours)
SELECT 
  COUNT(*) as rate_limit_errors,
  MAX(created_at) as last_occurrence
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND status_code = 429
  AND created_at > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- SYSTEM HEALTH SUMMARY
-- ============================================================================

-- Overall system health (last 24 hours)
SELECT 
  'FedEx Integration' as component,
  COUNT(*) as total_requests,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate,
  ROUND(AVG(duration_ms)::numeric, 2) as avg_duration_ms,
  MAX(created_at) as last_request
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '24 hours';

-- Alerts (potential issues)
SELECT 
  'High Error Rate' as alert_type,
  COUNT(*) as affected_requests,
  'Last hour' as time_window
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '1 hour'
  AND error_message IS NOT NULL
HAVING COUNT(*) > 10

UNION ALL

SELECT 
  'Slow Response Times' as alert_type,
  COUNT(*) as affected_requests,
  'Last hour' as time_window
FROM integration_logs
WHERE integration_type = 'FEDEX'
  AND created_at > NOW() - INTERVAL '1 hour'
  AND duration_ms > 5000

UNION ALL

SELECT 
  'No Recent Activity' as alert_type,
  0 as affected_requests,
  'Last hour' as time_window
WHERE NOT EXISTS (
  SELECT 1 FROM integration_logs
  WHERE integration_type = 'FEDEX'
    AND created_at > NOW() - INTERVAL '1 hour'
);
