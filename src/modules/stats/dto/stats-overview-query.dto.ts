import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { DateRangeQueryDto } from './date-range-query.dto';

export class StatsOverviewQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({
    description: 'ID chi nhánh cần lọc. Để trống để lấy toàn bộ hệ thống.',
    example: 3,
  })
  branchId?: number;
}
