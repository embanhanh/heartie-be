import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
// import { ApiProperty } from '@nestjs/swagger';
import { Product } from 'src/modules/products/entities/product.entity';

@Entity('promotional_combos')
export class PromotionalCombo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  comboName: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ type: 'int', nullable: true })
  limitCombo: number;

  @Column({ type: 'varchar', length: 50 })
  comboType: string;

  //Relationships
  @ManyToMany(() => Product, { eager: true })
  @JoinTable({
    name: 'promotional_combo_products',
    joinColumn: { name: 'idCombo', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'idProduct', referencedColumnName: 'id' },
  })
  products: Product[];
}
