import { Injectable } from '@nestjs/common';
import { Counter, Gauge, register, Registry } from 'prom-client';

/**
 * Prometheus Metrics Service
 * 
 * Exposes application metrics for monitoring and observability.
 * Addresses GATE-007: Rate Limiting observability requirements.
 */
@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  // Rate Limiting Metrics
  private readonly rateLimitHitsCounter: Counter;
  private readonly rateLimitBlocksCounter: Counter;
  private readonly rateLimitRemainingGauge: Gauge;

  // Subscription Enforcement Metrics
  private readonly subscriptionBlocksCounter: Counter;
  
  // API Metrics
  private readonly httpRequestsTotal: Counter;
  private readonly httpRequestDuration: Gauge;

  constructor() {
    this.registry = register;

    // Rate Limiting Metrics
    this.rateLimitHitsCounter = new Counter({
      name: 'rate_limit_hits_total',
      help: 'Total number of requests that hit rate limits',
      labelNames: ['type', 'organization_id', 'endpoint'],
      registers: [this.registry],
    });

    this.rateLimitBlocksCounter = new Counter({
      name: 'rate_limit_blocks_total',
      help: 'Total number of requests blocked by rate limiting (HTTP 429)',
      labelNames: ['type', 'organization_id', 'endpoint'],
      registers: [this.registry],
    });

    this.rateLimitRemainingGauge = new Gauge({
      name: 'rate_limit_remaining',
      help: 'Remaining rate limit capacity',
      labelNames: ['type', 'organization_id', 'endpoint'],
      registers: [this.registry],
    });

    // Subscription Enforcement Metrics
    this.subscriptionBlocksCounter = new Counter({
      name: 'subscription_blocks_total',
      help: 'Total number of write operations blocked due to inactive subscription',
      labelNames: ['organization_id', 'subscription_status', 'endpoint'],
      registers: [this.registry],
    });

    // API Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Gauge({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route'],
      registers: [this.registry],
    });
  }

  recordRateLimitHit(type: string, organizationId?: string, endpoint?: string): void {
    this.rateLimitHitsCounter.inc({
      type,
      organization_id: organizationId || 'anonymous',
      endpoint: endpoint || 'unknown',
    });
  }

  recordRateLimitBlock(type: string, organizationId?: string, endpoint?: string): void {
    this.rateLimitBlocksCounter.inc({
      type,
      organization_id: organizationId || 'anonymous',
      endpoint: endpoint || 'unknown',
    });
  }

  updateRateLimitRemaining(type: string, remaining: number, organizationId?: string, endpoint?: string): void {
    this.rateLimitRemainingGauge.set(
      {
        type,
        organization_id: organizationId || 'anonymous',
        endpoint: endpoint || 'unknown',
      },
      remaining,
    );
  }

  recordSubscriptionBlock(organizationId: string, subscriptionStatus: string, endpoint: string): void {
    this.subscriptionBlocksCounter.inc({
      organization_id: organizationId,
      subscription_status: subscriptionStatus,
      endpoint,
    });
  }

  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    this.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode.toString(),
    });

    this.httpRequestDuration.set({ method, route }, durationMs);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  async getMetricsJSON(): Promise<any> {
    const metrics = await this.registry.getMetricsAsJSON();
    return metrics;
  }

  resetMetrics(): void {
    this.registry.resetMetrics();
  }
}
