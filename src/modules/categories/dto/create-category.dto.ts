import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

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

  @ApiPropertyOptional({
    description: 'ID danh mục cha (nếu có)',
    example: 1,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  parentId?: number;

  @ApiPropertyOptional({
    description: 'URL ảnh đại diện cho danh mục',
    example: 'https://example.com/images/category.jpg',
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;
}
