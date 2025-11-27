import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from 'src/modules/branches/entities/branch.entity';
import { ProductVariant } from '../../product_variants/entities/product_variant.entity';

@Entity({ name: 'product_variants_inventory' })
@Unique(['variantId', 'branchId'])
export class ProductVariantInventory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'variantId' })
  variantId: number;

  @Column({ type: 'int', name: 'branchId' })
  branchId: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => ProductVariant, (variant) => variant.inventories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variantId' })
  variant: ProductVariant;

  @ManyToOne(() => Branch, (branch) => branch.inventories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}
