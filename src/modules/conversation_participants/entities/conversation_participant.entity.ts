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
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'conversation_participants' })
@Index(['userId', 'conversationId'], { unique: true })
@Index(['conversationId'])
export class ConversationParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  userId: number | null; // Với ASSISTANT có thể null hoặc trỏ tới bảng AssistantProfile

  @ManyToOne(() => User, (user) => user.participants, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User | null;

  @Column({ type: 'int' })
  conversationId: number;

  @ManyToOne(() => Conversation, (conversation) => conversation.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  // Unread cá nhân hóa
  @Column({ type: 'int', default: 0 })
  unreadCount: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  settings: Record<string, unknown>; // mute, notifications,…

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
