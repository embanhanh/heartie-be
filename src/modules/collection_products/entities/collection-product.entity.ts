import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Collection } from '../../collections/entities/collection.entity';
import { Product } from '../../products/entities/product.entity';

@Entity({ name: 'collection_products' })
@Index(['collectionId', 'productId'], { unique: true })
export class CollectionProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  collectionId: number;

  @Column({ type: 'int' })
  productId: number;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @ManyToOne(() => Collection, (collection: Collection) => collection.collectionProducts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'collectionId' })
  collection: Collection;

  @ManyToOne(() => Product, (product: Product) => product.collectionProducts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
