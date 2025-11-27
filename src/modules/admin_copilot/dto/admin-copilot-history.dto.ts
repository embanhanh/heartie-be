import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PaginationMeta, PaginationOptionsDto } from '../../../common/dto/pagination.dto';
import { AdminCopilotMessageRole } from './admin-copilot-chat.dto';

export class AdminCopilotHistoryQueryDto extends PaginationOptionsDto {
  @ApiPropertyOptional({
    description:
      'Conversation ID to load. If omitted, the admin copilot conversation will be resolved automatically.',
    type: Number,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  conversationId?: number;
}

export class AdminCopilotHistoryItemDto {
  @ApiProperty({ description: 'Unique identifier of the message' })
  id!: number;

  @ApiProperty({ enum: AdminCopilotMessageRole })
  role!: AdminCopilotMessageRole;

  @ApiProperty({ description: 'Message content' })
  content!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, unknown> | null;
}

export class AdminCopilotHistoryMetaDto implements PaginationMeta {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AdminCopilotHistoryResponseDto {
  @ApiProperty({ description: 'Conversation identifier resolved for this admin' })
  conversationId!: number;

  @ApiProperty({ type: [AdminCopilotHistoryItemDto] })
  data!: AdminCopilotHistoryItemDto[];

  @ApiProperty({ type: AdminCopilotHistoryMetaDto })
  meta!: AdminCopilotHistoryMetaDto;
}
