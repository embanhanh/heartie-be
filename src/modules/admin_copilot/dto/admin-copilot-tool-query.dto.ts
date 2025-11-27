import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TrendGranularity } from '../../trend_forecasting/dto/trend-forecast-query.dto';

const RANGE_OPTIONS = ['7d', '30d', '90d'] as const;

type RangeOption = (typeof RANGE_OPTIONS)[number];

export class AdminCopilotRevenueOverviewQueryDto {
  @ApiPropertyOptional({ enum: RANGE_OPTIONS, default: '30d' })
  @IsOptional()
  @IsEnum(RANGE_OPTIONS)
  range?: RangeOption;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsEnum(['day', 'week', 'month'])
  granularity?: TrendGranularity;

  @ApiPropertyOptional({ minimum: 1, maximum: 12, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  forecastPeriods?: number;
}

export class AdminCopilotTopProductsQueryDto {
  @ApiPropertyOptional({ enum: RANGE_OPTIONS, default: '30d' })
  @IsOptional()
  @IsEnum(RANGE_OPTIONS)
  range?: RangeOption;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class AdminCopilotStockAlertsQueryDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 1000, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  threshold?: number;

  @ApiPropertyOptional({ description: 'Lọc theo chi nhánh cụ thể' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
