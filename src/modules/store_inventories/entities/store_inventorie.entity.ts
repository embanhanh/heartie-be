import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Store } from 'src/modules/stores/entities/store.entity';
import { ProductVariant } from 'src/modules/product_variants/entities/product_variant.entity';
import { User } from 'src/modules/users/entities/user.entity';

@Entity('store_inventories')
export class StoreInventory {
  @PrimaryColumn()
  idStore: number;

  @PrimaryColumn()
  idProductVariant: number;

  @Column({ type: 'int', default: 0 })
  stockOnHand: number;

  @Column({ type: 'int', default: 0 })
  reserved: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status: string; // ACTIVE, INACTIVE, OUT_OF_STOCK

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ nullable: true })
  updatedBy: number;

  // Relationships
  @ManyToOne(() => Store, (store) => store.id)
  @JoinColumn({ name: 'idStore' })
  store: Store;

  @ManyToOne(() => ProductVariant, (productVariant) => productVariant.id)
  @JoinColumn({ name: 'idProductVariant' })
  productVariant: ProductVariant;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updatedBy' })
  user: User;
}
