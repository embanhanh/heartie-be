import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdsAiController } from './ads_ai.controller';
import { AdsAiService } from './ads_ai.service';
import { AdsAiCampaign } from './entities/ads-ai-campaign.entity';
import { Product } from '../products/entities/product.entity';
import { StatsModule } from '../stats/stats.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([AdsAiCampaign, Product]), StatsModule, NotificationsModule],
  controllers: [AdsAiController],
  providers: [AdsAiService],
  exports: [AdsAiService],
})
export class AdsAiModule {}
