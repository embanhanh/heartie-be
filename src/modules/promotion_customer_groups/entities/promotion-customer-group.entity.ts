import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { Promotion } from '../../promotions/entities/promotion.entity';
import { CustomerGroup } from '../../customer_groups/entities/customer-group.entity';

@Entity({ name: 'promotion_customer_groups' })
export class PromotionCustomerGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  promotionId: number;

  @ManyToOne(() => Promotion, (promotion: Promotion) => promotion.customerGroups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'promotionId' })
  promotion: Promotion;

  @Column({ type: 'int', nullable: true })
  customerGroupId?: number | null;

  @ManyToOne(() => CustomerGroup, (group) => group.promotionCustomerGroups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerGroupId' })
  customerGroup?: CustomerGroup | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
