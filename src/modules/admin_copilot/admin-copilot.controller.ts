import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminCopilotService } from './admin-copilot.service';
import {
  AdminCopilotAttachmentDto,
  AdminCopilotChatRequestDto,
  AdminCopilotResponseDto,
} from './dto/admin-copilot-chat.dto';
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
import { createModuleMulterOptions, resolveModuleUploadPath } from '../../common/utils/upload.util';
import { UploadedFile as MulterUploadedFile } from '../../common/types/uploaded-file.type';
import { randomUUID } from 'crypto';

@ApiTags('admin-copilot')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), AdminGuard)
@Controller('admin/copilot')
export class AdminCopilotController {
  constructor(private readonly service: AdminCopilotService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Trò chuyện với trợ lý AI dành cho admin Fashia' })
  @UseInterceptors(
    FileInterceptor(
      'attachment',
      createModuleMulterOptions({
        moduleName: 'ads-ai',
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        limits: { fileSize: 5 * 1024 * 1024 },
      }),
    ),
  )
  chat(
    @Body() dto: AdminCopilotChatRequestDto,
    @UploadedFile() attachment: MulterUploadedFile | undefined,
    @Req() req: Request,
  ): Promise<AdminCopilotResponseDto> {
    console.log('Received DTO:', dto);

    const user = req.user as { id: number };
    let normalizedDto: AdminCopilotChatRequestDto = dto;

    if (attachment) {
      const storedPath = resolveModuleUploadPath('ads-ai', attachment);
      if (storedPath) {
        const attachmentRecord: AdminCopilotAttachmentDto = {
          id: randomUUID(),
          type: 'image',
          url: storedPath,
          name: attachment.originalname ?? undefined,
          mimeType: attachment.mimetype,
          size: attachment.size,
          meta: {
            module: 'ads-ai',
            uploadedAt: new Date().toISOString(),
          },
        };

        normalizedDto = {
          ...dto,
          attachments: [...(dto.attachments ?? []), attachmentRecord],
        };
      }
    }

    console.log('Normalized DTO:', normalizedDto);

    return this.service.chat(normalizedDto, user.id);
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
