import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrendForecastingService } from './trend-forecasting.service';
import { TrendForecastingController } from './trend-forecasting.controller';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../order_items/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { ReviewInsight } from '../review_analysis/entities/review-insight.entity';
import { Interaction } from '../interactions/entities/interaction.entity';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { DailyStatistic } from '../stats/entities/daily-statistic.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Product,
      ReviewInsight,
      Interaction,
      ProductVariant,
      DailyStatistic,
    ]),
    AuthModule,
  ],
  controllers: [TrendForecastingController],
  providers: [TrendForecastingService],
  exports: [TrendForecastingService],
})
export class TrendForecastingModule {}
