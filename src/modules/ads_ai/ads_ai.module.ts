import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdsAiController } from './ads_ai.controller';
import { AdsAiService } from './ads_ai.service';
import { AdsAiCampaign } from './entities/ads-ai-campaign.entity';
import { Product } from '../products/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AdsAiCampaign, Product])],
  controllers: [AdsAiController],
  providers: [AdsAiService],
  exports: [AdsAiService],
})
export class AdsAiModule {}
