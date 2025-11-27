import { ApiProperty } from '@nestjs/swagger';
import { ConversationType } from '../enums/conversation.enums';

export class ConversationResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({
    enum: ConversationType,
    example: ConversationType.USER_ASSISTANT,
  })
  type: ConversationType;

  @ApiProperty({
    example: { source: 'web', initialTopic: 'order_tracking' },
  })
  metadata: Record<string, unknown>;

  @ApiProperty({
    example: '2025-10-28T00:00:00.000Z',
    nullable: true,
  })
  lastMessageAt: Date | null;

  @ApiProperty({
    example: 5,
    nullable: true,
  })
  lastMessageId: number | null;

  @ApiProperty({ example: '2025-10-28T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-10-28T00:00:00.000Z' })
  updatedAt: Date;
}

export class ConversationListResponseDto {
  @ApiProperty({
    type: [ConversationResponseDto],
    description: 'Danh sách hội thoại',
  })
  items: ConversationResponseDto[];

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'ID cursor cho trang tiếp theo (null nếu hết)',
  })
  nextCursor: number | null;
}
