import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Monitoring')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description: 'Returns application metrics in Prometheus format',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics in Prometheus format',
    type: String,
  })
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }

  @Public()
  @Get('json')
  @ApiOperation({
    summary: 'Get metrics as JSON',
    description: 'Returns metrics in JSON format for debugging',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics in JSON format',
  })
  async getMetricsJSON(): Promise<any> {
    return this.metricsService.getMetricsJSON();
  }
}
