import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
// import { ApiProperty } from '@nestjs/swagger';
import { Address } from '../../addresses/entities/addresse.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamp' })
  orderDate: Date;

  @Column({ type: 'int' })
  idAddress: number;

  @Column({ type: 'varchar', length: 100 })
  paymentMethod: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  productsPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  shippingPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalPrice: number;

  @Column({ type: 'timestamp' })
  expectedDeliveryDate: Date;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deleveredAt?: Date;

  @Column({ type: 'varchar', length: 100 })
  shippingMethod: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transferOption?: string;

  // Relationships có thể thêm sau khi có User và Address entity
  @ManyToOne(() => Address, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'idAddress' })
  address: Address;
}
