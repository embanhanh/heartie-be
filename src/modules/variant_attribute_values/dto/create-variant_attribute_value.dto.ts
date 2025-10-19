import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateVariantAttributeValueDto {
  @ApiProperty({ description: 'Variant identifier', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  variantId: number;

  @ApiProperty({ description: 'Attribute identifier', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attributeId: number;

  @ApiProperty({ description: 'Attribute value identifier', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attributeValueId: number;
}
