import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';

export enum AddressType {
  HOME = 'Home',
  OFFICE = 'Office',
  OTHER = 'Other',
}

export class CreateAddressDto {
  @ApiProperty({
    description: 'ID người dùng sở hữu địa chỉ',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  idUser: number;

  @ApiProperty({
    description: 'Tên người nhận',
    example: 'Nguyễn Văn A',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Số điện thoại người nhận',
    example: '0901234567',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiProperty({
    description: 'Vị trí địa chỉ (tọa độ hoặc mô tả vị trí)',
    example: '10.762622, 106.660172',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({
    description: 'Loại địa chỉ',
    example: 'Home',
    enum: AddressType,
    required: true,
  })
  @IsEnum(AddressType)
  @IsNotEmpty()
  type: AddressType;

  @ApiProperty({
    description: 'Có phải địa chỉ mặc định không',
    example: false,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  default?: boolean;

  @ApiProperty({
    description: 'Địa chỉ chi tiết',
    example: '123 Nguyễn Văn Cừ, Phường 4, Quận 5, TP.HCM',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  address: string;
}
