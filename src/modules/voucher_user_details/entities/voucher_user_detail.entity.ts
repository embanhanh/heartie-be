import {
  Entity,
  // PrimaryGeneratedColumn,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Voucher } from 'src/modules/vouchers/entities/voucher.entity';
import { User } from 'src/modules/users/entities/user.entity';

@Entity('voucher_user_details')
export class VoucherUserDetail {
  @PrimaryColumn()
  idVoucher: number;

  @PrimaryColumn()
  idUser: number;

  @Column({ type: 'timestamp' })
  usedAt: Date;

  @Column({ type: 'timestamp' })
  validFrom: Date;

  @Column({ type: 'timestamp' })
  validUntil: Date;

  @Column({ type: 'boolean', default: false })
  used: boolean;

  // Relationships với Voucher và User
  @ManyToOne(() => Voucher, (voucher) => voucher.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'idVoucher' })
  voucher: Voucher;

  // Many VoucherUserDetail -> One User
  @ManyToOne(() => User, (user) => user.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'idUser' })
  user: User;
}
