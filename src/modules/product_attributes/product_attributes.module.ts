import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductAttributesController } from './product_attributes.controller';
import { ProductAttributesService } from './product_attributes.service';
import { ProductAttribute } from './entities/product-attribute.entity';
import { Product } from '../products/entities/product.entity';
import { Attribute } from '../attributes/entities/attribute.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductAttribute, Product, Attribute])],
  controllers: [ProductAttributesController],
  providers: [ProductAttributesService],
  exports: [TypeOrmModule],
})
export class ProductAttributesModule {}
