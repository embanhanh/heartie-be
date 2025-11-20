import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionBranchesController } from './promotion_branches.controller';
import { PromotionBranchesService } from './promotion_branches.service';
import { PromotionBranch } from './entities/promotion-branch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PromotionBranch])],
  controllers: [PromotionBranchesController],
  providers: [PromotionBranchesService],
  exports: [PromotionBranchesService, TypeOrmModule],
})
export class PromotionBranchesModule {}
