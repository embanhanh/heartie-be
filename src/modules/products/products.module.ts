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
import { AttributesModule } from '../attributes/attributes.module';
import { MulterModule } from '@nestjs/platform-express';
import { createModuleMulterOptions } from 'src/common/utils/upload.util';
import { SemanticSearchModule } from '../semantic_search/semantic-search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      Brand,
      ProductVariant,
      ProductVariantInventory,
      Branch,
    ]),
    AttributesModule,
    MulterModule.register(createModuleMulterOptions({ moduleName: 'products' })),
    SemanticSearchModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [TypeOrmModule, ProductsService],
})
export class ProductsModule {}
