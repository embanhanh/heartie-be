import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AttributeType } from '../../attributes/entities/attribute.entity';
import { ProductStatus } from '../entities/product.entity';
import { ProductVariantStatus } from '../../product_variants/entities/product_variant.entity';

export class AttributeValuePayloadDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  value: string;

  @IsOptional()
  meta?: Record<string, unknown>;
}

export class AttributePayloadDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttributeValuePayloadDto)
  values: AttributeValuePayloadDto[];
}

export class VariantAttributePayloadDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  attributeId?: number;

  @IsOptional()
  @IsString()
  attributeName?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  attributeValueId?: number;

  @IsString()
  @IsNotEmpty()
  attributeValue: string;
}

export class VariantPayloadDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Type(() => Number)
  weight?: number | null;

  @IsOptional()
  @IsEnum(ProductVariantStatus)
  status?: ProductVariantStatus;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  stock?: number;

  @IsOptional()
  @IsString()
  image?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantAttributePayloadDto)
  attributes: VariantAttributePayloadDto[];
}

export class ProductFormPayloadDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  branchId: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  brandId?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  categoryId?: number | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  image?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  originalPrice?: number | null;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributePayloadDto)
  attributes: AttributePayloadDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantPayloadDto)
  variants: VariantPayloadDto[];
}
