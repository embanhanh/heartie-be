import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConversationParticipant } from '../../conversation_participants/entities/conversation_participant.entity';
import { Message } from '../../messages/entities/message.entity';

@Entity({ name: 'conversations' })
@Index(['updatedAt'])
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>;

  // Denormalized để sort nhanh, hiển thị list
  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: 'int', nullable: true })
  lastMessageId: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => ConversationParticipant, (p) => p.conversation, {
    cascade: ['insert'],
    eager: false,
  })
  participants: ConversationParticipant[];

  @OneToMany(() => Message, (m) => m.conversation, { eager: false })
  messages: Message[];
}
