import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type NotificationPlatform = 'ios' | 'android' | 'web' | 'unknown';

@Entity({ name: 'notification_tokens' })
@Index(['token'], { unique: true })
@Index(['userId', 'deviceId'], { unique: true })
export class NotificationToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 512, nullable: true })
  token: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  deviceId?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'unknown' })
  platform: NotificationPlatform;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastUsedAt?: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
