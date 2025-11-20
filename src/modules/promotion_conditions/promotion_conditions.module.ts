import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionConditionsController } from './promotion_conditions.controller';
import { PromotionConditionsService } from './promotion_conditions.service';
import { PromotionCondition } from './entities/promotion-condition.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PromotionCondition])],
  controllers: [PromotionConditionsController],
  providers: [PromotionConditionsService],
  exports: [PromotionConditionsService, TypeOrmModule],
})
export class PromotionConditionsModule {}
