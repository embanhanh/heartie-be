import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { ProductVariantInventory } from '../../inventory/entities/product-variant-inventory.entity';
import { VariantAttributeValue } from '../../variant_attribute_values/entities/variant-attribute-value.entity';

export enum ProductVariantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity({ name: 'product_variants' })
export class ProductVariant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  productId: number;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image?: string;

  @Column({ type: 'numeric', precision: 8, scale: 3, nullable: true })
  weight?: number;

  @Column({ type: 'varchar', length: 20, default: ProductVariantStatus.ACTIVE })
  status: ProductVariantStatus;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  extra: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @OneToMany(() => ProductVariantInventory, (inventory) => inventory.variant)
  inventories: ProductVariantInventory[];

  @OneToMany(() => VariantAttributeValue, (variantValue) => variantValue.variant)
  attributeValues: VariantAttributeValue[];
}
