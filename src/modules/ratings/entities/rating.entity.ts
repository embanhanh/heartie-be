import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DataSource,
  AfterInsert,
  AfterUpdate,
  AfterRemove,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ratings')
export class Rating {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productId: number;

  @Column()
  userId: number;

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
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => User, (user) => user.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  static dataSource: DataSource;
  @AfterInsert()
  @AfterUpdate()
  @AfterRemove()
  async updateProductAverageRating() {
    if (!Rating.dataSource) return;

    const ratingRepo = Rating.dataSource.getRepository(Rating);
    const productRepo = Rating.dataSource.getRepository(Product);

    const ratings = await ratingRepo.find({
      where: { productId: this.productId },
    });

    const avg =
      ratings.length > 0
        ? Number((ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length).toFixed(1))
        : 0;

    await productRepo.update(this.productId, { rating: avg });
  }
}
