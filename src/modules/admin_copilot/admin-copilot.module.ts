import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminCopilotController } from './admin-copilot.controller';
import { AdminCopilotService } from './admin-copilot.service';
import { AdminCopilotGateway } from './admin-copilot.gateway';
import { OrderItem } from '../order_items/entities/order-item.entity';
import { ProductVariantInventory } from '../inventory/entities/product-variant-inventory.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversation_participants/entities/conversation_participant.entity';
import { Message } from '../messages/entities/message.entity';
import { TrendForecastingModule } from '../trend_forecasting/trend-forecasting.module';
import { GeminiModule } from '../gemini/gemini.module';
import { AuthModule } from '../auth/auth.module';
import { AdsAiModule } from '../ads_ai/ads_ai.module';
import { StatsModule } from '../stats/stats.module';
import { User } from '../users/entities/user.entity';
import { AdminCopilotProactiveService } from './services/admin-copilot-proactive.service';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      OrderItem,
      ProductVariantInventory,
      Conversation,
      ConversationParticipant,
      Message,
    ]),
    TrendForecastingModule,
    GeminiModule,
    AdsAiModule,
    StatsModule,
    AuthModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          url: `redis://${configService.get<string>('REDIS_HOST', 'localhost')}:${configService.get<string>('REDIS_PORT', '6379')}`,
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        }),
        ttl: 3600, // 1 hour cache
      }),
    }),
  ],
  controllers: [AdminCopilotController],
  providers: [AdminCopilotService, AdminCopilotGateway, AdminCopilotProactiveService],
  exports: [AdminCopilotService],
})
export class AdminCopilotModule {}
