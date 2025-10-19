import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { OrderStatus, PaymentMethod } from '../entities/order.entity';

export class CreateOrderDto {
  @ApiPropertyOptional({ example: 'ORD-20251010-0001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  orderNumber?: string;

  @ApiPropertyOptional({ example: 5, description: 'FK -> users.id' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  userId?: number;

  @ApiPropertyOptional({ example: 2, description: 'FK -> branches.id' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  branchId?: number;

  @ApiProperty({ example: 350000, description: 'Tổng tiền hàng trước ưu đãi' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  subTotal: number;

  @ApiPropertyOptional({ example: 50000, description: 'Tổng tiền giảm giá' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  discountTotal?: number;

  @ApiPropertyOptional({ example: 15000, description: 'Phí vận chuyển' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  shippingFee?: number;

  @ApiPropertyOptional({ example: 20000, description: 'Thuế' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  taxTotal?: number;

  @ApiPropertyOptional({ example: 335000, description: 'Tổng tiền phải thanh toán' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  totalAmount?: number;

  @ApiPropertyOptional({ example: 'Giao trong giờ hành chính' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

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

  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PENDING })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Thông tin địa chỉ giao hàng tại thời điểm đặt hàng',
    example: { fullName: 'Nguyễn Văn A', phone: '0901234567', address: '123 Lê Lợi, Quận 1' },
  })
  @IsOptional()
  @IsObject()
  shippingAddressJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Thông tin địa chỉ thanh toán tại thời điểm đặt hàng',
    example: { fullName: 'Nguyễn Văn A', taxCode: '0123456789', address: '123 Lê Lợi, Quận 1' },
  })
  @IsOptional()
  @IsObject()
  billingAddressJson?: Record<string, unknown>;
}
