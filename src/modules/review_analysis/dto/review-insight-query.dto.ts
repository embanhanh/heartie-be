import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';
import { ReviewSentiment } from '../entities/review-insight.entity';

export class ReviewInsightQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(1)
  ratingId?: number;

  @IsOptional()
  @IsEnum(['positive', 'negative', 'neutral'], {
    message: 'sentiment must be one of positive, negative, neutral',
  })
  sentiment?: ReviewSentiment;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : 20))
  @IsInt()
  @IsPositive()
  @Max(100)
  limit = 20;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : 1))
  @IsInt()
  @IsPositive()
  page = 1;
}
