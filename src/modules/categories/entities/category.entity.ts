import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import slugify from 'slugify';
import { Product } from '../../products/entities/product.entity';
import { User } from 'src/modules/users/entities/user.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  slug?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image?: string | null;

  @Column({ type: 'int', nullable: true })
  parentId?: number | null;

  @ManyToOne(() => Category, (category) => category.children, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentId' })
  parent?: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @ManyToMany(() => User, (user) => user.preferredCategories)
  users: User[];

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  generateSlug() {
    if (!this.name) {
      this.slug = null;
      return;
    }

    const baseSlug = slugify(this.name, {
      lower: true,
      strict: true,
    });

    // Note: For BeforeInsert, this.id is not yet available
    // The id-based slug for child categories needs to be set after first save
    if (this.parentId && this.id) {
      this.slug = `${baseSlug}-${this.id}`;
      return;
    }

    // Temporary slug for child categories before ID is generated to avoid uniqueness constraint violation
    if (this.parentId && !this.id) {
      this.slug = `${baseSlug}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      return;
    }

    this.slug = baseSlug;
  }
}
