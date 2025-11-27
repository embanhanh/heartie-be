import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ProductVariant } from '../../product_variants/entities/product_variant.entity';
import { Attribute } from '../../attributes/entities/attribute.entity';
import { AttributeValue } from '../../attribute_values/entities/attribute-value.entity';

@Entity({ name: 'variant_attribute_values' })
@Unique(['variantId', 'attributeId'])
export class VariantAttributeValue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  variantId: number;

  @Column({ type: 'int' })
  attributeId: number;

  @Column({ type: 'int' })
  attributeValueId: number;

  @ManyToOne(() => ProductVariant, (variant) => variant.attributeValues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variantId' })
  variant: ProductVariant;

  @ManyToOne(() => Attribute, (attribute) => attribute.variantAttributeValues)
  @JoinColumn({ name: 'attributeId' })
  attribute: Attribute;

  @ManyToOne(() => AttributeValue, (attributeValue) => attributeValue.variantAttributeValues)
  @JoinColumn({ name: 'attributeValueId' })
  attributeValue: AttributeValue;
}
