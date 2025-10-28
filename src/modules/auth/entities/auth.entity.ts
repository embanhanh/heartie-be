import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Auth {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: 'user' })
  role: string;
}
