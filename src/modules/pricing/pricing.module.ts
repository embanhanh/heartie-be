import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { Promotion } from '../promotions/entities/promotion.entity';
import { UserCustomerGroup } from '../user_customer_groups/entities/user-customer-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductVariant, Promotion, UserCustomerGroup])],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
