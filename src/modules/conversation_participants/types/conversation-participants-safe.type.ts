import { ConversationParticipant } from '../entities/conversation_participant.entity';

export type ConversationParticipantSafe = Omit<ConversationParticipant, 'user'>;
