import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class JobsController {
  constructor(private jobsService: JobsService) { }

  /**
   * QUEUE-04: Get queue metrics for monitoring dashboards
   * Access: ADMIN, MANAGER
   */
  @Get('metrics')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get queue metrics for all queues' })
  async getQueueMetrics() {
    return this.jobsService.getQueueMetrics();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get all queue statistics' })
  async getAllStats() {
    return this.jobsService.getAllQueueStats();
  }

  @Get(':queue/stats')
  @ApiOperation({ summary: 'Get queue statistics' })
  async getStats(@Param('queue') queue: string) {
    return this.jobsService.getQueueStats(queue);
  }

  @Get(':queue/:jobId')
  @ApiOperation({ summary: 'Get job status' })
  async getJobStatus(
    @Param('queue') queue: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.getJobStatus(queue, jobId);
  }
}
