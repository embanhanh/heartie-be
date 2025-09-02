import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsNotEmpty,
  IsString,
  // IsDateString,
  IsOptional,
  Min,
  IsEnum,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatus {
  PENDING = 'Pending',
  PROCESSING = 'Processing',
  SHIPPED = 'Shipped',
  DELIVERED = 'Delivered',
  CANCELLED = 'Cancelled',
}

export enum PaymentMethod {
  CREDIT_CARD = 'Credit Card',
  DEBIT_CARD = 'Debit Card',
  BANK_TRANSFER = 'Bank Transfer',
  CASH_ON_DELIVERY = 'Cash on Delivery',
  E_WALLET = 'E-Wallet',
}

export enum ShippingMethod {
  STANDARD = 'Standard Delivery',
  EXPRESS = 'Express Delivery',
  OVERNIGHT = 'Overnight Delivery',
  PICKUP = 'Store Pickup',
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'Ngày đặt hàng',
    example: '2024-08-24T10:30:00Z',
    required: true,
  })
  @Type(() => Date)
  @IsDate()
  orderDate: Date;

  @ApiProperty({
    description: 'ID địa chỉ giao hàng',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  idAddress: number;

  @ApiProperty({
    description: 'Phương thức thanh toán',
    example: 'Credit Card',
    enum: PaymentMethod,
    required: true,
  })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'Giá sản phẩm',
    example: 250000,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  productsPrice: number;

  @ApiProperty({
    description: 'Phí vận chuyển',
    example: 30000,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  shippingPrice: number;

  @ApiProperty({
    description: 'Tổng giá trị đơn hàng',
    example: 280000,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  totalPrice: number;

  @ApiProperty({
    description: 'Ngày dự kiến giao hàng',
    example: '2024-08-26T10:30:00Z',
    required: true,
  })
  @Type(() => Date)
  @IsDate()
  expectedDeliveryDate: Date;

  @ApiProperty({
    description: 'Trạng thái đơn hàng',
    example: 'Processing',
    enum: OrderStatus,
    required: true,
  })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @ApiProperty({
    description: 'Phương thức vận chuyển',
    example: 'Standard Delivery',
    enum: ShippingMethod,
    required: true,
  })
  @IsEnum(ShippingMethod)
  @IsNotEmpty()
  shippingMethod: ShippingMethod;

  @ApiProperty({
    description: 'Tùy chọn chuyển khoản',
    example: 'Bank Transfer',
    required: false,
  })
  @IsString()
  @IsOptional()
  transferOption?: string;
}
