import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionalCombosService } from './promotional_combos.service';
import { PromotionalCombosController } from './promotional_combos.controller';
import { PromotionalCombo } from './entities/promotional_combo.entity';
import { Product } from 'src/modules/products/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PromotionalCombo, Product])],
  controllers: [PromotionalCombosController],
  providers: [PromotionalCombosService],
  exports: [TypeOrmModule],
})
export class PromotionalCombosModule {}
