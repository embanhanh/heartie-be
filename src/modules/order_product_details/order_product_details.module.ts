import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderProductDetailsService } from './order_product_details.service';
import { OrderProductDetailsController } from './order_product_details.controller';
import { OrderProductDetail } from './entities/order_product_detail.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrderProductDetail])],
  controllers: [OrderProductDetailsController],
  providers: [OrderProductDetailsService],
})
export class OrderProductDetailsModule {}
