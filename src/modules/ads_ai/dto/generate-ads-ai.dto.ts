import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

function transformToArray(value?: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => `${item}`.trim())
      .filter((item) => item.length > 0)
      .slice(0, 10);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 10);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    const coerced = String(value).trim();
    return coerced ? [coerced.slice(0, 255)] : undefined;
  }

  return undefined;
}

export class GenerateAdsAiDto {
  @ApiPropertyOptional({ description: 'ID sản phẩm được lấy nội dung tự động', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number;

  @ApiProperty({ description: 'Tên sản phẩm/dịch vụ', minLength: 2, required: false })
  @ValidateIf((dto: GenerateAdsAiDto) => !dto.productId)
  @IsString()
  @Length(2, 255)
  productName?: string;

  @ApiPropertyOptional({ description: 'Mô tả sản phẩm/chiến dịch' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Đối tượng mục tiêu (ví dụ: "Sinh viên yêu công nghệ")' })
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiPropertyOptional({
    description: 'Các tính năng nổi bật, phân tách bởi dấu phẩy',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @Transform(({ value }) => transformToArray(value), { toClassOnly: true })
  features?: string[];

  @ApiPropertyOptional({
    description: 'Lợi ích chính cho khách hàng, phân tách bởi dấu phẩy',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @Transform(({ value }) => transformToArray(value), { toClassOnly: true })
  benefits?: string[];

  @ApiPropertyOptional({ description: 'Tông giọng mong muốn (ví dụ: vui vẻ, chuyên nghiệp)' })
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiPropertyOptional({ description: 'Mục tiêu chiến dịch (ví dụ: tăng nhận diện thương hiệu)' })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional({ description: 'Ghi chú bổ sung cho AI' })
  @IsOptional()
  @IsString()
  additionalNotes?: string;
}
