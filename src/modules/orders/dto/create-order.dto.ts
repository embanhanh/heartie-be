import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FulfillmentMethod, OrderStatus, PaymentMethod } from '../entities/order.entity';
import { CreateAddressDto } from 'src/modules/addresses/dto/create-address.dto';

class OrderItemDto {
  @ApiProperty({ example: 101, description: 'FK -> product_variants.id' })
  @IsInt()
  @IsPositive()
  variantId: number;

  @ApiProperty({ example: 2, description: 'Số lượng đặt mua' })
  @IsInt()
  @IsPositive()
  quantity: number;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ example: 2, description: 'FK -> branches.id' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  branchId?: number;

  @ApiPropertyOptional({
    example: '123456789',
    description: 'FK -> addresses.id (bigint dạng chuỗi)',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  addressId?: number;

  @ApiPropertyOptional({ example: 'Giao trong giờ hành chính' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    example: PaymentMethod.MOMO,
    description:
      'Phương thức thanh toán. Nếu chọn MOMO, response sẽ trả về payUrl để redirect user đến trang thanh toán MoMo',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ enum: FulfillmentMethod, example: FulfillmentMethod.DELIVERY })
  @IsOptional()
  @IsEnum(FulfillmentMethod)
  fulfillmentMethod?: FulfillmentMethod;

  @ApiPropertyOptional({ example: '2025-10-15T10:30:00Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expectedDeliveryDate?: Date;

  @ApiPropertyOptional({ example: '2025-10-12T12:30:00Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidAt?: Date;

  @ApiPropertyOptional({ example: '2025-10-16T09:00:00Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deliveredAt?: Date;

  @ApiPropertyOptional({ example: '2025-10-13T08:00:00Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  cancelledAt?: Date;

  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PENDING_PAYMENT })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ example: 'SAVE10', description: 'Mã khuyến mãi sử dụng cho đơn hàng' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  promotionCode?: string;

  @ApiProperty({
    type: [OrderItemDto],
    description: 'Danh sách sản phẩm trong đơn hàng',
    example: [
      { variantId: 101, quantity: 2 },
      { variantId: 102, quantity: 1 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({
    type: CreateAddressDto,
    description: 'Thông tin địa chỉ mới nếu chưa có addressId',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAddressDto)
  address?: CreateAddressDto;
}
