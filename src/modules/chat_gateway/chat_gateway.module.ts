import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGatewayService } from './chat_gateway.service';
import { ChatGatewayGateway } from './chat_gateway.gateway';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [MessagesModule, ConversationsModule, JwtModule],
  providers: [ChatGatewayGateway, ChatGatewayService],
  exports: [ChatGatewayService],
})
export class ChatGatewayModule {}
