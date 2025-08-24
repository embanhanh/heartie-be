// voucher-user-detail.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, IsDateString, IsOptional, IsBoolean } from 'class-validator';
// import { Type } from 'class-transformer';

export class CreateVoucherUserDetailDto {
  @ApiProperty({
    description: 'ID voucher',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  idVoucher: number;

  @ApiProperty({
    description: 'ID user',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  idUser: number;

  @ApiProperty({
    description: 'Ngày bắt đầu hiệu lực',
    example: '2024-01-01T00:00:00Z',
    required: true,
  })
  @IsDateString()
  @IsNotEmpty()
  validFrom: string;

  @ApiProperty({
    description: 'Ngày hết hạn',
    example: '2024-12-31T23:59:59Z',
    required: true,
  })
  @IsDateString()
  @IsNotEmpty()
  validUntil: string;

  @ApiProperty({
    description: 'Đã sử dụng chưa',
    example: false,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  used?: boolean;

  @ApiProperty({
    description: 'Thời gian sử dụng (nếu đã sử dụng)',
    example: '2024-06-15T10:30:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  usedAt?: string;
}
