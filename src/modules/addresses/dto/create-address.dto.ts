import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { AddressType } from '../entities/address.entity';

export class CreateAddressDto {
  @ApiPropertyOptional({ description: 'Identifier of the owning user', example: 42 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  userId?: number;

  @ApiProperty({ description: 'Recipient full name', example: 'Nguyễn Văn A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName: string;

  @ApiProperty({ description: 'Recipient phone number', example: '0901234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phoneNumber: string;

  @ApiProperty({ description: 'Recipient email', example: 'customer@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ description: 'Street information', example: '123 Nguyễn Văn Cừ' })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ description: 'Ward/Sub-district name', example: 'Phường 4' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ward?: string;

  @ApiPropertyOptional({ description: 'District name', example: 'Quận 5' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiProperty({ description: 'Province/City name', example: 'TP. Hồ Chí Minh' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional({ description: 'Latitude in decimal degrees', example: 10.762622 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'lat must be a valid number' })
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude in decimal degrees', example: 106.660172 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'long must be a valid number' })
  lng?: number;

  @ApiPropertyOptional({ description: 'Full formatted address returned by map APIs' })
  @IsOptional()
  @IsString()
  fullAddress?: string;

  @ApiPropertyOptional({
    description: 'Address type classification',
    enum: AddressType,
    default: AddressType.HOME,
  })
  @IsOptional()
  @IsEnum(AddressType)
  addressType?: AddressType;

  @ApiPropertyOptional({ description: 'Mark as default address for the user', default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
