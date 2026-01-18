import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { ProductVariant } from '../../product_variants/entities/product_variant.entity';
import { User } from '../../users/entities/user.entity';

export enum StockTransferStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity({ name: 'stock_transfers' })
export class StockTransfer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  fromBranchId: number;

  @Column({ type: 'int' })
  toBranchId: number;

  @Column({ type: 'int' })
  productVariantId: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 50, default: StockTransferStatus.PENDING })
  status: StockTransferStatus;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'int', nullable: true })
  requesterId: number;

  @Column({ type: 'int', nullable: true })
  approverId: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fromBranchId' })
  fromBranch: Branch;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'toBranchId' })
  toBranch: Branch;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productVariantId' })
  productVariant: ProductVariant;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requesterId' })
  requester: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approverId' })
  approver: User;
}
