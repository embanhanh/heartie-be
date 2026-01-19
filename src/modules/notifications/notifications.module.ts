import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationToken } from './entities/notification-token.entity';
import { Notification } from './entities/notification.entity';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { EmailModule } from '../email/email.module';

import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([NotificationToken, Notification, User]),
    EmailModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
