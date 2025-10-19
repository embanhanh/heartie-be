// banner.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BannerStatus } from '../entities/banner.entity';

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
    description: 'Đường dẫn ảnh hiện tại (nếu không upload file mới)',
    example: 'uploads/banners/banner.jpg',
    required: false,
    maxLength: 500,
  })
  @IsString()
  @Length(0, 500, { message: 'Image path must not exceed 500 characters' })
  @IsOptional()
  image?: string;

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
    example: BannerStatus.ACTIVE,
    enum: BannerStatus,
    required: false,
    default: BannerStatus.ACTIVE,
  })
  @IsEnum(BannerStatus)
  @IsOptional()
  status?: BannerStatus;

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
