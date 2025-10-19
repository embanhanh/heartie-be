import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Branch } from '../../branches/entities/branch.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  orderNumber: string;

  @Column({ type: 'int', nullable: true })
  userId?: number | null;

  @Column({ type: 'int', nullable: true })
  branchId?: number | null;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  subTotal: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  discountTotal: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  shippingFee: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  taxTotal: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expectedDeliveryDate?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  paidAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  cancelledAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  shippingAddressJson?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  billingAddressJson?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User | null;

  @ManyToOne(() => Branch, (branch) => branch.orders, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch | null;
}
