import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ProductVariant } from '../../product_variants/entities/product_variant.entity';
import { User } from '../../users/entities/user.entity';

export enum InteractionType {
  VIEW = 'VIEW',
  LIKE = 'LIKE',
  UNLIKE = 'UNLIKE',
  ADD_TO_CART = 'ADD_TO_CART',
  REMOVE_FROM_CART = 'REMOVE_FROM_CART',
  ADD_TO_WISHLIST = 'ADD_TO_WISHLIST',
  REMOVE_FROM_WISHLIST = 'REMOVE_FROM_WISHLIST',
  SHARE = 'SHARE',
  CLICK = 'CLICK',
  SEARCH = 'SEARCH',
  FILTER = 'FILTER',
  COMPARE = 'COMPARE',
}

@Entity('interactions')
@Index(['idProductVariant', 'idUser', 'type']) // Composite index for performance
@Index(['idUser', 'createdAt']) // Index for user activity queries
@Index(['type', 'createdAt']) // Index for analytics queries
export class Interaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint' })
  idProductVariant: number;

  @Column({ type: 'bigint' })
  idUser: number;

  @Column({
    type: 'enum',
    enum: InteractionType,
    nullable: false,
  })
  type: InteractionType;

  @Column({ type: 'json', nullable: true })
  metadata: any; // Additional data like search query, filter criteria, etc.

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sessionId: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  // Relationships
  @ManyToOne(() => ProductVariant, (productVariant) => productVariant.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'idProductVariant' })
  productVariant: ProductVariant;

  @ManyToOne(() => User, (user) => user.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'idUser' })
  user: User;

  // // Computed properties
  // get isEngagementAction(): boolean {
  //   return [
  //     InteractionType.LIKE,
  //     InteractionType.ADD_TO_CART,
  //     InteractionType.ADD_TO_WISHLIST,
  //     InteractionType.SHARE,
  //     InteractionType.COMPARE
  //   ].includes(this.type);
  // }

  // get isViewAction(): boolean {
  //   return this.type === InteractionType.VIEW;
  // }

  // get actionScore(): number {
  //   const scores = {
  //     [InteractionType.VIEW]: 1,
  //     [InteractionType.CLICK]: 2,
  //     [InteractionType.LIKE]: 3,
  //     [InteractionType.SHARE]: 4,
  //     [InteractionType.ADD_TO_WISHLIST]: 5,
  //     [InteractionType.ADD_TO_CART]: 8,
  //     [InteractionType.COMPARE]: 6,
  //     [InteractionType.SEARCH]: 2,
  //     [InteractionType.FILTER]: 2,
  //     [InteractionType.UNLIKE]: -2,
  //     [InteractionType.REMOVE_FROM_CART]: -5,
  //     [InteractionType.REMOVE_FROM_WISHLIST]: -3
  //   };

  //   return scores[this.type] || 0;
  // }
}
