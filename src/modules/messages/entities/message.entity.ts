import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../../conversation_participants/entities/conversation_participant.entity';
import { MessageRole } from '../enums/message.enums';

@Entity({ name: 'messages' })
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  conversationId: number;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  // Ai gửi: tham chiếu participant để biết user/admin/assistant nào
  @Column({ type: 'int', nullable: true })
  senderParticipantId: number | null;

  @ManyToOne(() => ConversationParticipant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'senderParticipantId' })
  senderParticipant?: ConversationParticipant | null;

  @Column({
    type: 'enum',
    enum: MessageRole,
    enumName: 'message_role',
  })
  role: MessageRole; // USER/ADMIN/ASSISTANT/SYSTEM

  // Nội dung: có thể JSON để hỗ trợ tool-calls, attachments
  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null; // e.g. tool_calls, function_results, attachments…

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
