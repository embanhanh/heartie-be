import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  Max,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  ConfigurableOptionDto,
  UrlImageItemDto,
  // SpecificationAttributeDto,
  SpecificationDto,
} from './nested.dtos';

export class CreateProductDto {
  @ApiProperty({ example: '2934570153249' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({
    example:
      'dép-lê-cho-bé-trai-3---12-tuổi-hình-xe-tăng-nhựa-dẻo-mềm-êm-quai-ngang-chống-trơn-trượt-cho-bé-d38-2934570153249',
  })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'Dép lê cho bé trai 3 - 12 tuổi hình xe tăng…' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'configurable' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 'OEM' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ type: [UrlImageItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UrlImageItemDto)
  urlImage: UrlImageItemDto[];

  // decimal(10,2) nhận number; service sẽ toFixed(2) khi lưu
  @ApiProperty({ example: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  originalPrice: number;

  @ApiProperty({ example: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  discount: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockQuantity: number;

  @ApiProperty({ example: 0.0 })
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5)
  @Type(() => Number)
  rating: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  isFeatured: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  minOrderQuantity: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxOrderQuantity: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  soldQuantity: number;

  @ApiProperty({ type: [String], example: [] })
  @IsArray()
  @IsString({ each: true })
  shippingInfo: string[];

  @ApiProperty({ type: [SpecificationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecificationDto)
  specifications: SpecificationDto[];

  @ApiProperty({ type: [ConfigurableOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigurableOptionDto)
  configurable_options: ConfigurableOptionDto[];

  @ApiProperty({ type: [Number], example: [1, 2] })
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  categories: number[];
}
