import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('stores') // Tên bảng trong cơ sở dữ liệu
export class Store {
  @PrimaryGeneratedColumn() // Tự động tăng giá trị ID
  id: number;

  @Column({ type: 'varchar', length: 255 }) // Cột tên store
  name: string;

  @Column({ type: 'text', nullable: true }) // Cột mô tả, cho phép giá trị NULL
  description?: string;

  @Column({ type: 'varchar', length: 255, nullable: true }) // Cột URL hình ảnh, cho phép giá trị NULL
  imageUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true }) // Cột địa chỉ, cho phép giá trị NULL
  address?: string;

  @Column({ type: 'varchar', length: 15, nullable: true }) // Cột số điện thoại, cho phép giá trị NULL
  phoneNumber?: string;
}
