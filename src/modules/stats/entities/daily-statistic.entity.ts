import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NumericTransformer } from 'src/common/transformers/numeric.transformer';

@Entity({ name: 'daily_statistics' })
@Index(['date'])
@Index(['branchId', 'date'])
export class DailyStatistic {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int', nullable: true })
  branchId?: number | null;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: NumericTransformer,
  })
  totalRevenue: number;

  @Column({ type: 'int', default: 0 })
  totalOrders: number;

  @Column({ type: 'int', default: 0 })
  totalCustomers: number;

  @Column({ type: 'int', default: 0 })
  totalProductsSold: number;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  meta: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
