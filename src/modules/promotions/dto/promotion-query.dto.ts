import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, IsDateString } from 'class-validator';
import { PaginationOptionsDto } from 'src/common/dto/pagination.dto';
import { ApplyScope, PromotionType } from '../entities/promotion.entity';

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'true' || normalized === '1') {
    return true;
  }

  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  return undefined;
}

export class PromotionQueryDto extends PaginationOptionsDto {
  @ApiPropertyOptional({
    description: 'Tìm kiếm theo tên hoặc mã khuyến mãi (LIKE %%value%%)',
    example: 'summer-sale',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: PromotionType, description: 'Lọc theo loại khuyến mãi' })
  @IsOptional()
  @IsEnum(PromotionType)
  type?: PromotionType;

  @ApiPropertyOptional({ enum: ApplyScope, description: 'Lọc theo phạm vi áp dụng' })
  @IsOptional()
  @IsEnum(ApplyScope)
  applyScope?: ApplyScope;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái kích hoạt', type: Boolean })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'startDate >= startDateFrom',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({
    description: 'startDate <= startDateTo',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  startDateTo?: string;

  @ApiPropertyOptional({
    description: 'endDate >= endDateFrom',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  endDateFrom?: string;

  @ApiPropertyOptional({
    description: 'endDate <= endDateTo',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  endDateTo?: string;
}
