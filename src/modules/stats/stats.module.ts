import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdsAiCampaign } from '../ads_ai/entities/ads-ai-campaign.entity';
import { Branch } from '../branches/entities/branch.entity';
import { ProductVariantInventory } from '../inventory/entities/product-variant-inventory.entity';
import { OrderItem } from '../order_items/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { DailyStatistic } from './entities/daily-statistic.entity';
import { ProductsStatsController } from './products-stats.controller';
import { StatsCacheService } from './services/stats-cache.service';
import { StatsTrackingService } from './services/stats-tracking.service';
import { StatsCronService } from './stats-cron.service';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Product,
      ProductVariantInventory,
      AdsAiCampaign,
      DailyStatistic,
      Branch,
    ]),
  ],
  controllers: [StatsController, ProductsStatsController],
  providers: [StatsService, StatsCacheService, StatsTrackingService, StatsCronService],
  exports: [StatsTrackingService],
})
export class StatsModule {}
