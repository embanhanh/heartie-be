import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MomoService } from './momo.service';
import { MomoController } from './momo.controller';
import { Order } from '../orders/entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  controllers: [MomoController],
  providers: [MomoService],
  exports: [MomoService],
})
export class MomoModule {}
