import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { ConversationParticipant } from '../../conversation_participants/entities/conversation_participant.entity';
import { UserCustomerGroup } from '../../user_customer_groups/entities/user-customer-group.entity';

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  SHOP_OWNER = 'SHOP_OWNER',
  ADMIN = 'ADMIN',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  STAFF = 'STAFF',
}

@Entity({ name: 'users' })
@Index(['email'], { unique: true })
@Index(['phoneNumber'], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 20 })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'varchar', length: 255, select: false, nullable: true, default: null })
  hashedRefreshToken?: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', nullable: true })
  branchId?: number | null;

  @OneToMany(() => ConversationParticipant, (participant) => participant.user)
  participants: ConversationParticipant[];

  @ManyToOne(() => Branch, (branch) => branch.users, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch | null;

  @OneToMany(
    () => UserCustomerGroup,
    (userCustomerGroup: UserCustomerGroup) => userCustomerGroup.user,
  )
  userCustomerGroups: UserCustomerGroup[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
