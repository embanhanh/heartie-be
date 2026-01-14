import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { IsNull, Repository } from 'typeorm';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import {
  getMessaging,
  Messaging,
  MulticastMessage,
  WebpushConfig,
  WebpushNotification,
} from 'firebase-admin/messaging';
import { NotificationToken } from './entities/notification-token.entity';
import { Notification } from './entities/notification.entity';
import { RegisterNotificationTokenDto } from './dto/register-notification-token.dto';
import { UserRole } from '../users/entities/user.entity';
import { FirebaseConfig } from '../../config/firebase.config';
import { OrderStatus, Order } from '../orders/entities/order.entity';
import { EmailService } from '../email/email.service';

export interface OrderCreatedAdminPayload {
  orderId: number;
  orderNumber: string;
  totalAmount: number;
  userId?: number | null;
}

export interface OrderStatusChangedPayload {
  orderId: number;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  userId: number;
}

export interface NotificationDispatchResult {
  success: boolean;
  targetedReceivers: number;
  successCount: number;
  failureCount: number;
  errors: string[];
  topicSent: boolean;
}

interface DispatchOptions {
  tokens: string[];
  notification: MulticastMessage['notification'];
  data?: Record<string, unknown>;
  topic?: string;
}

const DEFAULT_WEB_ICON = '/images/fashia_logo.png';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly firebaseConfig: FirebaseConfig;
  private messaging?: Messaging;

  constructor(
    @InjectRepository(NotificationToken)
    private readonly notificationTokenRepo: Repository<NotificationToken>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.firebaseConfig = this.configService.get<FirebaseConfig>('firebase') ?? {};
    this.initializeFirebaseMessaging();
  }

  async notifyUserOrderCreated(order: Order): Promise<void> {
    // Send Email
    await this.emailService.sendOrderCreated(order);

    // Send Push Notification
    if (order.userId) {
      const title = `Đặt hàng thành công`;
      const body = `Cảm ơn bạn đã đặt hàng! Đơn hàng ${order.orderNumber} của bạn đã được tiếp nhận.`;

      await this.createNotification(order.userId, title, body, {
        type: 'order_created_user',
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        link: `/orders/${order.id}`,
        icon: DEFAULT_WEB_ICON,
      });

      const tokens = await this.getUserTokens(order.userId);
      await this.dispatchNotification({
        tokens,
        notification: { title, body },
        data: {
          type: 'order_created_user',
          orderId: order.id,
          orderNumber: order.orderNumber,
          link: `/orders/${order.id}`,
        },
      });
    }
  }

  async registerToken(
    userId: number,
    dto: RegisterNotificationTokenDto,
  ): Promise<NotificationToken> {
    await this.notificationTokenRepo.delete({ token: IsNull() });

    const token = dto.token.trim();
    const deviceId = dto.deviceId ? dto.deviceId.trim() : null;
    const platform = dto.platform ?? 'web';
    const metadata = dto.metadata ?? null;

    // 1. Find existing record by token
    const existingByToken = await this.notificationTokenRepo.findOne({
      where: { token },
    });

    // 2. Find existing record by (userId, deviceId) - if deviceId is present
    let existingByDevice: NotificationToken | null = null;
    if (deviceId) {
      existingByDevice = await this.notificationTokenRepo.findOne({
        where: { userId, deviceId },
      });
    }

    // Logic to resolve conflicts:
    // We want the final state to be: A record exists with { userId, deviceId, token, ... }
    // We must ensure unique constraints on 'token' and '(userId, deviceId)' are respected.

    if (existingByToken && existingByDevice) {
      if (existingByToken.id === existingByDevice.id) {
        // Case A: The existing token record IS the same as the user/device record.
        // Just update metadata.
        existingByToken.platform = platform;
        existingByToken.metadata = metadata;
        existingByToken.lastUsedAt = new Date();
        existingByToken.isActive = true;
        // userId and deviceId are already correct
        return this.notificationTokenRepo.save(existingByToken);
      } else {
        // Case B: Token exists on Row 1, User/Device exists on Row 2.
        // We want User/Device (Row 2) to claim this Token.
        // Row 1 is now invalid (token moved). Delete Row 1.
        await this.notificationTokenRepo.delete(existingByToken.id);

        // Update Row 2 with the token.
        existingByDevice.token = token;
        existingByDevice.platform = platform;
        existingByDevice.metadata = metadata;
        existingByDevice.lastUsedAt = new Date();
        existingByDevice.isActive = true;
        return this.notificationTokenRepo.save(existingByDevice);
      }
    } else if (existingByToken && !existingByDevice) {
      // Case C: Token exists (Row 1), but no record for this User/Device.
      // We assume Row 1 is the record we want to "move" to this User/Device context (or it's already correct userId but different deviceId? No, different deviceId would be caught above if we searched by just userId?)
      // Actually, if deviceId is null, existingByDevice is null.
      // Or if deviceId is new for this user.

      // If existingByToken.userId !== userId, we are moving token to new user.
      // If existingByToken.deviceId !== deviceId, we are moving token to new device (likely existingByToken.deviceId was null or different).

      // CAUTION: If we update Row 1 to use (userId, deviceId), we must be sure no other row has (userId, deviceId).
      // We already checked existingByDevice (by userId, deviceId). It is null. So safe to update.

      existingByToken.userId = userId;
      existingByToken.deviceId = deviceId;
      existingByToken.platform = platform;
      existingByToken.metadata = metadata;
      existingByToken.lastUsedAt = new Date();
      existingByToken.isActive = true;
      return this.notificationTokenRepo.save(existingByToken);
    } else if (!existingByToken && existingByDevice) {
      // Case D: Token is new (not in DB). User/Device record exists (Row 2).
      // Update Row 2 with new token.
      existingByDevice.token = token;
      existingByDevice.platform = platform;
      existingByDevice.metadata = metadata;
      existingByDevice.lastUsedAt = new Date();
      existingByDevice.isActive = true;
      return this.notificationTokenRepo.save(existingByDevice);
    } else {
      // Case E: Neither exists. New record.
      const newEntity = this.notificationTokenRepo.create({
        userId,
        token,
        deviceId,
        platform,
        metadata,
        lastUsedAt: new Date(),
        isActive: true,
      });
      return this.notificationTokenRepo.save(newEntity);
    }
  }

  async removeToken(token: string, userId?: number): Promise<boolean> {
    const result = await this.notificationTokenRepo.delete({
      token,
      ...(userId ? { userId } : {}),
    });
    return (result.affected ?? 0) > 0;
  }

  async getNotifications(
    userId: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: Notification[]; total: number }> {
    const [data, total] = await this.notificationRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async markAsRead(userId: number, notificationId: number): Promise<void> {
    await this.notificationRepo.update({ id: notificationId, userId }, { readAt: new Date() });
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepo.update({ userId, readAt: IsNull() }, { readAt: new Date() });
  }

  private async createNotification(
    userId: number,
    title: string,
    body: string,
    data?: Record<string, any> | null,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId,
      title,
      body,
      data,
    });
    return this.notificationRepo.save(notification);
  }

  async notifyAdminsOrderCreated(
    payload: OrderCreatedAdminPayload,
  ): Promise<NotificationDispatchResult> {
    const tokens = await this.getAdminTokens();
    const formattedAmount = this.formatCurrency(payload.totalAmount);

    return this.dispatchNotification({
      tokens,
      topic: this.firebaseConfig.adminTopic,
      notification: {
        title: 'Đơn hàng mới',
        body: `Đơn hàng ${payload.orderNumber} trị giá ${formattedAmount}.`,
      },
      data: {
        type: 'order_created',
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        totalAmount: payload.totalAmount,
        userId: payload.userId ?? '',
        link: `/admin/orders/${payload.orderId}`,
        icon: DEFAULT_WEB_ICON,
      },
    });
  }

  async notifyAdminsAdPublished(payload: {
    id: number;
    name: string;
    publishedAt: Date;
    type: string;
  }): Promise<NotificationDispatchResult> {
    const tokens = await this.getAdminTokens();

    return this.dispatchNotification({
      tokens,
      topic: this.firebaseConfig.adminTopic,
      notification: {
        title: 'Quảng cáo đã được đăng',
        body: `Chiến dịch "${payload.name}" đã được đăng thành công lên Facebook.`,
      },
      data: {
        type: 'ad_published',
        id: payload.id,
        name: payload.name,
        postType: payload.type,
        link: `/admin`,
        icon: DEFAULT_WEB_ICON,
      },
    });
  }

  async notifyUserOrderStatusChanged(
    payload: OrderStatusChangedPayload,
    order?: Order,
  ): Promise<NotificationDispatchResult> {
    // Send Email if order object is provided
    if (order) {
      await this.emailService.sendOrderStatusChanged(order);
    }

    // Persist notification
    await this.createNotification(
      payload.userId,
      `Đơn hàng ${payload.orderNumber}`,
      this.buildStatusMessage(payload.status),
      {
        type: 'order_status',
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        status: payload.status,
        totalAmount: payload.totalAmount,
        link: `/orders/${payload.orderId}`,
        icon: DEFAULT_WEB_ICON,
      },
    );

    const tokens = await this.getUserTokens(payload.userId);

    return this.dispatchNotification({
      tokens,
      notification: {
        title: `Đơn hàng ${payload.orderNumber}`,
        body: this.buildStatusMessage(payload.status),
        // imageUrl: DEFAULT_WEB_ICON,
      },
      data: {
        type: 'order_status',
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        status: payload.status,
        totalAmount: payload.totalAmount,
        userId: payload.userId,
        link: `/orders/${payload.orderId}`,
        icon: DEFAULT_WEB_ICON,
      },
    });
  }

  private initializeFirebaseMessaging() {
    const { projectId, clientEmail, privateKey } = this.firebaseConfig;

    console.log('Firebase Config in NotificationsService:', {
      projectId,
      clientEmail,
      hasPrivateKey: privateKey,
    });

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials are missing; push notifications are disabled.');
      return;
    }

    try {
      if (!getApps().length) {
        initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        });
      }

      this.messaging = getMessaging();
      this.logger.log('Firebase messaging initialised successfully.');
    } catch (error) {
      this.logger.error(
        'Failed to initialise Firebase messaging',
        error instanceof Error ? error.stack : `${error}`,
      );
      this.messaging = undefined;
    }
  }

  private async getAdminTokens(): Promise<string[]> {
    const roles: UserRole[] = [UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.STAFF];

    const rows = await this.notificationTokenRepo
      .createQueryBuilder('token')
      .innerJoin('token.user', 'user')
      .select('token.token', 'token')
      .where('token.isActive = :active', { active: true })
      .andWhere('user.isActive = :userActive', { userActive: true })
      .andWhere('user.role IN (:...roles)', { roles })
      .getRawMany<{ token: string }>();

    return [...new Set(rows.map((row) => row.token).filter(Boolean))];
  }

  private async getUserTokens(userId: number): Promise<string[]> {
    if (!userId) {
      return [];
    }

    const tokens = await this.notificationTokenRepo.find({
      where: { userId, isActive: true },
    });

    return tokens.map((token) => token.token);
  }

  private async dispatchNotification({
    tokens,
    notification,
    data,
    topic,
  }: DispatchOptions): Promise<NotificationDispatchResult> {
    const totalReceivers = tokens.length;

    if (!this.messaging) {
      if (totalReceivers > 0) {
        this.logger.warn(
          'Attempted to send push notification without Firebase messaging instance.',
        );
      }

      return {
        success: false,
        targetedReceivers: totalReceivers,
        successCount: 0,
        failureCount: totalReceivers,
        errors: ['firebase-disabled'],
        topicSent: false,
      };
    }

    const sanitizedData = this.stringifyData(data ?? {});
    const errors: string[] = [];
    let successCount = 0;
    let failureCount = 0;
    let topicSent = false;

    const invalidTokens: string[] = [];

    if (tokens.length) {
      for (const chunk of this.chunk(tokens, 500)) {
        try {
          const dataForChunk = { ...sanitizedData };
          //   const webpush = this.buildWebpushConfig(notification, dataForChunk);

          const payload = {
            tokens: chunk,
            notification,
            data: dataForChunk,
            // webpush,
          };

          console.log('Sending notification with payload:', JSON.stringify(payload));
          const response = await this.messaging.sendEachForMulticast(payload);

          console.log('Sending notification response:', response);

          successCount += response.successCount;
          failureCount += response.failureCount;

          response.responses.forEach((singleResponse, index) => {
            if (!singleResponse.success && singleResponse.error) {
              const errorCode = singleResponse.error.code;
              errors.push(errorCode);

              if (this.isInvalidTokenError(errorCode)) {
                invalidTokens.push(chunk[index]);
              }
            }
          });
        } catch (error) {
          failureCount += chunk.length;
          const message = error instanceof Error ? error.message : `${error}`;
          errors.push(message);
          this.logger.error(
            'Failed to send multicast notification',
            error instanceof Error ? error.stack : message,
          );
        }
      }

      if (successCount > 0) {
        await this.touchTokens(tokens);
      }
    }

    if (topic && topic.trim().length > 0) {
      try {
        const topicData = { ...sanitizedData };
        await this.messaging.send({
          notification,
          data: topicData,
          topic,
          webpush: this.buildWebpushConfig(notification, topicData),
        });
        topicSent = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        errors.push(message);
        this.logger.error(
          `Failed to send notification to topic ${topic}`,
          error instanceof Error ? error.stack : message,
        );
      }
    }

    if (invalidTokens.length) {
      await this.deactivateTokens(invalidTokens);
    }

    return {
      success: successCount > 0 || topicSent,
      targetedReceivers: totalReceivers,
      successCount,
      failureCount,
      errors,
      topicSent,
    };
  }

  private stringifyData(data: Record<string, unknown>): Record<string, string> {
    return Object.entries(data).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value === undefined || value === null) {
        acc[key] = '';
      } else if (typeof value === 'string') {
        acc[key] = value;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        acc[key] = String(value);
      } else {
        acc[key] = JSON.stringify(value);
      }
      return acc;
    }, {});
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  private async touchTokens(tokens: string[]) {
    if (!tokens.length) {
      return;
    }

    await this.notificationTokenRepo
      .createQueryBuilder()
      .update(NotificationToken)
      .set({ lastUsedAt: () => 'CURRENT_TIMESTAMP', isActive: true })
      .where('token IN (:...tokens)', { tokens })
      .execute();
  }

  private async deactivateTokens(tokens: string[]) {
    if (!tokens.length) {
      return;
    }

    await this.notificationTokenRepo
      .createQueryBuilder()
      .update(NotificationToken)
      .set({ isActive: false, lastUsedAt: () => 'CURRENT_TIMESTAMP' })
      .where('token IN (:...tokens)', { tokens })
      .execute();
  }

  private isInvalidTokenError(code: string): boolean {
    const invalidCodes: string[] = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument',
    ];
    return invalidCodes.includes(code);
  }

  private buildStatusMessage(status: OrderStatus): string {
    const mapping: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'Đơn hàng của bạn đang chờ xác nhận.',
      [OrderStatus.PENDING_PAYMENT]: 'Đơn hàng của bạn đang chờ thanh toán.',
      [OrderStatus.CONFIRMED]: 'Đơn hàng của bạn đã được xác nhận.',
      [OrderStatus.PROCESSING]: 'Đơn hàng của bạn đang được xử lý.',
      [OrderStatus.SHIPPED]: 'Đơn hàng của bạn đã được giao cho đơn vị vận chuyển.',
      [OrderStatus.DELIVERED]: 'Đơn hàng của bạn đã được giao thành công.',
      [OrderStatus.CANCELLED]: 'Đơn hàng của bạn đã bị hủy.',
      [OrderStatus.RETURNED]: 'Đơn hàng của bạn đã được trả về.',
    };

    return mapping[status] ?? 'Đơn hàng của bạn đã được cập nhật.';
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount ?? 0);
  }

  private buildWebpushConfig(
    notification: MulticastMessage['notification'],
    data: Record<string, string>,
  ): WebpushConfig {
    const resolvedLink = this.resolveNotificationLink(data);
    const defaultIcon = DEFAULT_WEB_ICON;
    const defaultBadge = DEFAULT_WEB_ICON;

    if (resolvedLink && !data.link) {
      data.link = resolvedLink;
    }

    if (resolvedLink && !data.deepLink) {
      data.deepLink = resolvedLink;
    }

    if (!data.icon) {
      data.icon = defaultIcon;
    }

    const webpushNotification: WebpushNotification = {
      title: notification?.title,
      body: notification?.body,
      icon: notification?.imageUrl ?? defaultIcon,
      badge: defaultBadge,
      data,
      vibrate: [100, 50, 100],
      requireInteraction: true,
    };

    if (notification?.imageUrl) {
      webpushNotification.image = notification.imageUrl;
    }

    if (resolvedLink) {
      webpushNotification.actions = [
        {
          action: 'open-link',
          title: 'Xem chi tiết',
        },
      ];
    }

    const webpushConfig: WebpushConfig = {
      notification: webpushNotification,
      headers: {
        Urgency: 'high',
        TTL: '3600',
      },
    };

    if (resolvedLink) {
      webpushConfig.fcmOptions = {
        link: resolvedLink,
      };
    }

    return webpushConfig;
  }

  private resolveNotificationLink(data: Record<string, string>): string | undefined {
    const existingLink = [data.deepLink, data.link, data.url].find(
      (value) => typeof value === 'string' && value.trim().length > 0,
    );

    if (existingLink) {
      return existingLink;
    }

    if (data.type === 'order_status' && data.orderId) {
      return `/orders/${data.orderId}`;
    }

    if (data.type === 'order_created' && data.orderId) {
      return `/admin/orders/${data.orderId}`;
    }

    return undefined;
  }
}
