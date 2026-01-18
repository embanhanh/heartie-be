import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from '../carts/entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { CartItemsService } from './cart-items.service';
import { CartItemsController } from './cart-items.controller';

import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { InteractionsModule } from '../interactions/interactions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, ProductVariant]), InteractionsModule],
  providers: [CartItemsService],
  controllers: [CartItemsController],
  exports: [CartItemsService],
})
export class CartItemsModule {}
