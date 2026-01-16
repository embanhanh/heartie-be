import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';

export class LowStockQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({ description: 'Lọc theo chi nhánh để xem tồn kho thấp', example: 1 })
  branchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({
    description: 'Ngưỡng tồn kho cảnh báo. Sản phẩm có tổng stock ≤ threshold sẽ xuất hiện.',
    example: 5,
  })
  threshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100)
  @ApiPropertyOptional({
    description: 'Số lượng sản phẩm tối đa cần lấy (tối đa 100)',
    example: 20,
  })
  limit?: number;
}
