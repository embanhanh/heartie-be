import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageResponseDto, SendMessageResponseDto } from './dto/message-response.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({
    summary: 'Gửi tin nhắn trong hội thoại',
    description: `
    Gửi tin nhắn mới trong hội thoại. 
    - Nếu là hội thoại USER_ASSISTANT: Sẽ tự động nhận phản hồi từ AI
    - Nếu là hội thoại USER_ADMIN: Tin nhắn sẽ được gửi cho admin
    
    AI có thể gọi các function tools:
    - track_order: Tra cứu trạng thái đơn hàng
    - create_return_request: Tạo yêu cầu hoàn trả
    - search_products: Tìm kiếm sản phẩm
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Tin nhắn được gửi thành công (bao gồm cả phản hồi từ AI nếu có)',
    type: SendMessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hội thoại' })
  async create(@Body() dto: CreateMessageDto, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.messagesService.create(dto, { id: user.id, role: UserRole.CUSTOMER });
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách tin nhắn',
    description: 'Lấy tin nhắn theo hội thoại (hoặc tất cả nếu không có filter)',
  })
  @ApiQuery({
    name: 'conversationId',
    required: false,
    type: Number,
    description: 'Lọc theo ID của hội thoại',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách tin nhắn',
    type: [MessageResponseDto],
  })
  async findAll(@Query('conversationId') conversationId?: number) {
    return this.messagesService.findAll(conversationId ? Number(conversationId) : undefined);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy chi tiết một tin nhắn',
    description: 'Lấy thông tin chi tiết của một tin nhắn cụ thể',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID của tin nhắn',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết tin nhắn',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tin nhắn' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.messagesService.findOne(id);
  }
}
