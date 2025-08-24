import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  urlImage: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  btnTitle: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  link: string | null;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string; // ACTIVE, INACTIVE, EXPIRED

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  // Computed properties
  // get isActive(): boolean {
  //   const now = new Date();
  //   const start = new Date(this.startDate);
  //   const end = new Date(this.endDate);

  //   return this.status === 'ACTIVE' &&
  //          now >= start &&
  //          now <= end;
  // }

  // get isExpired(): boolean {
  //   const now = new Date();
  //   const end = new Date(this.endDate);

  //   return now > end;
  // }

  // get daysRemaining(): number {
  //   const now = new Date();
  //   const end = new Date(this.endDate);
  //   const diffTime = end.getTime() - now.getTime();
  //   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  //   return diffDays > 0 ? diffDays : 0;
  // }

  // get hasButton(): boolean {
  //   return !!(this.btnTitle && this.link);
  // }
}
