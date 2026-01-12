import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AdsAiStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

export enum AdsAiPostType {
  LINK = 'link',
  PHOTO = 'photo',
  CAROUSEL = 'carousel',
}

@Entity('ads_ai_campaigns')
export class AdsAiCampaign {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int', nullable: true })
  productId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  productName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  targetAudience: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  objective: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  callToAction: string | null;

  @Column({ type: 'varchar', length: 20, default: AdsAiPostType.LINK })
  postType: AdsAiPostType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  ctaUrl: string | null;

  @Column({ type: 'text', nullable: true })
  prompt: string | null;

  @Column({ type: 'text', nullable: true })
  primaryText: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  headline: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  hashtags: string[] | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image: string | null;

  @Column({ type: 'jsonb', nullable: true })
  images: string[] | null;

  // Marketing Metrics
  @Column({ type: 'int', default: 0 })
  reach: number;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'int', default: 0 })
  engagement: number;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @Column({ type: 'int', default: 0 })
  conversions: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  spend: number;

  @Column({ type: 'int', nullable: true })
  rating: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 20, default: AdsAiStatus.DRAFT })
  status: AdsAiStatus;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  facebookPostId: string | null;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
