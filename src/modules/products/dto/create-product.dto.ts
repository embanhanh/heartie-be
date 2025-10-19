import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus } from '../entities/product.entity';

export class CreateProductDto {
  @ApiProperty({ example: 'Combo áo sơ mi nam tay dài' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 1, description: 'FK -> brands.id' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  brandId?: number;

  @ApiPropertyOptional({ example: 2, description: 'FK -> categories.id' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  categoryId?: number;

  @ApiPropertyOptional({ example: 'Chất liệu cotton cao cấp, form rộng.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/images/product.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @ApiPropertyOptional({ example: ProductStatus.ACTIVE, enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  stock?: number;
}
