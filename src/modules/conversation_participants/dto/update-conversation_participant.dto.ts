import { PartialType } from '@nestjs/mapped-types';
import { CreateConversationParticipantDto } from './create-conversation_participant.dto';

export class UpdateConversationParticipantDto extends PartialType(
  CreateConversationParticipantDto,
) {}
