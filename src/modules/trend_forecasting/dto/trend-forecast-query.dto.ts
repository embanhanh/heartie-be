import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export const TREND_GRANULARITIES = ['day', 'week', 'month'] as const;
export type TrendGranularity = (typeof TREND_GRANULARITIES)[number];

export class TrendForecastQueryDto {
  @IsOptional()
  @IsEnum(TREND_GRANULARITIES, {
    message: `granularity must be one of: ${TREND_GRANULARITIES.join(', ')}`,
  })
  granularity: TrendGranularity = 'week';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  lookbackMonths = 3;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  forecastPeriods = 4;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(1)
  productId?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(1)
  categoryId?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(1)
  branchId?: number;
}
