import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { VectorTransformer } from 'src/common/transformers/vector.transformer';
import { ColumnType } from 'typeorm/driver/types/ColumnTypes';

@Entity({ name: 'product_embeddings' })
export class ProductEmbedding {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  productId: number;

  @OneToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({
    type: 'vector' as unknown as ColumnType,
    nullable: true,
    transformer: VectorTransformer,
  })
  embedding?: number[] | null;

  @Column({ type: 'varchar', length: 20, default: 'gemini' })
  embedModel: string;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
