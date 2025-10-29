import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationOptionsDto } from 'src/common/dto/pagination.dto';

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export class RatingsQueryDto extends PaginationOptionsDto {
  @ApiPropertyOptional({ description: 'Filter by product id', example: 42 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number;

  @ApiPropertyOptional({ description: 'Filter by user id', example: 7 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({
    description: 'Only include ratings created at or after this ISO-8601 timestamp',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeDate(value))
  @IsDateString()
  createdAtFrom?: string;

  @ApiPropertyOptional({
    description: 'Only include ratings created at or before this ISO-8601 timestamp',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeDate(value))
  @IsDateString()
  createdAtTo?: string;
}
