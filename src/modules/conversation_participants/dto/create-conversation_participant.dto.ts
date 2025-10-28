import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsObject, Min } from 'class-validator';

export class CreateConversationParticipantDto {
  @ApiProperty({
    description: 'ID của cuộc hội thoại mà participant sẽ được thêm vào',
    example: 42,
  })
  @IsInt()
  @Min(1)
  conversationId: number;

  @ApiProperty({
    description: 'ID của user (người dùng hoặc admin) được thêm vào hội thoại',
    example: 7,
  })
  @IsInt()
  @Min(1)
  userId: number;

  @ApiProperty({
    description: 'Tùy chọn cấu hình participant (ví dụ: displayName, mute, pinned, ...)',
    required: false,
    example: { displayName: 'Admin Support Bot' },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
