import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class MomoIpnDto {
  @ApiProperty({ example: 'MOMO' })
  @IsString()
  partnerCode: string;

  @ApiProperty({ example: 'ORD-20260110-1234' })
  @IsString()
  orderId: string;

  @ApiProperty({ example: 'ORD-20260110-1234' })
  @IsString()
  requestId: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'pay with MoMo' })
  @IsString()
  orderInfo: string;

  @ApiProperty({ example: 'momo_wallet' })
  @IsString()
  orderType: string;

  @ApiProperty({ example: 2997450919 })
  @IsNumber()
  transId: number;

  @ApiProperty({ example: 0, description: '0 = success, other = failed' })
  @IsNumber()
  resultCode: number;

  @ApiProperty({ example: 'Thành công.' })
  @IsString()
  message: string;

  @ApiProperty({ example: 'qr' })
  @IsString()
  payType: string;

  @ApiProperty({ example: 1704870000000 })
  @IsNumber()
  responseTime: number;

  @ApiProperty({ example: '' })
  @IsString()
  extraData: string;

  @ApiProperty({ example: 'abc123signature' })
  @IsString()
  signature: string;
}
