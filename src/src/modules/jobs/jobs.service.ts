import { Injectable, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('orders') private ordersQueue: Queue,
    @InjectQueue('inventory') private inventoryQueue: Queue,
    @InjectQueue('shipping') private shippingQueue: Queue,
    private prisma: PrismaService,
  ) { }

  async queueOrderImport(channelId: string, externalOrderId: string) {
    const job = await this.ordersQueue.add(
      'import-order',
      {
        channelId,
        externalOrderId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(`Queued order import job: ${job.id}`);
    return { jobId: job.id };
  }

  async queueInventoryReservation(orderId: string) {
    const job = await this.inventoryQueue.add(
      'reserve-inventory',
      {
        orderId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    this.logger.log(`Queued inventory reservation job: ${job.id}`);
    return { jobId: job.id };
  }

  async queueShipmentCreation(orderId: string, provider: string, options: any) {
    const job = await this.shippingQueue.add(
      'create-shipment',
      {
        orderId,
        provider,
        options,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(`Queued shipment creation job: ${job.id}`);
    return { jobId: job.id };
  }

  async queueTrackingUpdate(shipmentId: string) {
    const job = await this.shippingQueue.add(
      'update-tracking',
      {
        shipmentId,
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    this.logger.log(`Queued tracking update job: ${job.id}`);
    return { jobId: job.id };
  }

  async getJobStatus(queueName: string, jobId: string) {
    let queue: Queue;
    switch (queueName) {
      case 'orders':
        queue = this.ordersQueue;
        break;
      case 'inventory':
        queue = this.inventoryQueue;
        break;
      case 'shipping':
        queue = this.shippingQueue;
        break;
      default:
        throw new Error('Invalid queue name');
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    return {
      id: job.id,
      name: job.name,
      state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  async getQueueStats(queueName: string) {
    let queue: Queue;
    switch (queueName) {
      case 'orders':
        queue = this.ordersQueue;
        break;
      case 'inventory':
        queue = this.inventoryQueue;
        break;
      case 'shipping':
        queue = this.shippingQueue;
        break;
      default:
        throw new Error('Invalid queue name');
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  async getAllQueueStats() {
    const [orders, inventory, shipping] = await Promise.all([
      this.getQueueStats('orders'),
      this.getQueueStats('inventory'),
      this.getQueueStats('shipping'),
    ]);

    return { orders, inventory, shipping };
  }

  /**
   * QUEUE-04: Get queue metrics for monitoring dashboards
   * Returns real-time metrics with timestamp and aggregated totals
   */
  async getQueueMetrics() {
    const [orders, inventory, shipping] = await Promise.all([
      this.getQueueStats('orders'),
      this.getQueueStats('inventory'),
      this.getQueueStats('shipping'),
    ]);

    // Calculate totals
    const totals = {
      waiting: orders.waiting + inventory.waiting + shipping.waiting,
      active: orders.active + inventory.active + shipping.active,
      completed: orders.completed + inventory.completed + shipping.completed,
      failed: orders.failed + inventory.failed + shipping.failed,
      delayed: orders.delayed + inventory.delayed + shipping.delayed,
    };

    return {
      orders,
      inventory,
      shipping,
      totals,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // QUEUE-02: Back-Pressure Protection Methods
  // ============================================================================

  private readonly DEFAULT_MAX_DEPTH = 10000;

  /**
   * Check queue depth and throw 429 if at/above threshold
   * High-priority jobs (priority <= 1) bypass back-pressure
   */
  private async checkBackPressure(
    queue: Queue,
    queueName: string,
    options?: { priority?: number },
  ): Promise<void> {
    // High-priority jobs bypass back-pressure
    if (options?.priority !== undefined && options.priority <= 1) {
      return;
    }

    let depth: number;
    try {
      depth = await queue.getWaitingCount();
    } catch (error) {
      // Fail-open: if we can't check depth, allow the job through
      this.logger.warn(`Failed to check queue depth for ${queueName}: ${error.message}`);
      return;
    }

    const threshold = parseInt(process.env.QUEUE_MAX_DEPTH || String(this.DEFAULT_MAX_DEPTH), 10);

    if (depth >= threshold) {
      this.logger.warn(
        `Back-pressure triggered for queue ${queueName}: depth ${depth} >= threshold ${threshold}`,
      );
      throw new HttpException(
        `Queue ${queueName} is at capacity (${depth}/${threshold}). Please retry later.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Queue order import with back-pressure protection
   */
  async queueOrderImportWithBackPressure(
    channelId: string,
    externalOrderId: string,
    organizationId: string,
    options?: { priority?: number },
  ) {
    await this.checkBackPressure(this.ordersQueue, 'orders', options);

    const job = await this.ordersQueue.add(
      'import-order',
      { channelId, externalOrderId, organizationId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        priority: options?.priority,
      },
    );

    this.logger.log(`Queued order import job with back-pressure check: ${job.id}`);
    return { jobId: job.id };
  }

  /**
   * Queue inventory reservation with back-pressure protection
   */
  async queueInventoryReservationWithBackPressure(
    orderId: string,
    organizationId: string,
    options?: { priority?: number },
  ) {
    await this.checkBackPressure(this.inventoryQueue, 'inventory', options);

    const job = await this.inventoryQueue.add(
      'reserve-inventory',
      { orderId, organizationId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        priority: options?.priority,
      },
    );

    this.logger.log(`Queued inventory reservation job with back-pressure check: ${job.id}`);
    return { jobId: job.id };
  }

  /**
   * Queue shipment creation with back-pressure protection
   */
  async queueShipmentCreationWithBackPressure(
    orderId: string,
    provider: string,
    shipmentOptions: any,
    organizationId: string,
    options?: { priority?: number },
  ) {
    await this.checkBackPressure(this.shippingQueue, 'shipping', options);

    const job = await this.shippingQueue.add(
      'create-shipment',
      { orderId, provider, options: shipmentOptions, organizationId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        priority: options?.priority,
      },
    );

    this.logger.log(`Queued shipment creation job with back-pressure check: ${job.id}`);
    return { jobId: job.id };
  }

  // ============================================================================
  // QUEUE-01: Dead-Letter Queue (DLQ) Methods
  // ============================================================================

  /**
   * Move a failed job to the Dead-Letter Queue
   */
  async moveToDLQ(queueName: string, failedJob: any, organizationId: string) {
    const dlqEntry = await this.prisma.deadLetterJob.create({
      data: {
        organizationId,
        originalQueue: queueName,
        jobName: failedJob.name,
        jobId: failedJob.id,
        payload: failedJob.data,
        error: failedJob.failedReason || 'Unknown error',
        stackTrace: failedJob.stacktrace || [],
        attemptsMade: failedJob.attemptsMade || 0,
      },
    });

    this.logger.warn(
      `Job ${failedJob.id} moved to DLQ for queue ${queueName}`,
    );

    return dlqEntry;
  }

  /**
   * List DLQ jobs for an organization with pagination
   */
  async listDLQJobs(
    organizationId: string,
    options: { page: number; limit: number },
  ) {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      this.prisma.deadLetterJob.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.deadLetterJob.count({ where: { organizationId } }),
    ]);

    return {
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single DLQ job by ID (org-scoped)
   */
  async getDLQJob(dlqJobId: string, organizationId: string) {
    const job = await this.prisma.deadLetterJob.findFirst({
      where: { id: dlqJobId, organizationId },
    });

    if (!job) {
      throw new NotFoundException('DLQ job not found');
    }

    return job;
  }

  /**
   * Retry a DLQ job by re-enqueuing to original queue
   */
  async retryDLQJob(dlqJobId: string, organizationId: string) {
    const dlqJob = await this.prisma.deadLetterJob.findFirst({
      where: { id: dlqJobId, organizationId },
    });

    if (!dlqJob) {
      throw new NotFoundException('DLQ job not found');
    }

    // Get the appropriate queue
    const queue = this.getQueueByName(dlqJob.originalQueue);

    // Re-enqueue the job
    const newJob = await queue.add(dlqJob.jobName, dlqJob.payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    // Delete from DLQ after successful re-queue
    await this.prisma.deadLetterJob.delete({
      where: { id: dlqJobId },
    });

    this.logger.log(
      `DLQ job ${dlqJobId} retried, new job ID: ${newJob.id}`,
    );

    return { newJobId: newJob.id };
  }

  /**
   * Delete a DLQ job (org-scoped)
   */
  async deleteDLQJob(dlqJobId: string, organizationId: string) {
    const dlqJob = await this.prisma.deadLetterJob.findFirst({
      where: { id: dlqJobId, organizationId },
    });

    if (!dlqJob) {
      throw new NotFoundException('DLQ job not found');
    }

    await this.prisma.deadLetterJob.delete({
      where: { id: dlqJobId },
    });

    this.logger.log(`DLQ job ${dlqJobId} deleted`);

    return { deleted: true };
  }

  /**
   * Cleanup expired DLQ entries (older than retention period)
   * Default: 14 days, configurable via DLQ_RETENTION_DAYS env
   */
  async cleanupExpiredDLQJobs() {
    const retentionDays = parseInt(process.env.DLQ_RETENTION_DAYS || '14', 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.deadLetterJob.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired DLQ jobs`);

    return { deletedCount: result.count };
  }

  /**
   * Helper to get queue by name
   */
  private getQueueByName(queueName: string): Queue {
    switch (queueName) {
      case 'orders':
        return this.ordersQueue;
      case 'inventory':
        return this.inventoryQueue;
      case 'shipping':
        return this.shippingQueue;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }
}
