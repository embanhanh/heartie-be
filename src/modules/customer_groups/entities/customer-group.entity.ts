import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserCustomerGroup } from '../../user_customer_groups/entities/user-customer-group.entity';
import { PromotionCustomerGroup } from '../../promotion_customer_groups/entities/promotion-customer-group.entity';

@Entity({ name: 'customer_groups' })
export class CustomerGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(
    () => UserCustomerGroup,
    (userCustomerGroup: UserCustomerGroup) => userCustomerGroup.customerGroup,
  )
  userCustomerGroups: UserCustomerGroup[];

  @OneToMany(
    () => PromotionCustomerGroup,
    (promotionCustomerGroup: PromotionCustomerGroup) => promotionCustomerGroup.customerGroup,
  )
  promotionCustomerGroups: PromotionCustomerGroup[];
}
