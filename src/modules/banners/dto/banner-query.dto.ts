import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationOptionsDto } from 'src/common/dto/pagination.dto';
import { BannerStatus } from '../entities/banner.entity';

export class BannerQueryDto extends PaginationOptionsDto {
  @ApiPropertyOptional({ enum: BannerStatus, description: 'Lọc theo trạng thái banner' })
  @IsEnum(BannerStatus)
  @IsOptional()
  status?: BannerStatus;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tiêu đề (LIKE %%title%%)', type: String })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'startDate >= startDateFrom',
    type: String,
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  startDateFrom?: string;

  @ApiPropertyOptional({
    description: 'startDate <= startDateTo',
    type: String,
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  startDateTo?: string;

  @ApiPropertyOptional({
    description: 'endDate >= endDateFrom',
    type: String,
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  endDateFrom?: string;

  @ApiPropertyOptional({
    description: 'endDate <= endDateTo',
    type: String,
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  endDateTo?: string;
}
