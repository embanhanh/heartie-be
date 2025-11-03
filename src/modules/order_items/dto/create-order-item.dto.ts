import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({ description: 'Order identifier', example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderId: number;

  @ApiPropertyOptional({ description: 'Related product variant identifier', example: 45 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  variantId?: number;

  @ApiPropertyOptional({ description: 'Quantity of the variant in this order', default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({ description: 'Subtotal before any discounts', example: 399000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subTotal: number;

  @ApiPropertyOptional({ description: 'Discount total applied to this item', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountTotal?: number;

  @ApiProperty({ description: 'Final total amount after applying discounts', example: 359100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount: number;
}
