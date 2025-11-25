import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { OrderStatus } from '../../orders/entities/order.entity';
import { RegisterNotificationTokenDto } from './register-notification-token.dto';
import { NotificationDispatchResult } from '../notifications.service';

export class RegisterNotificationTokenRequestDto extends RegisterNotificationTokenDto {
  @ApiProperty({ description: 'User ID owning the device token', example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId: number;
}

export class NotificationDispatchResponseDto implements NotificationDispatchResult {
  @ApiProperty({ description: 'Indicates whether at least one notification target succeeded' })
  success: boolean;

  @ApiProperty({ description: 'Number of device tokens targeted', example: 3 })
  targetedReceivers: number;

  @ApiProperty({ description: 'Successfully delivered device notifications', example: 2 })
  successCount: number;

  @ApiProperty({ description: 'Failed device notifications', example: 1 })
  failureCount: number;

  @ApiProperty({ description: 'Errors returned from Firebase during dispatch', type: [String] })
  errors: string[];

  @ApiProperty({ description: 'Whether the notification was also dispatched to a topic' })
  topicSent: boolean;
}

export class RemoveNotificationTokenDto {
  @ApiProperty({ description: 'Firebase device token to remove', maxLength: 512 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @ApiPropertyOptional({ description: 'Optional user ID, used to scope removal' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @IsPositive()
  userId?: number;
}

export class SendAdminOrderNotificationDto {
  @ApiProperty({ description: 'Order identifier', example: 123 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderId: number;

  @ApiProperty({ description: 'Human readable order number', example: 'ORD-20240101-0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  orderNumber: string;

  @ApiProperty({ description: 'Order total amount used in notification previews', example: 250000 })
  @Type(() => Number)
  @IsNumber()
  totalAmount: number;

  @ApiPropertyOptional({ description: 'Optional user ID related to the order', example: 7 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @IsPositive()
  userId?: number;
}

export class SendUserOrderStatusNotificationDto {
  @ApiProperty({ description: 'Order identifier', example: 123 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderId: number;

  @ApiProperty({ description: 'Order number displayed to user', example: 'ORD-20240101-0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  orderNumber: string;

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiProperty({ description: 'Total amount used in notification payload', example: 250000 })
  @Type(() => Number)
  @IsNumber()
  totalAmount: number;

  @ApiProperty({ description: 'Target user receiving the notification', example: 42 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId: number;
}
