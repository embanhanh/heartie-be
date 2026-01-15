import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { Message } from './entities/message.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversation_participants/entities/conversation_participant.entity';
import { GeminiModule } from '../gemini/gemini.module';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { CartItemsModule } from '../cart_items/cart-items.module';
import { CartsModule } from '../carts/carts.module';
import { AddressesModule } from '../addresses/addresses.module';
import { VouchersModule } from '../vouchers/vouchers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Conversation, ConversationParticipant]),
    GeminiModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => ProductsModule),
    forwardRef(() => CartItemsModule),
    CartsModule,
    AddressesModule,
    VouchersModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
