import {
  Entity,
  // PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
// import { ApiProperty } from '@nestjs/swagger';
import { Order } from 'src/modules/orders/entities/order.entity';
import { ProductVariant } from 'src/modules/product_variants/entities/product_variant.entity';

@Entity('order_product_details')
export class OrderProductDetail {
  @PrimaryColumn({ type: 'int' })
  idOrderProduct: number;

  @PrimaryColumn({ type: 'int' })
  idProductVariant: number;

  @Column({ type: 'int' })
  quantity: number;

  // === RELATIONSHIPS ===
  // Many OrderProductDetail -> One OrderProduct
  @ManyToOne(() => Order, (orderProduct) => orderProduct.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'idOrderProduct' })
  order: Order;

  // Many OrderProductDetail -> One ProductVariant
  @ManyToOne(() => ProductVariant, (productVariant) => productVariant.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'idProductVariant' })
  productVariant: ProductVariant;
}
