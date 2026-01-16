import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { Brand } from '../brands/entities/brand.entity';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { ProductVariantInventory } from '../inventory/entities/product-variant-inventory.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Attribute } from '../attributes/entities/attribute.entity';
import { AttributeValue } from '../attribute_values/entities/attribute-value.entity';
import { ProductAttribute } from '../product_attributes/entities/product-attribute.entity';
import { VariantAttributeValue } from '../variant_attribute_values/entities/variant-attribute-value.entity';
import { SemanticSearchModule } from '../semantic_search/semantic-search.module';
import { StatsModule } from '../stats/stats.module';
import { GeminiModule } from '../gemini/gemini.module';
import { VisionModule } from '../vision/vision.module';
import { ImageSearchModule } from '../image_search/image-search.module';
import { UploadModule } from '../upload/upload.module';

import { ProductsStatsController } from '../stats/products-stats.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      Brand,
      ProductVariant,
      ProductVariantInventory,
      Attribute,
      AttributeValue,
      ProductAttribute,
      VariantAttributeValue,
      Branch,
    ]),
    StatsModule,
    GeminiModule,
    VisionModule,
    ImageSearchModule,
    UploadModule,
    SemanticSearchModule,
  ],
  controllers: [ProductsStatsController, ProductsController],
  providers: [ProductsService],
  exports: [TypeOrmModule, ProductsService],
})
export class ProductsModule {}
