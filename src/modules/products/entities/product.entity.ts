import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToMany, JoinTable } from 'typeorm';
import { Category } from 'src/modules/categories/entities/category.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'text' })
  sku: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  slug: string;

  @Column({ type: 'text' })
  name: string;

  // "simple" | "configurable" | ...
  @Column({ type: 'text' })
  type: string;

  @Column({ type: 'text' })
  brand: string;

  @Column({ type: 'text' })
  description: string;

  // Mảng ảnh đúng như JSON (Postgres jsonb)
  @Column({ type: 'jsonb', default: () => "'[]'" })
  urlImage: Array<{
    base_url: string;
    is_gallery: boolean;
    label: string | null;
    large_url: string;
    medium_url: string;
    position: number | null;
    small_url: string;
    thumbnail_url: string;
  }>;

  // Số thập phân lưu dạng string (decimal trong TypeORM)
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  originalPrice: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column('int', { default: 0 })
  stockQuantity: number;

  // 0.0–5.0, 1 chữ số thập phân
  @Column('decimal', { precision: 2, scale: 1, default: 0 })
  rating: number;

  @Column('boolean', { default: false })
  isFeatured: boolean;

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('int', { default: 1 })
  minOrderQuantity: number;

  @Column('int', { default: 10 })
  maxOrderQuantity: number;

  @Column('int', { default: 0 })
  soldQuantity: number;

  // Mảng string (đúng với document mẫu)
  @Column({ type: 'jsonb', default: () => "'[]'" })
  shippingInfo: string[];

  // specifications: [{ name, attributes: [{code,name,value}] }]
  @Column({ type: 'jsonb', default: () => "'[]'" })
  specifications: Array<{
    name: string;
    attributes: Array<{ code: string; name: string; value: string }>;
  }>;

  // configurable_options: [{code,name,position,show_preview_image,values:[{label}]}]
  @Column({ type: 'jsonb', default: () => "'[]'" })
  configurable_options: Array<{
    code: string;
    name: string;
    position: number;
    show_preview_image: boolean;
    values: Array<{ label: string }>;
  }>;

  // Relationships
  // Relation Many-to-Many với Category
  @ManyToMany(() => Category, { eager: true }) // Tải luôn categorys khi lấy product
  @JoinTable({
    name: 'product_categories', // Tên bảng trung gian
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
  })
  categories: Category[];
}
