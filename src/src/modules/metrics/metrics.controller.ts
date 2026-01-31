import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { MetricsService } from './metrics.service';
import { Public } from '@common/decorators/public.decorator';

/**
 * MetricsController exposes Prometheus-compatible metrics endpoint
 * Accessible without authentication for Prometheus scraping
 */
@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
    constructor(private readonly metricsService: MetricsService) { }

    @Public()
    @Get()
    @ApiExcludeEndpoint() // Hide from Swagger UI
    @ApiOperation({ summary: 'Prometheus metrics endpoint' })
    async getMetrics(@Res() response: Response): Promise<void> {
        const metrics = await this.metricsService.getMetrics();
        response.set('Content-Type', this.metricsService.getContentType());
        response.send(metrics);
    }
}
