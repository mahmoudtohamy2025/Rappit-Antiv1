import { Injectable, Logger } from '@nestjs/common';
import * as client from 'prom-client';

/**
 * MetricsService manages Prometheus metrics collection and exposure
 */
@Injectable()
export class MetricsService {
    private readonly logger = new Logger(MetricsService.name);
    private readonly register: client.Registry;

    // HTTP Metrics
    private readonly httpRequestDuration: client.Histogram<string>;
    private readonly httpRequestsTotal: client.Counter<string>;

    // Queue Metrics
    private readonly queueDepth: client.Gauge<string>;

    // Business Metrics
    private readonly ordersProcessed: client.Counter<string>;
    private readonly shipmentsCreated: client.Counter<string>;

    constructor() {
        // Create a new registry to avoid polluting the global one
        this.register = new client.Registry();

        // Register default metrics (CPU, memory, etc.)
        client.collectDefaultMetrics({ register: this.register });

        // HTTP Request Duration Histogram
        this.httpRequestDuration = new client.Histogram({
            name: 'http_request_duration_seconds',
            help: 'HTTP request duration in seconds',
            labelNames: ['method', 'route', 'status'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
            registers: [this.register],
        });

        // HTTP Requests Counter
        this.httpRequestsTotal = new client.Counter({
            name: 'http_requests_total',
            help: 'Total HTTP requests',
            labelNames: ['method', 'route', 'status'],
            registers: [this.register],
        });

        // Queue Depth Gauge
        this.queueDepth = new client.Gauge({
            name: 'queue_depth_total',
            help: 'Current number of jobs in queue',
            labelNames: ['queue', 'status'],
            registers: [this.register],
        });

        // Orders Processed Counter
        this.ordersProcessed = new client.Counter({
            name: 'orders_processed_total',
            help: 'Total orders processed',
            labelNames: ['channel', 'status'],
            registers: [this.register],
        });

        // Shipments Created Counter
        this.shipmentsCreated = new client.Counter({
            name: 'shipments_created_total',
            help: 'Total shipments created',
            labelNames: ['carrier', 'status'],
            registers: [this.register],
        });

        this.logger.log('Prometheus metrics initialized');
    }

    /**
     * Get all metrics in Prometheus format
     */
    async getMetrics(): Promise<string> {
        return this.register.metrics();
    }

    /**
     * Get content type for Prometheus response
     */
    getContentType(): string {
        return this.register.contentType;
    }

    /**
     * Record HTTP request metrics
     */
    recordHttpRequest(method: string, route: string, status: number, durationMs: number): void {
        const durationSec = durationMs / 1000;
        const labels = { method, route, status: String(status) };

        this.httpRequestDuration.observe(labels, durationSec);
        this.httpRequestsTotal.inc(labels);
    }

    /**
     * Record queue depth metrics
     */
    recordQueueDepth(queue: string, waiting: number, active: number): void {
        this.queueDepth.set({ queue, status: 'waiting' }, waiting);
        this.queueDepth.set({ queue, status: 'active' }, active);
    }

    /**
     * Record order processed
     */
    recordOrderProcessed(channel: string, status: string): void {
        this.ordersProcessed.inc({ channel, status });
    }

    /**
     * Record shipment created
     */
    recordShipmentCreated(carrier: string, status: string): void {
        this.shipmentsCreated.inc({ carrier, status });
    }

    /**
     * Reset all metrics (for testing)
     */
    resetMetrics(): void {
        this.register.resetMetrics();
    }
}
