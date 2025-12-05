import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationOptionsDto } from '../../../common/dto/pagination.dto';
import { FulfillmentMethod, OrderStatus, PaymentMethod } from '../entities/order.entity';
import { NormalizeEnumArray } from '../../../common/transformers/decorators/normalize-enum-array.decorator';

export class OrdersQueryDto extends PaginationOptionsDto {
  @ApiPropertyOptional({
    description: 'Filter by one or many order statuses',
    enum: OrderStatus,
    isArray: true,
    example: ['PENDING', 'SHIPPED'],
  })
  @IsOptional()
  @IsEnum(OrderStatus, { each: true })
  @NormalizeEnumArray<OrderStatus>({
    acceptedValues: Object.values(OrderStatus),
    case: 'upper',
  })
  statuses?: OrderStatus[];

  @ApiPropertyOptional({
    description: 'Filter by payment methods',
    enum: PaymentMethod,
    isArray: true,
    example: ['cod', 'bank'],
  })
  @IsOptional()
  @IsEnum(PaymentMethod, { each: true })
  @NormalizeEnumArray<PaymentMethod>({
    acceptedValues: Object.values(PaymentMethod),
    case: 'lower',
  })
  paymentMethods?: PaymentMethod[];

  @ApiPropertyOptional({
    description: 'Filter by fulfillment methods',
    enum: FulfillmentMethod,
    isArray: true,
    example: ['delivery', 'pickup'],
  })
  @IsOptional()
  @IsEnum(FulfillmentMethod, { each: true })
  @NormalizeEnumArray<FulfillmentMethod>({
    acceptedValues: Object.values(FulfillmentMethod),
    case: 'lower',
  })
  fulfillmentMethods?: FulfillmentMethod[];

  @ApiPropertyOptional({ description: 'Filter by branch id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;

  @ApiPropertyOptional({ description: 'Filter by customer (user) id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({ description: 'Full-text search on order number or customer info' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Minimum total amount', example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  minTotal?: number;

  @ApiPropertyOptional({ description: 'Maximum total amount', example: 1000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  maxTotal?: number;

  @ApiPropertyOptional({ description: 'Filter orders created from this date', type: String })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Filter orders created up to this date', type: String })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
