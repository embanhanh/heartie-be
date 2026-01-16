import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageSearchService } from './image-search.service';
import { ImageSearchController } from './image-search.controller';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { VisionModule } from '../vision/vision.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductVariant]), VisionModule],
  controllers: [ImageSearchController],
  providers: [ImageSearchService],
  exports: [ImageSearchService],
})
export class ImageSearchModule {}
