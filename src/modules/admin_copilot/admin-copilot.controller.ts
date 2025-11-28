import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminCopilotService } from './admin-copilot.service';
import { AdminCopilotChatRequestDto, AdminCopilotResponseDto } from './dto/admin-copilot-chat.dto';
import {
  AdminCopilotRevenueOverviewQueryDto,
  AdminCopilotStockAlertsQueryDto,
  AdminCopilotTopProductsQueryDto,
} from './dto/admin-copilot-tool-query.dto';
import {
  AdminCopilotHistoryQueryDto,
  AdminCopilotHistoryResponseDto,
} from './dto/admin-copilot-history.dto';
import { Request } from 'express';

@ApiTags('admin-copilot')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), AdminGuard)
@Controller('admin/copilot')
export class AdminCopilotController {
  constructor(private readonly service: AdminCopilotService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Trò chuyện với trợ lý AI dành cho admin Fashia' })
  chat(
    @Body() dto: AdminCopilotChatRequestDto,
    @Req() req: Request,
  ): Promise<AdminCopilotResponseDto> {
    const user = req.user as { id: number };
    return this.service.chat(dto, user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Lấy lịch sử hội thoại giữa admin và copilot' })
  @ApiResponse({
    status: 200,
    description: 'Lịch sử hội thoại được phân trang',
    type: AdminCopilotHistoryResponseDto,
  })
  getHistory(
    @Query() query: AdminCopilotHistoryQueryDto,
    @Req() req: Request,
  ): Promise<AdminCopilotHistoryResponseDto> {
    const user = req.user as { id: number };
    return this.service.getHistory(user.id, query);
  }

  @Get('revenue-overview')
  @ApiOperation({ summary: 'Tổng quan doanh thu và đơn hàng theo khoảng thời gian' })
  getRevenueOverview(@Query() query: AdminCopilotRevenueOverviewQueryDto, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.service.getRevenueOverview(user.id, query);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Danh sách sản phẩm bán chạy nhất theo doanh thu' })
  getTopProducts(@Query() query: AdminCopilotTopProductsQueryDto, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.service.getTopProducts(user.id, query);
  }

  @Get('stock-alerts')
  @ApiOperation({ summary: 'Danh sách cảnh báo tồn kho thấp theo SKU/chi nhánh' })
  getStockAlerts(@Query() query: AdminCopilotStockAlertsQueryDto, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.service.getStockAlerts(user.id, query);
  }
}
