import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InteractionType } from '../../interactions/entities/interaction.entity';

@Entity('product_interaction_metrics')
@Index(['productVariantId', 'metricDate', 'metricType'], { unique: true })
export class ProductInteractionMetric {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  productVariantId: number;

  @Column({ type: 'date' })
  metricDate: string;

  @Column({ type: 'enum', enum: InteractionType })
  metricType: InteractionType;

  @Column({ type: 'int', default: 0 })
  count: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
