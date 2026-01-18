import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { ProductVariant } from '../../product_variants/entities/product_variant.entity';
import { User } from '../../users/entities/user.entity';

export enum InventoryLogType {
  IMPORT = 'IMPORT',
  TRANSFER_OUT = 'TRANSFER_OUT',
  TRANSFER_IN = 'TRANSFER_IN',
  ADJUSTMENT = 'ADJUSTMENT', // For manual corrections
  SALE = 'SALE',
  RETURN = 'RETURN',
}

@Entity({ name: 'inventory_logs' })
export class InventoryLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  branchId: number;

  @Column({ type: 'int' })
  productVariantId: number;

  @Column({ type: 'int' })
  changeAmount: number; // Positive for increase, negative for decrease

  @Column({ type: 'int' })
  previousStock: number;

  @Column({ type: 'int' })
  newStock: number;

  @Column({ type: 'varchar', length: 50 })
  type: InventoryLogType;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'int', nullable: true })
  performedById: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productVariantId' })
  productVariant: ProductVariant;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'performedById' })
  performedBy: User;
}
