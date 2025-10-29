import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from '../carts/entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { CartItemsService } from './cart-items.service';
import { CartItemsController } from './cart-items.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem])],
  providers: [CartItemsService],
  controllers: [CartItemsController],
})
export class CartItemsModule {}
