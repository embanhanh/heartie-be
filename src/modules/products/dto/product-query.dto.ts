import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationOptionsDto } from 'src/common/dto/pagination.dto';

function toNumberArray(value: unknown): number[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const source: Array<string | number> = Array.isArray(value)
    ? (value as Array<string | number>)
    : typeof value === 'string'
      ? value.split(',')
      : typeof value === 'number'
        ? [value]
        : [];

  const rawStrings = source
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : [String(item)]))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const numbers = rawStrings
    .map((part) => Number(part))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.trunc(item));

  return numbers.length ? numbers : undefined;
}

export class ProductQueryDto extends PaginationOptionsDto {
  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm fuzzy áp dụng cho tên sản phẩm, mô tả, thương hiệu và danh mục.',
    example: 'samsung galaxy s24 ultra',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo danh sách categoryId (truyền ?categoryIds=1,2,3 hoặc lặp lại tham số).',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsOptional()
  @Transform(({ value }) => toNumberArray(value))
  @IsArray()
  @IsInt({ each: true })
  categoryIds?: number[];

  @ApiPropertyOptional({
    description: 'Lọc theo danh sách màu sắc (truyền ?colors=red,blue,green hoặc lặp lại tham số).',
    type: [String],
    example: ['red', 'blue', 'green'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colors?: string[];

  @ApiPropertyOptional({
    description:
      'Lọc theo danh sách kích thước (truyền ?sizes=small,medium,large hoặc lặp lại tham số).',
    type: [String],
    example: ['small', 'medium', 'large'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sizes?: string[];

  @ApiPropertyOptional({
    description: 'Lọc sản phẩm có giá >= priceMin.',
    example: 100000,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @ApiPropertyOptional({
    description: 'Lọc sản phẩm có giá <= priceMax.',
    example: 2000000,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(0)
  priceMax?: number;
}
