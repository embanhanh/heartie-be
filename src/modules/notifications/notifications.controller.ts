import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Req,
  Post,
  Delete,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { RegisterNotificationTokenDto } from './dto/register-notification-token.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Req() req: Request & { user: { id: number } },
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    return this.notificationsService.getNotifications(req.user.id, page, limit);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllAsRead(@Req() req: Request & { user: { id: number } }) {
    await this.notificationsService.markAllAsRead(req.user.id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsRead(
    @Req() req: Request & { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.notificationsService.markAsRead(req.user.id, id);
  }

  @Post('tokens')
  async registerToken(
    @Req() req: Request & { user: { id: number } },
    @Body() dto: RegisterNotificationTokenDto,
  ) {
    return this.notificationsService.registerToken(req.user.id, dto);
  }

  @Delete('tokens')
  @HttpCode(HttpStatus.OK)
  async removeToken(@Req() req: Request & { user: { id: number } }, @Body('token') token: string) {
    await this.notificationsService.removeToken(token, req.user.id);
    return { success: true };
  }
}
