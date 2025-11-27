import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { Voucher } from './entities/voucher.entity';
import { Product } from 'src/modules/products/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Voucher, Product])],
  controllers: [VouchersController],
  providers: [VouchersService],
})
export class VouchersModule {}
