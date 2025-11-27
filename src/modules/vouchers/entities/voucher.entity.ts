import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { Product } from 'src/modules/products/entities/product.entity';

@Entity('vouchers')
export class Voucher {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 20 })
  discountType: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountValue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  minOrderValue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  maxDiscountValue: number;

  @Column({ type: 'int', default: 1 })
  usageLimit: number;

  @Column({ type: 'int', default: 0 })
  used: number;

  @Column({ type: 'timestamp' })
  validFrom: Date;

  @Column({ type: 'timestamp' })
  validUntil: Date;

  @Column({ type: 'varchar', length: 20, default: 'public' })
  voucherType: string;

  @Column({ type: 'boolean', default: true })
  visplay: boolean;

  @Column({ type: 'int', default: 1 })
  quantityPerUser: number;

  //Relationships
  @ManyToMany(() => Product, { cascade: true })
  @JoinTable({
    name: 'applicable_product_details',
    joinColumn: { name: 'idVoucher', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'idProduct', referencedColumnName: 'id' },
  })
  applicableProducts: Product[];
}
