import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Attribute } from '../../attributes/entities/attribute.entity';
import { VariantAttributeValue } from '../../variant_attribute_values/entities/variant-attribute-value.entity';

@Entity({ name: 'attribute_values' })
export class AttributeValue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  attributeId: number;

  @Column({ type: 'varchar', length: 200 })
  value: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  meta: Record<string, unknown>;

  @ManyToOne(() => Attribute, (attribute) => attribute.values, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attributeId' })
  attribute: Attribute;

  @OneToMany(() => VariantAttributeValue, (variantValue) => variantValue.attributeValue)
  variantAttributeValues: VariantAttributeValue[];
}
