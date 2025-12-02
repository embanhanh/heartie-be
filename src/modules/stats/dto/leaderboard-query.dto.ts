import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Max } from 'class-validator';

export class LeaderboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({ description: 'Lọc lượt xem theo chi nhánh cụ thể', example: 2 })
  branchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(50)
  @ApiPropertyOptional({ description: 'Số lượng phần tử top cần trả về (tối đa 50)', example: 10 })
  limit?: number;
}
