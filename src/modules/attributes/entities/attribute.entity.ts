import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Unique } from 'typeorm';
import { AttributeValue } from '../../attribute_values/entities/attribute-value.entity';
import { ProductAttribute } from '../../product_attributes/entities/product-attribute.entity';
import { VariantAttributeValue } from '../../variant_attribute_values/entities/variant-attribute-value.entity';

export enum AttributeType {
  COMMON = 'common',
  OTHER = 'other',
}

@Entity({ name: 'attributes' })
@Unique(['name'])
export class Attribute {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: AttributeType, default: AttributeType.COMMON })
  type: AttributeType;

  @OneToMany(() => AttributeValue, (value) => value.attribute)
  values: AttributeValue[];

  @OneToMany(() => ProductAttribute, (productAttribute) => productAttribute.attribute)
  productAttributes: ProductAttribute[];

  @OneToMany(() => VariantAttributeValue, (variantValue) => variantValue.attribute)
  variantAttributeValues: VariantAttributeValue[];
}
