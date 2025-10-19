import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationOptionsDto } from 'src/common/dto/pagination.dto';
import { AdsAiStatus } from '../entities/ads-ai-campaign.entity';

export class AdsAiQueryDto extends PaginationOptionsDto {
  @ApiPropertyOptional({ description: 'Lọc theo trạng thái chiến dịch' })
  @IsOptional()
  @IsEnum(AdsAiStatus)
  status?: AdsAiStatus;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên chiến dịch hoặc sản phẩm' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc từ ngày lên lịch', type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  scheduledFrom?: string;

  @ApiPropertyOptional({ description: 'Lọc đến ngày lên lịch', type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  scheduledTo?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo khoảng thời gian tạo chiến dịch (ISO string)',
    type: String,
  })
  @IsOptional()
  @Type(() => Date)
  createdFrom?: Date;

  @ApiPropertyOptional({
    description: 'Lọc theo khoảng thời gian tạo chiến dịch (ISO string)',
    type: String,
  })
  @IsOptional()
  @Type(() => Date)
  createdTo?: Date;
}
