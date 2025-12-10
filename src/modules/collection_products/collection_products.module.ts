import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionProductsController } from './collection_products.controller';
import { CollectionProductsService } from './collection_products.service';
import { CollectionProduct } from './entities/collection-product.entity';
import { Collection } from '../collections/entities/collection.entity';
import { Product } from '../products/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CollectionProduct, Collection, Product])],
  controllers: [CollectionProductsController],
  providers: [CollectionProductsService],
  exports: [CollectionProductsService, TypeOrmModule],
})
export class CollectionProductsModule {}
