import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdsAiController } from './ads_ai.controller';
import { AdsAiService } from './ads_ai.service';
import { AdsAiCampaign } from './entities/ads-ai-campaign.entity';
import { Product } from '../products/entities/product.entity';
import { StatsModule } from '../stats/stats.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { UploadModule } from '../upload/upload.module';
import { VideoAiService } from './video-ai.service';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdsAiCampaign, Product]),
    StatsModule,
    NotificationsModule,
    UploadModule,
    GeminiModule,
  ],
  controllers: [AdsAiController],
  providers: [AdsAiService, VideoAiService],
  exports: [AdsAiService, VideoAiService],
})
export class AdsAiModule {}
