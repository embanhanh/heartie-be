import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Rating } from '../../ratings/entities/rating.entity';

export type ReviewSentiment = 'positive' | 'negative' | 'neutral';

@Entity({ name: 'review_insights' })
export class ReviewInsight {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  ratingId: number;

  @OneToOne(() => Rating, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ratingId' })
  rating: Rating;

  @Column({ type: 'varchar', length: 16 })
  sentiment: ReviewSentiment;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  keyTopics: string[];

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  rawResponse?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
