import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Max } from 'class-validator';
import { DateRangeQueryDto } from './date-range-query.dto';

export class TopSellingQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({ description: 'ID chi nhánh cần xem danh sách bán chạy', example: 4 })
  branchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100)
  @ApiPropertyOptional({ description: 'Số sản phẩm tối đa cần trả về (tối đa 100)', example: 10 })
  limit?: number;
}
