import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export enum AdminCopilotMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export class AdminCopilotHistoryMessageDto {
  @ApiProperty({ enum: AdminCopilotMessageRole })
  @IsEnum(AdminCopilotMessageRole)
  role!: AdminCopilotMessageRole;

  @ApiProperty({ description: 'Nội dung tin nhắn', maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class AdminCopilotChatRequestDto {
  @ApiProperty({ description: 'Tin nhắn câu hỏi của admin', maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({ description: 'Conversation ID để tiếp tục hội thoại', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  conversationId?: number;

  @ApiPropertyOptional({ type: [AdminCopilotHistoryMessageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminCopilotHistoryMessageDto)
  history?: AdminCopilotHistoryMessageDto[];
}

export class AdminCopilotFunctionCallDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ type: Object })
  args!: Record<string, unknown>;
}

export class AdminCopilotResponseDto {
  @ApiProperty({ description: 'Câu trả lời cuối cùng dành cho admin' })
  reply!: string;

  @ApiPropertyOptional({ description: 'Thông tin function call (nếu có)' })
  functionCall?: AdminCopilotFunctionCallDto | null;

  @ApiPropertyOptional({ description: 'Kết quả dữ liệu từ tool (nếu tool được gọi)', type: Object })
  toolResult?: Record<string, unknown> | null;

  @ApiProperty({
    type: [AdminCopilotHistoryMessageDto],
    description: 'Các message cần append vào history phía client',
  })
  newHistory!: AdminCopilotHistoryMessageDto[];

  @ApiPropertyOptional({ description: 'Thông tin gợi ý thêm dành cho UI/analytics', type: Object })
  metadata?: Record<string, unknown>;
}
