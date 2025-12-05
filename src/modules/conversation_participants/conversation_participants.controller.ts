import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ConversationParticipantsService } from './conversation_participants.service';
import { CreateConversationParticipantDto } from './dto/create-conversation_participant.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@ApiTags('Conversation Participants')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('conversation-participants')
export class ConversationParticipantsController {
  constructor(private readonly participantsService: ConversationParticipantsService) {}

  @Get(':conversationId')
  @ApiOperation({ summary: 'Lấy danh sách participants của 1 hội thoại' })
  async findAll(@Param('conversationId') conversationId: number, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.participantsService.listParticipants(user.id, conversationId);
  }

  @Post(':id')
  @ApiOperation({ summary: 'Thêm participant vào hội thoại (chỉ admin)' })
  async addParticipant(
    @Body() dto: CreateConversationParticipantDto,
    @Req() req: Request,
    @Param('id') id: number,
  ) {
    const user = req.user as { id: number };
    return this.participantsService.addAdmin(user.id, id, dto.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa participant khỏi hội thoại (chỉ admin hoặc chính user)' })
  async remove(@Param('id') id: number, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.participantsService.leaveConversation(user.id, id);
  }
}
