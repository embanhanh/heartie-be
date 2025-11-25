import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { NotificationPlatform } from '../entities/notification-token.entity';

export class RegisterNotificationTokenDto {
  @ApiProperty({ maxLength: 512 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;

  @ApiPropertyOptional({ enum: ['ios', 'android', 'web', 'unknown'] })
  @IsOptional()
  @IsString()
  platform?: NotificationPlatform;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
