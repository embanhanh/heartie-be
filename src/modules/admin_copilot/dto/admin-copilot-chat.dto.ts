import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
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
import { i18nValidationMessage } from 'nestjs-i18n';

function parseJsonObject(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function parseAttachmentArray(value: unknown): AdminCopilotAttachmentDto[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return plainToInstance(AdminCopilotAttachmentDto, parsed);
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  if (Array.isArray(value)) {
    return plainToInstance(AdminCopilotAttachmentDto, value);
  }

  return undefined;
}

export enum AdminCopilotMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export class AdminCopilotAttachmentDto {
  @ApiProperty({ description: 'ID đính kèm (thường là UUID)' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Loại đính kèm', enum: ['image', 'file', 'video', 'link'] })
  @IsString()
  type!: 'image' | 'file' | 'video' | 'link';

  @ApiProperty({ description: 'Đường dẫn hoặc URL tới file' })
  @IsString()
  url!: string;

  @ApiPropertyOptional({ description: 'Tên file gốc' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Kích thước file (bytes)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  size?: number;

  @ApiPropertyOptional({ description: 'MIME type của file' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ description: 'Metadata bổ sung cho đính kèm', type: Object })
  @IsOptional()
  meta?: Record<string, unknown>;
}

export class AdminCopilotHistoryMessageDto {
  @ApiProperty({ enum: AdminCopilotMessageRole })
  @IsEnum(AdminCopilotMessageRole)
  role!: AdminCopilotMessageRole;

  @ApiProperty({ description: 'Nội dung tin nhắn', maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  content!: string;

  @ApiPropertyOptional({ description: 'Metadata lưu kèm tin nhắn', type: Object })
  @IsOptional()
  @Transform(({ value }) => parseJsonObject(value))
  metadata?: Record<string, unknown> | null;
}

export class AdminCopilotChatRequestDto {
  @ApiProperty({ description: 'Tin nhắn câu hỏi của admin', maxLength: 4000 })
  @IsString({ message: i18nValidationMessage('adminCopilot.validation.message.string') })
  @MaxLength(4000, {
    message: i18nValidationMessage('adminCopilot.validation.message.maxLength'),
  })
  @IsNotEmpty({ message: i18nValidationMessage('adminCopilot.validation.message.required') })
  message!: string;

  @ApiPropertyOptional({ description: 'Conversation ID để tiếp tục hội thoại', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  conversationId?: number;

  @ApiPropertyOptional({ description: 'Đối tượng meta bổ sung cho ngữ cảnh', type: Object })
  @IsOptional()
  @Transform(({ value }) => parseJsonObject(value))
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Danh sách đính kèm hiện có',
    type: [AdminCopilotAttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Transform(({ value }) => parseAttachmentArray(value))
  @Type(() => AdminCopilotAttachmentDto)
  attachments?: AdminCopilotAttachmentDto[];
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
