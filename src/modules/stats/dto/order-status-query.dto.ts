import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { DateRangeQueryDto } from './date-range-query.dto';

export class OrderStatusQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({ description: 'ID chi nhánh để thống kê trạng thái đơn', example: 5 })
  branchId?: number;
}
