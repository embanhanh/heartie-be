import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PromotionCondition } from '../../promotion_conditions/entities/promotion-condition.entity';
import { PromotionBranch } from '../../promotion_branches/entities/promotion-branch.entity';
import { PromotionCustomerGroup } from '../../promotion_customer_groups/entities/promotion-customer-group.entity';

export enum PromotionType {
  COMBO = 'COMBO',
  COUPON = 'COUPON',
}

export enum ComboType {
  PRODUCT_COMBO = 'product_combo',
  BUY_X_GET_Y = 'buy_x_get_y',
}

export enum CouponType {
  ORDER_TOTAL = 'order_total',
  SPECIFIC_PRODUCTS = 'specific_products',
}

export enum DiscountType {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export enum ApplyScope {
  GLOBAL = 'GLOBAL',
  BRANCH = 'BRANCH',
  CUSTOMER_GROUP = 'CUSTOMER_GROUP',
}

const numericTransformer = {
  to: (value?: number | null) => value,
  from: (value: string | number | null) =>
    value === null ? null : typeof value === 'string' ? Number(value) : value,
};

@Entity({ name: 'promotions' })
export class Promotion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  code?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'enum', enum: PromotionType })
  type: PromotionType;

  @Column({ type: 'enum', enum: ComboType, nullable: true })
  comboType?: ComboType | null;

  @Column({ type: 'enum', enum: CouponType, nullable: true })
  couponType?: CouponType | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  discountValue: number;

  @Column({ type: 'enum', enum: DiscountType, default: DiscountType.PERCENT })
  discountType: DiscountType;

  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz' })
  endDate: Date;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  minOrderValue: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  maxDiscount?: number | null;

  @Column({ type: 'int', nullable: true })
  usageLimit?: number | null;

  @Column({ type: 'int', default: 0 })
  usedCount: number;

  @Column({ type: 'enum', enum: ApplyScope, name: 'applyScope', default: ApplyScope.GLOBAL })
  applyScope: ApplyScope;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => PromotionCondition, (condition: PromotionCondition) => condition.promotion)
  conditions: PromotionCondition[];

  @OneToMany(() => PromotionBranch, (promotionBranch: PromotionBranch) => promotionBranch.promotion)
  branches: PromotionBranch[];

  @OneToMany(
    () => PromotionCustomerGroup,
    (promotionCustomerGroup: PromotionCustomerGroup) => promotionCustomerGroup.promotion,
  )
  customerGroups: PromotionCustomerGroup[];
}
