import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsUrl, IsNotEmpty } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Tên danh mục',
    example: 'Áo thun nam',
    required: true,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'ID danh mục cha (nếu có)',
    example: 1,
    required: false,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  parentCategory?: number;

  @ApiProperty({
    description: 'URL ảnh đại diện cho danh mục',
    example: 'https://example.com/images/category.jpg',
    required: true,
    type: String,
    format: 'url',
  })
  @IsUrl()
  urlImage: string;
}
