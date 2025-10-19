import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export class SortParam {
  @ApiPropertyOptional({
    description: 'Tên trường cần sắp xếp, có thể dùng dot notation cho quan hệ',
  })
  @IsString()
  field!: string;

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'asc' })
  @IsEnum(SORT_DIRECTIONS)
  direction: SortDirection = 'asc';
}

export class FilterParam {
  @ApiPropertyOptional({ description: 'Tên trường cần lọc, hỗ trợ dot notation' })
  @IsString()
  field!: string;

  @ApiPropertyOptional({ description: 'Giá trị cần lọc' })
  @IsString()
  value!: string;
}

function normalizeToArray(input: unknown): string[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input
      .flatMap((item) => `${item}`.split(','))
      .map((part) => part.trim())
      .filter(Boolean);
  }

  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
    return String(input)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

function parseSortParams(input: unknown): SortParam[] {
  return normalizeToArray(input)
    .map((item) => {
      const [fieldRaw, directionRaw] = item.split(':').map((part) => part.trim());
      if (!fieldRaw) {
        return null;
      }
      const direction = directionRaw?.toLowerCase() === 'desc' ? 'desc' : 'asc';
      return {
        field: fieldRaw,
        direction,
      } as SortParam;
    })
    .filter((item): item is SortParam => Boolean(item));
}

function parseFilterParams(input: unknown): FilterParam[] {
  return normalizeToArray(input)
    .map((item) => {
      const separatorIndex = item.indexOf(':');
      if (separatorIndex === -1) {
        return null;
      }
      const field = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();
      if (!field || value === undefined || value === null) {
        return null;
      }
      return {
        field,
        value,
      } as FilterParam;
    })
    .filter((item): item is FilterParam => Boolean(item));
}

export class PaginationOptionsDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    description:
      'Chuỗi sort dạng "field:direction" (direction = asc|desc). Có thể truyền nhiều lần (?sorts=createdAt:desc&sorts=name:asc) hoặc phân tách bằng dấu phẩy.',
    type: String,
    example: 'createdAt:desc,name:asc',
  })
  @IsOptional()
  @Transform(({ value }) => parseSortParams(value))
  sorts: SortParam[] = [];

  @ApiPropertyOptional({
    description:
      'Chuỗi filter dạng "field:value" (hỗ trợ dot notation). Có thể truyền nhiều lần (?filters=status:active&filters=category.name:electronics) hoặc phân tách bằng dấu phẩy.',
    type: String,
    example: 'status:active,category.name:electronics',
  })
  @IsOptional()
  @Transform(({ value }) => parseFilterParams(value))
  filters: FilterParam[] = [];

  @ApiPropertyOptional({
    description: 'Số bản ghi cần bỏ qua, ưu tiên limit/page nếu cùng truyền',
    type: Number,
    example: 40,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  skip?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginateQueryHook<T extends ObjectLiteral> {
  (qb: SelectQueryBuilder<T>): void;
}

export { parseFilterParams, parseSortParams };
