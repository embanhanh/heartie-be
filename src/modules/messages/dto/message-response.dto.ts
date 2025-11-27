import { ApiProperty } from '@nestjs/swagger';
import { MessageRole } from '../enums/message.enums';

export class MessageResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  conversationId: number;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'ID của participant gửi tin nhắn (null nếu là system/assistant)',
  })
  senderParticipantId: number | null;

  @ApiProperty({
    enum: MessageRole,
    example: MessageRole.USER,
  })
  role: MessageRole;

  @ApiProperty({
    example: 'Xin chào! Tôi muốn tra cứu đơn hàng.',
    nullable: true,
  })
  content: string | null;

  @ApiProperty({
    example: { type: 'user_message' },
    nullable: true,
  })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ example: '2025-10-28T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-10-28T00:00:00.000Z' })
  updatedAt: Date;
}

export class SendMessageResponseDto {
  @ApiProperty({ example: 1 })
  conversationId: number;

  @ApiProperty({
    type: MessageResponseDto,
    description: 'Tin nhắn của user',
  })
  userMessage: MessageResponseDto;

  @ApiProperty({
    type: MessageResponseDto,
    description: 'Phản hồi từ assistant/admin',
  })
  assistantMessage: MessageResponseDto;
}
