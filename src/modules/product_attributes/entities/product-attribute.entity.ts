import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Attribute } from '../../attributes/entities/attribute.entity';

@Entity({ name: 'product_attributes' })
export class ProductAttribute {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  productId: number;

  @Column({ type: 'int' })
  attributeId: number;

  @Column({ type: 'boolean', default: true })
  isRequired: boolean;

  @ManyToOne(() => Product, (product) => product.productAttributes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => Attribute, (attribute) => attribute.productAttributes)
  @JoinColumn({ name: 'attributeId' })
  attribute: Attribute;
}
