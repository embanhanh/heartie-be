import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
// import { ApiProperty } from '@nestjs/swagger';
import { PromotionalCombo } from '../../promotional_combos/entities/promotional_combo.entity'; // Đảm bảo đường dẫn và tên class đúng

@Entity('promotional_combo_details')
export class PromotionalComboDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  idCombo: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  discountValue: number;

  // Relationship
  @ManyToOne(() => PromotionalCombo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'idCombo' })
  promotionalCombo: PromotionalCombo;
}
