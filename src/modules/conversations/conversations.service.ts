import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversation_participants/entities/conversation_participant.entity';
import { Message } from '../messages/entities/message.entity';
import { MessageRole } from '../messages/enums/message.enums';
import { CreateConversationDto } from './dto/create-conversation.dto';

type PaginateOpts = { limit?: number; cursorId?: number | null };

@Injectable()
export class ConversationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly partRepo: Repository<ConversationParticipant>,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
  ) {}

  private clampLimit(limit?: number) {
    return Math.min(Math.max(limit ?? 20, 1), 100);
  }

  /**
   * Tạo hội thoại thống nhất: user + assistant + admin trong cùng 1 conversation.
   * Nếu user đã có conversation thì trả về conversation cũ.
   */
  async createConversation(dto: CreateConversationDto, currentUserId: number) {
    return this.dataSource.transaction(async (trx) => {
      // Kiểm tra xem user đã có conversation chưa
      const existing = await trx
        .getRepository(Conversation)
        .createQueryBuilder('c')
        .innerJoin('c.participants', 'p', 'p.conversationId = c.id AND p.userId = :uid', {
          uid: currentUserId,
        })
        .where('c.deletedAt IS NULL')
        .orderBy('c.updatedAt', 'DESC')
        .getOne();

      if (existing) return existing;

      // Tạo conversation mới
      const conv = trx.getRepository(Conversation).create({
        metadata: dto?.metadata ?? {},
        lastMessageAt: null,
        lastMessageId: null,
      });
      const saved = await trx.getRepository(Conversation).save(conv);

      // Thêm 3 participants: USER + ASSISTANT + ADMIN
      const parts = [
        trx.getRepository(ConversationParticipant).create({
          conversationId: saved.id,
          userId: currentUserId,
          unreadCount: 0,
          settings: {},
        }),
        trx.getRepository(ConversationParticipant).create({
          conversationId: saved.id,
          userId: null, // Assistant không có userId thật
          unreadCount: 0,
          settings: { model: 'gemini-2.5-flash', name: 'Fia' },
        }),
        trx.getRepository(ConversationParticipant).create({
          conversationId: saved.id,
          userId: dto.adminUserId, // Admin sẽ được gán userId khi họ tham gia vào cuộc trò chuyện
          unreadCount: 0,
          settings: {},
        }),
      ];
      await trx.getRepository(ConversationParticipant).save(parts);

      // Tạo tin nhắn chào mừng
      const welcomeMessage = trx.getRepository(Message).create({
        conversationId: saved.id,
        senderParticipantId: null,
        role: MessageRole.ASSISTANT,
        content: `Xin chào! Mình là Fia - Trợ lý AI của Fashia 👋

Mình có thể giúp bạn:
🔍 Tra cứu và theo dõi đơn hàng
🛍️ Tìm kiếm sản phẩm theo sở thích
📦 Hỗ trợ đổi trả và hoàn tiền
💬 Giải đáp thắc mắc về sản phẩm và dịch vụ

Nếu cần hỗ trợ từ nhân viên, mình sẽ chuyển cho admin nhé! 😊`,
        metadata: {
          type: 'welcome_message',
          provider: 'system',
        },
      });
      const savedMessage = await trx.getRepository(Message).save(welcomeMessage);

      // Cập nhật lastMessageAt và lastMessageId
      await trx.getRepository(Conversation).update(saved.id, {
        lastMessageAt: savedMessage.createdAt,
        lastMessageId: savedMessage.id,
      });

      return saved;
    });
  }

  /**
   * Liệt kê conversation của currentUser, có phân trang kiểu cursor theo id.
   * Không load messages để tránh payload lớn.
   */
  async listMyConversations(
    currentUserId: number,
    opts?: PaginateOpts,
  ): Promise<{ items: Conversation[]; nextCursor: number | null }> {
    const limit = this.clampLimit(opts?.limit);
    // Lọc theo participant
    const qb = this.convRepo
      .createQueryBuilder('c')
      .innerJoin('c.participants', 'p', 'p.conversationId = c.id AND p.userId = :uid', {
        uid: currentUserId,
      })
      .where('c.deletedAt IS NULL');

    if (opts?.cursorId) {
      // Cursor theo id giảm dần (mới trước)
      qb.andWhere('c.id < :cursorId', { cursorId: opts.cursorId });
    }

    const items = await qb
      .orderBy('c.updatedAt', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .take(limit + 1)
      .getMany();

    let nextCursor: number | null = null;
    if (items.length > limit) {
      const popped = items.pop()!;
      nextCursor = popped.id;
    }

    return { items, nextCursor };
  }

  /**
   * Chi tiết hội thoại (kèm participants + messages optional: để controller quyết định preload messages).
   */
  async getConversationDetail(
    currentUserId: number,
    conversationId: number,
  ): Promise<Conversation> {
    // Check ownership
    const participant = await this.partRepo.findOne({
      where: { conversationId, userId: currentUserId },
    });
    if (!participant) throw new NotFoundException('Conversation not found');

    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');

    return conv; // Controller có thể gọi MessagesService.listMessages để nạp messages theo trang
  }

  /**
   * Đánh dấu đã đọc: reset unreadCount cho participant hiện tại.
   */
  async markRead(conversationId: number): Promise<void> {
    const participant = await this.partRepo.findOne({ where: { conversationId } });
    if (!participant) throw new NotFoundException('Conversation not found');

    if (participant.unreadCount > 0) {
      await this.partRepo.update({ id: participant.id }, { unreadCount: 0 });
    }
  }

  /**
   * Xoá mềm 1 conversation của current user (chỉ cho phép nếu user là participant).
   */
  async remove(currentUserId: number, conversationId: number): Promise<void> {
    const participant = await this.partRepo.findOne({
      where: { conversationId, userId: currentUserId },
    });
    if (!participant) throw new NotFoundException('Conversation not found');

    const res = await this.convRepo.softDelete({ id: conversationId });
    if (!res.affected) throw new NotFoundException('Conversation not found');
  }

  /**
   * Gán admin vào conversation UNIFIED (khi admin vào hỗ trợ user)
   */
  async assignAdminToConversation(conversationId: number, adminUserId: number): Promise<void> {
    return this.dataSource.transaction(async (trx) => {
      // Kiểm tra conversation tồn tại
      const conversation = await trx.getRepository(Conversation).findOne({
        where: { id: conversationId },
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      // Tìm admin participant (role ADMIN, userId null)
      const adminParticipant = await trx.getRepository(ConversationParticipant).findOne({
        where: {
          conversationId,
        },
      });

      if (!adminParticipant) {
        throw new NotFoundException('Admin participant not found in this conversation');
      }

      // Gán userId cho admin participant
      if (adminParticipant.userId !== adminUserId) {
        await trx
          .getRepository(ConversationParticipant)
          .update({ id: adminParticipant.id }, { userId: adminUserId });
      }
    });
  }
}
