import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Cart } from '../../carts/entities/cart.entity';
import { ProductVariant } from '../../product_variants/entities/product_variant.entity';

@Entity({ name: 'cart_items' })
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  cartId: number;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cartId' })
  cart: Cart;

  @Column({ type: 'int', nullable: true })
  variantId: number | null;

  @ManyToOne(() => ProductVariant, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'variantId' })
  variant: ProductVariant | null;

  @Column({ type: 'int', default: 1 })
  quantity: number;
}
