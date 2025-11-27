import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CustomerGroup } from '../../customer_groups/entities/customer-group.entity';

@Entity({ name: 'user_customer_groups' })
export class UserCustomerGroup {
  @PrimaryColumn({ type: 'int' })
  userId: number;

  @PrimaryColumn({ type: 'int' })
  customerGroupId: number;

  @ManyToOne(() => User, (user: User) => user.userCustomerGroups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => CustomerGroup, (group: CustomerGroup) => group.userCustomerGroups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerGroupId' })
  customerGroup: CustomerGroup;

  @CreateDateColumn({ type: 'timestamptz', name: 'assignedAt' })
  assignedAt: Date;
}
