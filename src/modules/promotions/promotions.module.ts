import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { Promotion } from './entities/promotion.entity';
import { PromotionCondition } from '../promotion_conditions/entities/promotion-condition.entity';
import { PromotionBranch } from '../promotion_branches/entities/promotion-branch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Promotion, PromotionCondition, PromotionBranch])],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [TypeOrmModule, PromotionsService],
})
export class PromotionsModule {}
