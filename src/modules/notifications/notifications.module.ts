import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationToken } from './entities/notification-token.entity';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([NotificationToken])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
