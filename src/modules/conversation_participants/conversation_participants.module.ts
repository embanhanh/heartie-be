import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationParticipantsService } from './conversation_participants.service';
import { ConversationParticipantsController } from './conversation_participants.controller';
import { ConversationParticipant } from './entities/conversation_participant.entity';
import { Conversation } from '../conversations/entities/conversation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ConversationParticipant, Conversation])],
  controllers: [ConversationParticipantsController],
  providers: [ConversationParticipantsService],
  exports: [ConversationParticipantsService],
})
export class ConversationParticipantsModule {}
