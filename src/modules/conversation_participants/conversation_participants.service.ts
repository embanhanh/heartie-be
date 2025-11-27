import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConversationParticipant } from './entities/conversation_participant.entity';
import { Conversation } from '../conversations/entities/conversation.entity';

@Injectable()
export class ConversationParticipantsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ConversationParticipant)
    private readonly partRepo: Repository<ConversationParticipant>,
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
  ) {}

  /**
   * Liệt kê participant của 1 conversation (chỉ khi currentUser cũng là participant).
   */
  async listParticipants(
    currentUserId: number,
    conversationId: number,
  ): Promise<ConversationParticipant[]> {
    const me = await this.partRepo.findOne({ where: { conversationId, userId: currentUserId } });
    if (!me) throw new NotFoundException('Conversation not found');

    return this.partRepo.find({ where: { conversationId } });
  }

  /**
   * Thêm admin vào conversation (chỉ khi currentUser là ADMIN hoặc là người sở hữu domain cho phép).
   * Tuỳ chính sách: ở đây đơn giản yêu cầu currentUser là ADMIN trong thread.
   */
  async addAdmin(
    currentUserId: number,
    conversationId: number,
    adminUserId: number,
  ): Promise<ConversationParticipant> {
    const me = await this.partRepo.findOne({ where: { conversationId, userId: currentUserId } });
    if (!me) throw new NotFoundException('Conversation not found');

    const exists = await this.partRepo.findOne({ where: { conversationId, userId: adminUserId } });
    if (exists) throw new BadRequestException('User already a participant');

    const participant = this.partRepo.create({
      conversationId,
      userId: adminUserId,
      unreadCount: 0,
      settings: {},
    });
    return this.partRepo.save(participant);
  }

  /**
   * Thêm assistant (bot) vào conversation.
   */
  async addAssistant(
    currentUserId: number,
    conversationId: number,
    assistantConfig?: Record<string, unknown>,
  ) {
    const me = await this.partRepo.findOne({ where: { conversationId, userId: currentUserId } });
    if (!me) throw new NotFoundException('Conversation not found');
    // Cho phép cả USER/ADMIN thêm bot (tuỳ chính sách), ở đây chấp nhận

    const assistant = this.partRepo.create({
      conversationId,
      userId: null,
      unreadCount: 0,
      settings: assistantConfig ?? { model: 'gpt-4o-mini' },
    });
    return this.partRepo.save(assistant);
  }

  /**
   * Rời khỏi conversation: participant hiện tại bị remove; nếu là người cuối cùng → tuỳ chính sách có thể xoá mềm conv.
   */
  async leaveConversation(currentUserId: number, conversationId: number): Promise<void> {
    const me = await this.partRepo.findOne({ where: { conversationId, userId: currentUserId } });
    if (!me) throw new NotFoundException('Conversation not found');

    await this.partRepo.remove(me);

    // (Tuỳ chọn) Nếu không còn participant người thật nào → soft delete conversation
    const remain = await this.partRepo.count({ where: { conversationId } });
    if (remain === 0) {
      await this.convRepo.softDelete({ id: conversationId });
    }
  }
}
