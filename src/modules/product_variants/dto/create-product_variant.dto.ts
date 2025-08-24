// src/modules/product-variants/dto/create-product-variant.dto.ts
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryStatus } from '../entities/product_variant.entity';

export class CreateProductVariantDto {
  @ApiProperty({ example: 1, description: 'FK -> products.id' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  productId: number;

  @ApiProperty({ example: '5973116146442' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  sku: string;

  @ApiProperty({ example: 'Yếm Xô Cúc Bấm Mềm Mịn - Xô Tròn - M2' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 16000, description: 'Giá bán (đồng), tối đa 2 chữ số thập phân' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiProperty({
    example: 0,
    description: 'Tỷ lệ giảm giá (%) hoặc rate số, tối đa 2 chữ số thập phân',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  discountRate: number;

  @ApiProperty({ example: 1000 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockQuantity: number;

  @ApiProperty({ enum: InventoryStatus, example: InventoryStatus.AVAILABLE })
  @IsEnum(InventoryStatus)
  inventoryStatus: InventoryStatus;

  @ApiPropertyOptional({ example: 'Xô Tròn - M2' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  option1?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  option2?: string;

  @ApiPropertyOptional({
    name: 'nearsightedness',
    example: '',
    description: 'Trường tự do (độ kính), có thể để trống',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nearsightedness?: string;

  @ApiPropertyOptional({
    example:
      'https://salt.tikicdn.com/cache/280x280/ts/product/ec/a5/68/4e016b6e134c7be571ecc0f8ccde63d3.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
