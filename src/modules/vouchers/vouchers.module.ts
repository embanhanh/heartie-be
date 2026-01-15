import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { Voucher } from './entities/voucher.entity';
import { Product } from 'src/modules/products/entities/product.entity';
import { VoucherUserDetail } from 'src/modules/voucher_user_details/entities/voucher_user_detail.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Voucher, Product, VoucherUserDetail])],
  controllers: [VouchersController],
  providers: [VouchersService],
  exports: [VouchersService],
})
export class VouchersModule {}
