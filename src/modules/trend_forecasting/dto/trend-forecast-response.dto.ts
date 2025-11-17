import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrendGranularity, TREND_GRANULARITIES } from './trend-forecast-query.dto';

class TrendSeriesPointDto {
  @ApiProperty({
    description: 'Thời điểm (ISO string) của kỳ thống kê sau khi chuẩn hóa theo granularity',
  })
  period!: string;

  @ApiProperty({ description: 'Tổng doanh thu (VND) trong kỳ', example: 125000000 })
  revenue!: number;

  @ApiProperty({ description: 'Số đơn hàng hoàn tất', example: 42 })
  orderCount!: number;

  @ApiProperty({ description: 'Tổng số sản phẩm bán ra', example: 130 })
  unitsSold!: number;

  @ApiProperty({ description: 'Giá trị đơn hàng trung bình', example: 2976190.48 })
  averageOrderValue!: number;
}

class ForecastPointDto {
  @ApiProperty({ description: 'Thời điểm dự báo tiếp theo (ISO string)' })
  period!: string;

  @ApiProperty({ description: 'Doanh thu dự báo (VND)', example: 142000000 })
  expectedRevenue!: number;

  @ApiProperty({ description: 'Số đơn dự báo', example: 50 })
  expectedOrders!: number;

  @ApiProperty({ description: 'Số lượng sản phẩm dự báo bán ra', example: 158 })
  expectedUnits!: number;

  @ApiProperty({ description: 'Giá trị đơn hàng trung bình dự báo', example: 2840000 })
  expectedAverageOrderValue!: number;
}

class SentimentBreakdownDto {
  @ApiProperty({ example: 0.62 })
  positive!: number;

  @ApiProperty({ example: 0.28 })
  neutral!: number;

  @ApiProperty({ example: 0.1 })
  negative!: number;
}

class TopProductSignalDto {
  @ApiProperty()
  productId!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  revenue!: number;

  @ApiProperty({
    description: 'Tỷ trọng doanh thu so với tổng doanh thu trong giai đoạn phân tích',
  })
  revenueShare!: number;
}

class EngagementSignalDto {
  @ApiProperty()
  metric!: string;

  @ApiProperty()
  count!: number;
}

class TrendSignalsDto {
  @ApiProperty({ description: 'Điểm sentiment chuẩn hóa (-1 đến 1)', example: 0.44 })
  sentimentScore!: number;

  @ApiProperty({ type: SentimentBreakdownDto })
  sentimentBreakdown!: SentimentBreakdownDto;

  @ApiProperty({ type: [TopProductSignalDto] })
  topProducts!: TopProductSignalDto[];

  @ApiProperty({ type: [EngagementSignalDto] })
  engagementSignals!: EngagementSignalDto[];
}

class TrendSummaryDto {
  @ApiProperty({ enum: ['rising', 'stable', 'declining'] })
  revenueTrend!: 'rising' | 'stable' | 'declining';

  @ApiProperty({ enum: ['rising', 'stable', 'declining'] })
  ordersTrend!: 'rising' | 'stable' | 'declining';

  @ApiProperty({ enum: ['rising', 'stable', 'declining'] })
  unitsTrend!: 'rising' | 'stable' | 'declining';

  @ApiProperty({
    description: 'Tốc độ tăng trưởng doanh thu dự kiến kỳ tới (percent)',
    example: 0.12,
  })
  expectedRevenueGrowthRate!: number;

  @ApiProperty({ description: 'Doanh thu dự báo kỳ kế tiếp', example: 148000000 })
  expectedNextRevenue!: number;

  @ApiProperty({
    description: 'Thông điệp chốt dành cho đội vận hành',
    example: 'Doanh thu đang tăng nhanh, đảm bảo bổ sung tồn kho các sản phẩm bán chạy.',
  })
  narrative!: string;

  @ApiPropertyOptional({ description: 'Gợi ý hành động ưu tiên' })
  recommendedActions?: string[];

  @ApiPropertyOptional({ description: 'Những rủi ro cần lưu ý' })
  riskAlerts?: string[];
}

class TrendDiagnosticsDto {
  @ApiProperty()
  dataPoints!: number;

  @ApiProperty()
  revenueSlope!: number;

  @ApiProperty()
  ordersSlope!: number;

  @ApiProperty()
  unitsSlope!: number;

  @ApiPropertyOptional({ description: 'Độ phù hợp của mô hình dự báo (0-1)' })
  revenueRSquared?: number;

  @ApiPropertyOptional({ description: 'Độ phù hợp của mô hình dự báo (0-1)' })
  ordersRSquared?: number;

  @ApiPropertyOptional({ description: 'Độ phù hợp của mô hình dự báo (0-1)' })
  unitsRSquared?: number;
}

export class TrendForecastResponseDto {
  @ApiProperty({ enum: TREND_GRANULARITIES })
  granularity!: TrendGranularity;

  @ApiProperty()
  generatedAt!: string;

  @ApiProperty()
  lookbackMonths!: number;

  @ApiProperty()
  forecastPeriods!: number;

  @ApiProperty({ type: [TrendSeriesPointDto] })
  timeSeries!: TrendSeriesPointDto[];

  @ApiProperty({ type: [ForecastPointDto] })
  forecast!: ForecastPointDto[];

  @ApiProperty({ type: TrendSummaryDto })
  summary!: TrendSummaryDto;

  @ApiProperty({ type: TrendSignalsDto })
  signals!: TrendSignalsDto;

  @ApiProperty({ type: TrendDiagnosticsDto })
  diagnostics!: TrendDiagnosticsDto;
}
