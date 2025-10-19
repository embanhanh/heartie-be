import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { MetricsQueryDto } from './dto/metrics-query.dto';

@ApiTags('analytics')
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get aggregated product interaction metrics' })
  getMetrics(@Query() query: MetricsQueryDto) {
    return this.analyticsService.getMetrics({
      productVariantId: query.productVariantId,
      from: query.from,
      to: query.to,
      metricTypes: query.metricTypes,
    });
  }

  @Get('metrics/totals')
  @ApiOperation({ summary: 'Get total interaction counts for a product variant' })
  getMetricTotals(@Query() query: MetricsQueryDto) {
    return this.analyticsService.getTotals(query.productVariantId, query.from);
  }
}
