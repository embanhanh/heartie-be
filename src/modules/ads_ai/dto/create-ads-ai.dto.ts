import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

function transformHashtagInput(value?: unknown): string[] | undefined {
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
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => `${item}`.trim())
          .filter((item) => item.length > 0)
          .slice(0, 10);
      }
    } catch {
      // ignore JSON parse errors, fallback to split below
    }

    return value
      .split(/[#,\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 10);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    const coerced = String(value).trim();
    return coerced ? [coerced] : undefined;
  }

  return undefined;
}

export class CreateAdsAiDto {
  @ApiProperty({ description: 'Tên chiến dịch quảng cáo' })
  @IsString()
  @Length(2, 255)
  name!: string;

  @ApiPropertyOptional({ description: 'Tên sản phẩm chính' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ description: 'ID sản phẩm được quảng cáo', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number;

  @ApiPropertyOptional({ description: 'Đối tượng khách hàng mục tiêu' })
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiPropertyOptional({ description: 'Tông giọng mong muốn (ví dụ: thân thiện, chuyên nghiệp)' })
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiPropertyOptional({ description: 'Mục tiêu chiến dịch' })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional({ description: 'Lời kêu gọi hành động (CTA)' })
  @IsOptional()
  @IsString()
  callToAction?: string;

  @ApiPropertyOptional({ description: 'Đường dẫn khi người dùng click CTA' })
  @IsOptional()
  @IsString()
  ctaUrl?: string;

  @ApiPropertyOptional({ description: 'Nội dung chính của quảng cáo' })
  @IsOptional()
  @IsString()
  primaryText?: string;

  @ApiPropertyOptional({ description: 'Tiêu đề' })
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiPropertyOptional({ description: 'Mô tả bổ sung' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Danh sách hashtag sẽ gắn kèm khi đăng bài',
    type: [String],
    example: ['#Heartie', '#UuDaiNgay'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Transform(({ value }) => transformHashtagInput(value), { toClassOnly: true })
  hashtags?: string[];

  @ApiPropertyOptional({
    description: 'Thời điểm dự kiến đăng quảng cáo',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn ảnh đã có sẵn (nếu không upload file)',
    type: String,
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description: 'Danh sách ảnh cho Carousel',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  // Marketing Metrics (Automated via Facebook Sync)

  @ApiPropertyOptional({ description: 'Đánh giá (1-5 sao)', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rating?: number;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Kiểu bài đăng Facebook sẽ sử dụng',
    enum: ['link', 'photo', 'carousel'],
  })
  @IsOptional()
  @IsIn(['link', 'photo', 'carousel'])
  postType?: 'link' | 'photo' | 'carousel';

  @ApiPropertyOptional({ description: 'Prompt tuỳ chỉnh đã sử dụng để tạo nội dung AI' })
  @IsOptional()
  @IsString()
  prompt?: string;
}
