import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductVariantsService } from './product_variants.service';
import { ProductVariantsController } from './product_variants.controller';
import { ProductVariant } from './entities/product_variant.entity';
import { VisionModule } from '../vision/vision.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProductVariant]), VisionModule],
  controllers: [ProductVariantsController],
  providers: [ProductVariantsService],
})
export class ProductVariantsModule {}
