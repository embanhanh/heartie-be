import {
  Column,
  ColumnType,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Brand } from '../../brands/entities/brand.entity';
import { Category } from '../../categories/entities/category.entity';
import { ProductVariant } from '../../product_variants/entities/product_variant.entity';
import { ProductAttribute } from '../../product_attributes/entities/product-attribute.entity';
import { Rating } from 'src/modules/ratings/entities/rating.entity';
import { VectorTransformer } from 'src/common/transformers/vector.transformer';
import { CollectionProduct } from '../../collection_products/entities/collection-product.entity';

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity({ name: 'products' })
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int', nullable: true })
  brandId?: number | null;

  @Column({ type: 'int', nullable: true })
  categoryId?: number | null;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image?: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  originalPrice: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'varchar', length: 20, default: ProductStatus.ACTIVE })
  status: ProductStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => Brand, (brand) => brand.products, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brandId' })
  brand?: Brand | null;

  @ManyToOne(() => Category, (category) => category.products, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category?: Category | null;

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: ProductVariant[];

  @OneToMany(() => ProductAttribute, (productAttribute) => productAttribute.product)
  productAttributes: ProductAttribute[];

  @OneToMany(() => Rating, (rating) => rating.product)
  ratings: Rating[];

  @OneToMany(() => CollectionProduct, (collectionProduct) => collectionProduct.product)
  collectionProducts: CollectionProduct[];

  @Column({
    type: 'vector' as unknown as ColumnType,
    nullable: true,
    transformer: VectorTransformer,
  })
  embedding?: number[] | null;

  @Column({ type: 'float', default: 0 })
  rating: number;

  @Column({ type: 'bigint', nullable: true, unique: true })
  tikiId?: number | null;
}
