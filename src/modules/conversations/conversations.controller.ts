import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  Body,
  UseGuards,
  Query,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import {
  ConversationResponseDto,
  ConversationListResponseDto,
} from './dto/conversation-response.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Tạo hội thoại mới',
    description: `
    Tạo hội thoại mới với các loại:
    - USER_ASSISTANT: Chat với AI assistant (chatbot)
    - USER_ADMIN: Chat với admin (support ticket)
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Hội thoại được tạo thành công',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async create(@Body() dto: CreateConversationDto, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.conversationsService.createConversation(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách hội thoại của user hiện tại',
    description: 'Trả về danh sách hội thoại có phân trang (cursor-based)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số lượng hội thoại mỗi trang (mặc định: 20, tối đa: 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'cursorId',
    required: false,
    type: Number,
    description: 'ID của hội thoại cuối cùng trong trang trước (để lấy trang tiếp theo)',
    example: null,
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách hội thoại',
    type: ConversationListResponseDto,
  })
  async findAll(
    @Req() req: Request,
    @Query('limit') limit?: number,
    @Query('cursorId') cursorId?: number,
  ) {
    const user = req.user as { id: number };
    return this.conversationsService.listMyConversations(user.id, {
      limit: limit ? Number(limit) : undefined,
      cursorId: cursorId ? Number(cursorId) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy chi tiết hội thoại',
    description:
      'Lấy thông tin chi tiết hội thoại (không bao gồm messages, dùng GET /messages?conversationId=X để lấy messages)',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID của hội thoại',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết hội thoại',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hội thoại' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.conversationsService.getConversationDetail(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Xóa hội thoại',
    description: 'Xóa mềm (soft delete) hội thoại. Chỉ user tham gia hội thoại mới có quyền xóa.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID của hội thoại cần xóa',
    example: 1,
  })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hội thoại' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as { id: number };
    await this.conversationsService.remove(user.id, id);
    return { success: true, message: 'Conversation deleted successfully' };
  }
}
