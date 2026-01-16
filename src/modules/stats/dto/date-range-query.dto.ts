import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class DateRangeQueryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @ApiPropertyOptional({
    description: 'Ngày bắt đầu (ISO 8601). Mặc định sẽ tự động lùi theo phạm vi yêu cầu.',
    type: String,
    example: '2025-11-01',
  })
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @ApiPropertyOptional({
    description: 'Ngày kết thúc (ISO 8601). Nếu bỏ trống sẽ lấy hiện tại.',
    type: String,
    example: '2025-11-30',
  })
  to?: Date;
}
