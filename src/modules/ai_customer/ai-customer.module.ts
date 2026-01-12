import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promotion } from '../promotions/entities/promotion.entity';
import { ProductsModule } from '../products/products.module';
import { PricingModule } from '../pricing/pricing.module';
import { AiCustomerController } from './ai-customer.controller';
import { AiCustomerService } from './ai-customer.service';
import { CartInsightsService } from './services/cart-insights.service';
import { CartProductContextFactory } from './services/cart-product-context.factory';
import { RatingsModule } from '../ratings/ratings.module';

@Module({
  imports: [ProductsModule, PricingModule, RatingsModule, TypeOrmModule.forFeature([Promotion])],
  controllers: [AiCustomerController],
  providers: [AiCustomerService, CartInsightsService, CartProductContextFactory],
  exports: [AiCustomerService],
})
export class AiCustomerModule {}
