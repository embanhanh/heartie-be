import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoucherUserDetailsService } from './voucher_user_details.service';
import { VoucherUserDetailsController } from './voucher_user_details.controller';
import { VoucherUserDetail } from './entities/voucher_user_detail.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Voucher } from 'src/modules/vouchers/entities/voucher.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VoucherUserDetail, User, Voucher])],
  controllers: [VoucherUserDetailsController],
  providers: [VoucherUserDetailsService],
})
export class VoucherUserDetailsModule {}
