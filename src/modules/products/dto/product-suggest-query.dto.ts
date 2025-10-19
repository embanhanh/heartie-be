import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

function normalizeKeyword(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

export class ProductSuggestQueryDto {
  @ApiProperty({ description: 'Từ khóa người dùng đang nhập để gợi ý autocomplete.' })
  @Transform(({ value }) => normalizeKeyword(value))
  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @ApiPropertyOptional({
    description: 'Số lượng gợi ý trả về',
    default: 10,
    minimum: 1,
    maximum: 20,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 10;
}
