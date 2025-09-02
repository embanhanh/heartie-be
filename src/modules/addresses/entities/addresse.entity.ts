import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from 'src/modules/users/entities/user.entity';

@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  idUser: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'text' })
  location: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'boolean', default: false })
  default: boolean;

  @Column({ type: 'text' })
  address: string;

  // Relationships có thể thêm sau khi có User entity
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'idUser' })
  user: User;
}
