import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import slugify from 'slugify';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'bigint', nullable: true })
  parentCategory: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ unique: true, type: 'varchar', length: 255, nullable: true })
  slug: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  urlImage: string;

  @BeforeInsert()
  @BeforeUpdate()
  generateSlug() {
    if (this.name) {
      // chỉ sinh slug mới nếu slug chưa có hoặc name thay đổi
      this.slug = slugify(this.name, {
        lower: true,
        strict: true,
      });
    }
  }
}
