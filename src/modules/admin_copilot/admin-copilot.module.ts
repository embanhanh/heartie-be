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
import { User } from '../users/entities/user.entity';

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
    AuthModule,
  ],
  controllers: [AdminCopilotController],
  providers: [AdminCopilotService, AdminCopilotGateway],
  exports: [AdminCopilotService],
})
export class AdminCopilotModule {}
