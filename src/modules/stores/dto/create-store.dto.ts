import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStoreDto {
  @ApiProperty({ description: 'Tên của store', example: 'Thời trang ABC' }) // Mô tả tên store
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Mô tả về store',
    example: 'Chuyên bán quần áo thời trang',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'URL hình ảnh của store',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({
    description: 'Địa chỉ của store',
    example: '123 Đường ABC, Quận 1, TP.HCM',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: 'Số điện thoại của store', example: '0123456789', required: false })
  @IsOptional()
  @IsString() // Thay thế @IsPhoneNumber bằng @IsString nếu không cần kiểm tra định dạng
  phoneNumber?: string;
}
