import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { NotificationToken } from '../../notifications/entities/notification-token.entity';
import { ConversationParticipant } from '../../conversation_participants/entities/conversation_participant.entity';
import { UserCustomerGroup } from '../../user_customer_groups/entities/user-customer-group.entity';
import { Category } from '../../categories/entities/category.entity';

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  SHOP_OWNER = 'SHOP_OWNER',
  ADMIN = 'ADMIN',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  STAFF = 'STAFF',
}

export enum FashionPersona {
  FASHION_ENTHUSIAST = 'FASHION_ENTHUSIAST', // Đam mê thời trang (15%)
  BARGAIN_HUNTER = 'BARGAIN_HUNTER', // Thợ săn sale (25%)
  PRACTICAL_SHOPPER = 'PRACTICAL_SHOPPER', // Mua thực dụng (20%)
  LUXURY_BUYER = 'LUXURY_BUYER', // Mua cao cấp (5%)
  WINDOW_SHOPPER = 'WINDOW_SHOPPER', // Xem nhiều mua ít (20%)
  IMPULSE_BUYER = 'IMPULSE_BUYER', // Mua bốc đồng (10%)
  NEW_USER = 'NEW_USER', // User mới (5%)
}

export enum PriceSensitivity {
  LOW = 'LOW', // Không quan tâm giá
  MEDIUM = 'MEDIUM', // Cân nhắc giá
  HIGH = 'HIGH', // Nhạy cảm giá
  VERY_HIGH = 'VERY_HIGH', // Rất nhạy cảm giá
}

export enum ActivityLevel {
  HIGH = 'HIGH', // Active 3-4 lần/tuần
  MEDIUM = 'MEDIUM', // Active 1-2 lần/tuần
  LOW = 'LOW', // Active <1 lần/tuần
}

@Entity({ name: 'users' })
@Index(['email'], { unique: true })
@Index(['phoneNumber'], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'varchar', length: 255, select: false, nullable: true, default: null })
  hashedRefreshToken?: string | null;

  // Personal information
  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 20 })
  phoneNumber: string;

  @Column({ type: 'date', nullable: true })
  birthdate?: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatarUrl?: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', nullable: true })
  branchId?: number | null;

  @OneToMany(() => ConversationParticipant, (participant) => participant.user)
  participants: ConversationParticipant[];

  @OneToMany(() => NotificationToken, (token) => token.user)
  notificationTokens: NotificationToken[];

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

  // Fake to create interaction
  // 1. PERSONA (QUAN TRỌNG NHẤT)
  @Column({
    type: 'enum',
    enum: FashionPersona,
    default: FashionPersona.NEW_USER,
    comment: 'User shopping behavior persona',
  })
  persona: FashionPersona;

  // 2. PRICE SENSITIVITY
  @Column({
    type: 'enum',
    enum: PriceSensitivity,
    default: PriceSensitivity.MEDIUM,
    comment: 'Price sensitivity level',
  })
  priceSensitivity: PriceSensitivity;

  // 3. ACTIVITY LEVEL
  @Column({
    type: 'enum',
    enum: ActivityLevel,
    default: ActivityLevel.LOW,
    comment: 'User activity level',
  })
  activityLevel: ActivityLevel;

  // 4-6. CONVERSION RATES (để generate behavior realistic)
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0.05,
    comment: 'Purchase rate (purchases / interactions)',
  })
  purchaseRate: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0.1,
    comment: 'View to cart conversion rate',
  })
  viewToCartRate: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0.3,
    comment: 'Cart to purchase conversion rate',
  })
  cartToPurchaseRate: number;

  // 7. PREFERRED CATEGORIES (để select products) - lưu array category IDs
  @ManyToMany(() => Category, (category) => category.users)
  @JoinTable() // Chỉ cần khai báo @JoinTable ở một phía (thường là phía chủ sở hữu)
  preferredCategories: Category[];

  // 8-10. RFM METRICS (optional nhưng hữu ích)
  @Column({
    type: 'int',
    default: 0,
    comment: 'Total number of purchases',
  })
  totalPurchases: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    comment: 'Total amount spent',
  })
  totalSpent: number;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    comment: 'Last purchase timestamp',
  })
  lastPurchaseDate?: Date | null;
}
