import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionCustomerGroupsController } from './promotion_customer_groups.controller';
import { PromotionCustomerGroupsService } from './promotion_customer_groups.service';
import { PromotionCustomerGroup } from './entities/promotion-customer-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PromotionCustomerGroup])],
  controllers: [PromotionCustomerGroupsController],
  providers: [PromotionCustomerGroupsService],
  exports: [PromotionCustomerGroupsService, TypeOrmModule],
})
export class PromotionCustomerGroupsModule {}
