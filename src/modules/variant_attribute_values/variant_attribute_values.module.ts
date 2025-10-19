import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VariantAttributeValuesController } from './variant_attribute_values.controller';
import { VariantAttributeValuesService } from './variant_attribute_values.service';
import { VariantAttributeValue } from './entities/variant-attribute-value.entity';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { Attribute } from '../attributes/entities/attribute.entity';
import { AttributeValue } from '../attribute_values/entities/attribute-value.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([VariantAttributeValue, ProductVariant, Attribute, AttributeValue]),
  ],
  controllers: [VariantAttributeValuesController],
  providers: [VariantAttributeValuesService],
  exports: [TypeOrmModule],
})
export class VariantAttributeValuesModule {}
