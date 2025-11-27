import { Body, Controller, Delete, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import {
  RegisterNotificationTokenRequestDto,
  RemoveNotificationTokenDto,
  SendAdminOrderNotificationDto,
  SendUserOrderStatusNotificationDto,
  NotificationDispatchResponseDto,
} from './dto/notifications-controller.dto';
import { NotificationToken } from './entities/notification-token.entity';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('tokens')
  @ApiOperation({ summary: 'Register a Firebase device token for a user' })
  @ApiCreatedResponse({ type: NotificationToken })
  async registerToken(
    @Body() body: RegisterNotificationTokenRequestDto,
  ): Promise<NotificationToken> {
    return this.notificationsService.registerToken(body.userId, body);
  }

  @Delete('tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a Firebase device token' })
  @ApiOkResponse({ schema: { properties: { success: { type: 'boolean' } } } })
  async removeToken(@Body() body: RemoveNotificationTokenDto): Promise<{ success: boolean }> {
    const success = await this.notificationsService.removeToken(body.token, body.userId);
    return { success };
  }

  @Post('test/admin-order')
  @ApiOperation({ summary: 'Send a test notification to admins about a newly created order' })
  @ApiOkResponse({ type: NotificationDispatchResponseDto })
  async sendAdminOrderNotification(
    @Body() body: SendAdminOrderNotificationDto,
  ): Promise<NotificationDispatchResponseDto> {
    return this.notificationsService.notifyAdminsOrderCreated(body);
  }

  @Post('test/order-status')
  @ApiOperation({ summary: 'Send a test order status update notification to a user' })
  @ApiOkResponse({ type: NotificationDispatchResponseDto })
  async sendUserOrderStatusNotification(
    @Body() body: SendUserOrderStatusNotificationDto,
  ): Promise<NotificationDispatchResponseDto> {
    return this.notificationsService.notifyUserOrderStatusChanged(body);
  }
}
