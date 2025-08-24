import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDate,
  IsBoolean,
  IsOptional,
  Min,
  IsIn,
  IsArray,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVoucherDto {
  @ApiProperty({
    description: 'Mã code của voucher',
    example: 'DISCOUNT20',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Loại giảm giá',
    example: 'percentage',
    enum: ['percentage', 'fixed'],
    required: true,
  })
  @IsString()
  @IsIn(['percentage', 'fixed'])
  discountType: string;

  @ApiProperty({
    description: 'Giá trị giảm giá',
    example: 20.5,
    required: true,
  })
  @IsNumber()
  @Min(0)
  discountValue: number;

  @ApiProperty({
    description: 'Giá trị đơn hàng tối thiểu',
    example: 100000,
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @ApiProperty({
    description: 'Giá trị giảm giá tối đa',
    example: 50000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountValue?: number;

  @ApiProperty({
    description: 'Số lần sử dụng tối đa',
    example: 100,
    required: false,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @ApiProperty({
    description: 'Ngày bắt đầu hiệu lực',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  @Type(() => Date)
  @IsDate()
  validFrom: Date;

  @ApiProperty({
    description: 'Ngày hết hạn',
    example: '2024-12-31T23:59:59.000Z',
    required: true,
  })
  @Type(() => Date)
  @IsDate()
  validUntil: Date;

  @ApiProperty({
    description: 'Loại voucher',
    example: 'public',
    enum: ['public', 'private', 'special'],
    required: false,
    default: 'public',
  })
  @IsOptional()
  @IsString()
  @IsIn(['public', 'private', 'special'])
  voucherType?: string;

  @ApiProperty({
    description: 'Trạng thái hiển thị',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  display?: boolean;

  @ApiProperty({
    description: 'Số lượng mỗi người dùng có thể sử dụng',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantityPerUser?: number;

  @ApiProperty({ type: [Number], example: [1, 2, 3], description: 'Danh sách ID sản phẩm áp dụng' })
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  applicableProducts: number[];
}
