// src/modules/product-variants/dto/create-product-variant.dto.ts
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductVariantStatus } from '../entities/product_variant.entity';

export class CreateProductVariantDto {
  @ApiProperty({ example: 1, description: 'FK -> products.id' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  productId: number;

  @ApiProperty({ example: 16000, description: 'Giá bán (đồng), tối đa 2 chữ số thập phân' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @ApiPropertyOptional({ example: 0.25, description: 'Khối lượng (kg)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Type(() => Number)
  weight?: number;

  @ApiProperty({ enum: ProductVariantStatus, example: ProductVariantStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProductVariantStatus)
  status?: ProductVariantStatus;

  @ApiPropertyOptional({ description: 'Metadata JSON', example: { color: 'red' } })
  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
