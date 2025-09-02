import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Product } from 'src/modules/products/entities/product.entity';

export enum InventoryStatus {
  AVAILABLE = 'available',
  OUT_OF_STOCK = 'out_of_stock',
  PREORDER = 'preorder',
}

// Dùng transformer để đọc numeric -> number
const decimalToNumber = {
  to: (value?: number | null) => value,
  from: (value: string | null) => (value != null ? Number(value) : null),
};

@Entity('product_variants')
@Unique('uq_variant_per_product_sku', ['productId', 'sku'])
export class ProductVariant {
  @PrimaryGeneratedColumn()
  id: number;

  // FK -> products.id
  @Index()
  @Column({ type: 'int', name: 'product' })
  productId: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product', referencedColumnName: 'id' })
  product: Product;

  @Index()
  @Column({ type: 'varchar', length: 191 })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Giá bán (đồng) – dùng numeric(10,2)
  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalToNumber,
  })
  price: number;

  // % giảm giá hoặc số tiền? JSON cho thấy rate => giữ number (0-100)
  @Column('decimal', {
    name: 'discount_rate',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: decimalToNumber,
  })
  discountRate: number;

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @Column({
    type: 'enum',
    enum: InventoryStatus,
    name: 'inventory_status',
    default: InventoryStatus.AVAILABLE,
  })
  inventoryStatus: InventoryStatus;

  // các lựa chọn (mongo có option1/option2)
  @Column({ type: 'varchar', length: 255, nullable: true })
  option1: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  option2: string | null;

  // trường tự do trong JSON: "do_kinh" (độ kính?) – để nullable
  @Column({ type: 'varchar', length: 255, name: 'nearsightedness', nullable: true })
  nearsightedness: string | null;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;
}
