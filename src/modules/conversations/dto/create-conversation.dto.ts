// conversations/dto/create-conversation.dto.ts
import { IsOptional, IsInt, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({
    description: 'ID của admin (bắt buộc khi type = USER_ADMIN)',
    example: 999,
    required: false,
  })
  @IsOptional()
  @IsInt()
  adminUserId?: number;

  @ApiProperty({
    description: 'Metadata bổ sung',
    example: { source: 'web', initialTopic: 'order_tracking' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
