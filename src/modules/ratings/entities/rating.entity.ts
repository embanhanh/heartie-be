import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ratings')
export class Rating {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  idProduct: number;

  @Column()
  idUser: number;

  @Column({ type: 'float', comment: 'Rating from 1.0 to 5.0' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Product, (product) => product.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'idProduct' })
  product: Product;

  @ManyToOne(() => User, (user) => user.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'idUser' })
  user: User;

  // // Computed properties
  // get isPositive(): boolean {
  //   return this.rating >= 4.0;
  // }

  // get ratingLevel(): string {
  //   if (this.rating >= 4.5) return 'Excellent';
  //   if (this.rating >= 4.0) return 'Good';
  //   if (this.rating >= 3.0) return 'Average';
  //   if (this.rating >= 2.0) return 'Poor';
  //   return 'Very Poor';
  // }
}
