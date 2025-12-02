import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';
import { DateRangeQueryDto } from './date-range-query.dto';

export class RevenueChartQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({ description: 'ID chi nhánh cần lọc doanh thu', example: 1 })
  branchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(365)
  @ApiPropertyOptional({
    description: 'Giới hạn tối đa số điểm trả về (tự động gộp bucket nếu vượt). Tối đa 365.',
    example: 60,
  })
  maxPoints?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  @ApiPropertyOptional({
    description: 'Số ngày gộp vào một bucket khi xây biểu đồ. Tối thiểu 1, tối đa 31.',
    example: 7,
  })
  bucketDays?: number;
}
