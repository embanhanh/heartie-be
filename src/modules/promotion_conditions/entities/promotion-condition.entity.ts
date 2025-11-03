import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Promotion } from '../../promotions/entities/promotion.entity';
import { Product } from '../../products/entities/product.entity';

export enum PromotionConditionRole {
  BUY = 'BUY',
  GET = 'GET',
  APPLIES_TO = 'APPLIES_TO',
}

@Entity({ name: 'promotion_conditions' })
export class PromotionCondition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  promotionId: number;

  @ManyToOne(() => Promotion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotionId' })
  promotion: Promotion;

  @Column({ type: 'int' })
  productId: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'enum', enum: PromotionConditionRole })
  role: PromotionConditionRole;
}
