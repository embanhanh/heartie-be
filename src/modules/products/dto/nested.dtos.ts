import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  // Max,
  ValidateNested,
  // IsNumber,
  // IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConfigurableOptionValueDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label: string;
}

export class SpecificationAttributeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  value: string;
}

export class SpecificationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ type: [SpecificationAttributeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecificationAttributeDto)
  attributes: SpecificationAttributeDto[];
}

export class ConfigurableOptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  position: number;

  @ApiProperty()
  @IsBoolean()
  show_preview_image: boolean;

  @ApiProperty({ type: [ConfigurableOptionValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigurableOptionValueDto)
  values: ConfigurableOptionValueDto[];
}

export class UrlImageItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  base_url: string;

  @ApiProperty()
  @IsBoolean()
  is_gallery: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  position?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  large_url: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  medium_url: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  small_url: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  thumbnail_url: string;
}
