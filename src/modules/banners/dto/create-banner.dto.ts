// banner.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsDateString,
  IsNumber,
  IsIn,
  Min,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBannerDto {
  @ApiProperty({
    description: 'Tiêu đề banner',
    example: 'Sale 50% Tất Cả Sản Phẩm',
    required: true,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255, { message: 'Title must be between 1 and 255 characters' })
  title: string;

  @ApiProperty({
    description: 'URL hình ảnh banner',
    example: 'https://example.com/banner.jpg',
    required: true,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: 'URL image must be a valid URL' })
  @Length(1, 500, { message: 'URL image must not exceed 500 characters' })
  urlImage: string;

  @ApiProperty({
    description: 'Mô tả banner',
    example: 'Khuyến mãi lớn nhất trong năm',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Tiêu đề nút bấm',
    example: 'Mua Ngay',
    required: false,
    maxLength: 100,
  })
  @IsString()
  @Length(0, 100, { message: 'Button title must not exceed 100 characters' })
  @IsOptional()
  btnTitle?: string;

  @ApiProperty({
    description: 'Link điều hướng khi click banner',
    example: 'https://example.com/sale',
    required: false,
    maxLength: 500,
  })
  @IsString()
  @IsUrl({}, { message: 'Link must be a valid URL' })
  @Length(0, 500, { message: 'Link must not exceed 500 characters' })
  @IsOptional()
  link?: string;

  @ApiProperty({
    description: 'Ngày bắt đầu hiển thị',
    example: '2024-01-01',
    required: true,
  })
  @IsDateString({}, { message: 'Start date must be a valid date' })
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'Ngày kết thúc hiển thị',
    example: '2024-12-31',
    required: true,
  })
  @IsDateString({}, { message: 'End date must be a valid date' })
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({
    description: 'Trạng thái banner',
    example: 'ACTIVE',
    enum: ['ACTIVE', 'INACTIVE', 'EXPIRED'],
    required: false,
    default: 'ACTIVE',
  })
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE', 'EXPIRED'])
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: 'Thứ tự hiển thị (càng nhỏ càng ưu tiên)',
    example: 1,
    required: false,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  displayOrder?: number;
}
