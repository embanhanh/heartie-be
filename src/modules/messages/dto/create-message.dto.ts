import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MessageRole } from '../enums/message.enums';

export class CreateMessageDto {
  @ApiProperty({
    description: 'ID của hội thoại',
    example: 1,
  })
  @IsInt()
  conversationId: number;

  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Xin chào! Tôi muốn tra cứu đơn hàng của mình.',
    minLength: 1,
    maxLength: 4000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;

  @ApiProperty({
    description: 'Vai trò người gửi (mặc định là USER)',
    enum: MessageRole,
    example: MessageRole.USER,
    required: false,
    enumName: 'MessageRole',
  })
  @IsOptional()
  @IsEnum(MessageRole)
  role?: MessageRole;

  @ApiProperty({
    description: 'Metadata bổ sung (attachments, mentions, etc.)',
    example: { attachments: [], mentioned_users: [] },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiProperty({
    description: 'System prompt cho AI (chỉ dùng khi cần custom behavior)',
    example: 'Bạn là trợ lý hỗ trợ khách hàng chuyên nghiệp của Heartie.',
    required: false,
  })
  @IsOptional()
  @IsString()
  systemPrompt?: string;
}
