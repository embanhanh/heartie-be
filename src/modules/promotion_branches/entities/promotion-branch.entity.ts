import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { Promotion } from '../../promotions/entities/promotion.entity';
import { Branch } from '../../branches/entities/branch.entity';

@Entity({ name: 'promotion_branches' })
export class PromotionBranch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  promotionId: number;

  @ManyToOne(() => Promotion, (promotion: Promotion) => promotion.branches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotionId' })
  promotion: Promotion;

  @Column({ type: 'int' })
  branchId: number;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
