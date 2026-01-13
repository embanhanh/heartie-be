// rating.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, IsOptional, IsString, Min, Max, Length } from 'class-validator';
// import { Transform } from 'class-transformer';

export class CreateRatingDto {
  @ApiProperty({
    description: 'ID sản phẩm',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  productId: number;

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

  @ApiProperty({
    description: 'Danh sách URL hình ảnh',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({
    description: 'Danh sách URL video',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  videos?: string[];
}
