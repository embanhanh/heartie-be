// rating.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Max,
  Length,
  IsDateString,
} from 'class-validator';
// import { Transform } from 'class-transformer';

export class CreateRatingDto {
  @ApiProperty({
    description: 'ID sản phẩm',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  idProduct: number;

  @ApiProperty({
    description: 'ID người dùng',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  idUser: number;

  @ApiProperty({
    description: 'Điểm đánh giá (1.0 - 5.0)',
    example: 4.5,
    minimum: 1.0,
    maximum: 5.0,
    required: true,
  })
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1.0, { message: 'Rating must be at least 1.0' })
  @Max(5.0, { message: 'Rating must not exceed 5.0' })
  @IsNotEmpty()
  rating: number;

  // Thêm ngày giờ đánh giá
  @ApiProperty({
    description: 'Ngày giờ đánh giá',
    example: '2024-10-01T12:34:56Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  createdAt?: string;

  // Thêm ngày sửa đổi đánh giá
  @ApiProperty({
    description: 'Ngày giờ sửa đổi đánh giá',
    example: '2024-10-02T12:34:56Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  updatedAt?: string;

  @ApiProperty({
    description: 'Nhận xét',
    example: 'Sản phẩm rất tốt, chất lượng cao!',
    required: false,
    maxLength: 1000,
  })
  @IsString()
  @Length(0, 1000, { message: 'Comment must not exceed 1000 characters' })
  @IsOptional()
  comment?: string;
}
