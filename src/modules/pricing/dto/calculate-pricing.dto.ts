import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';

class PricingItemDto {
  @ApiProperty({ example: 101, description: 'FK -> product_variants.id' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  variantId: number;

  @ApiProperty({ example: 2, description: 'Số lượng biến thể trong giỏ hàng' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity: number;
}

export class CalculatePricingDto {
  @ApiProperty({ type: [PricingItemDto], description: 'Danh sách các biến thể cần tính toán' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingItemDto)
  @ArrayMinSize(1)
  items: PricingItemDto[];

  @ApiPropertyOptional({ example: 12, description: 'FK -> promotions.id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  promotionId?: number;

  @ApiPropertyOptional({ example: 3, description: 'FK -> branches.id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  branchId?: number;

  @ApiPropertyOptional({
    example: '123456789',
    description: 'FK -> addresses.id (bigint dạng chuỗi)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  addressId?: number;

  @ApiPropertyOptional({ example: 5, description: 'Người dùng thực hiện thao tác' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  userId?: number;
}
