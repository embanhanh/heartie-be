import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionalComboDetailsService } from './promotional_combo_details.service';
import { PromotionalComboDetailsController } from './promotional_combo_details.controller';
import { PromotionalComboDetail } from './entities/promotional_combo_detail.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PromotionalComboDetail])],
  controllers: [PromotionalComboDetailsController],
  providers: [PromotionalComboDetailsService],
})
export class PromotionalComboDetailsModule {}
