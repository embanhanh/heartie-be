import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class CreateProductAttributeDto {
  @ApiProperty({ description: 'Product identifier', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ description: 'Attribute identifier', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attributeId: number;

  @ApiPropertyOptional({ description: 'Whether this attribute is required for the product' })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
