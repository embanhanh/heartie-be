import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ description: 'Product variant id' })
  @IsInt()
  @Min(1)
  variantId!: number;

  @ApiPropertyOptional({ description: 'Quantity to add', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ description: 'New quantity' })
  @IsInt()
  @Min(1)
  quantity!: number;
}
