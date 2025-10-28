import { Injectable, Logger } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { CreateConversationDto } from '../conversations/dto/create-conversation.dto';
import { MessageRole } from '../messages/enums/message.enums';

interface SendMessageDto {
  conversationId: number;
  content: string;
  userId: number;
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

interface CreateConversationInput {
  userId: number;
  adminUserId?: number;
  title?: string;
  metadata?: Record<string, unknown>;
}

interface PaginationOptions {
  limit?: number;
  cursorId?: number | null;
}

@Injectable()
export class ChatGatewayService {
  private readonly logger = new Logger(ChatGatewayService.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  /**
   * Xử lý tin nhắn chat (gửi tin và nhận phản hồi từ AI/admin)
   */
  async handleChatMessage(data: SendMessageDto) {
    try {
      this.logger.log(
        `Processing chat message for conversation ${data.conversationId} from user ${data.userId}`,
      );

      const createMessageDto: CreateMessageDto = {
        conversationId: data.conversationId,
        content: data.content,
        role: MessageRole.USER,
        systemPrompt: data.systemPrompt,
        metadata: data.metadata || {},
      };

      // Gọi MessagesService để xử lý tin nhắn (có thể trigger AI response)
      const result = await this.messagesService.create(createMessageDto, data.userId, {
        correlationId: data.correlationId,
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error handling chat message: ${message}`, stack);
      throw error;
    }
  }

  /**
   * Lấy thông tin chi tiết cuộc hội thoại với messages
   */
  async getConversation(conversationId: number, currentUserId: number) {
    try {
      this.logger.log(`Fetching conversation ${conversationId} for user ${currentUserId}`);

      const conversation = await this.conversationsService.getConversationDetail(
        currentUserId,
        conversationId,
      );

      this.logger.log(`Retrieved conversation ${conversationId}, now loading messages...`);

      // Load messages for the conversation
      const messages = await this.messagesService.findAll(conversationId);

      this.logger.log(`Loaded ${messages.length} messages for conversation ${conversationId}`);

      // Return conversation with messages array
      return {
        ...conversation,
        messages: messages || [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error getting conversation ${conversationId}: ${message}`, stack);
      throw error;
    }
  }

  /**
   * Lấy danh sách cuộc hội thoại của user (có phân trang)
   */
  async getConversations(currentUserId: number, options?: PaginationOptions) {
    try {
      return await this.conversationsService.listMyConversations(currentUserId, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error getting conversations for user ${currentUserId}: ${message}`, stack);
      throw error;
    }
  }

  /**
   * Tạo cuộc hội thoại mới
   */
  async createConversation(data: CreateConversationInput) {
    try {
      const createDto: CreateConversationDto = {
        adminUserId: data.adminUserId,
        metadata: data.metadata,
      };

      return await this.conversationsService.createConversation(createDto, data.userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error creating conversation: ${message}`, stack);
      throw error;
    }
  }

  /**
   * Đánh dấu cuộc hội thoại đã đọc
   */
  async markConversationAsRead(conversationId: number) {
    try {
      await this.conversationsService.markRead(conversationId);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error marking conversation ${conversationId} as read: ${message}`, stack);
      throw error;
    }
  }

  /**
   * Xóa (soft delete) cuộc hội thoại
   */
  async deleteConversation(conversationId: number, currentUserId: number) {
    try {
      await this.conversationsService.remove(currentUserId, conversationId);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error deleting conversation ${conversationId}: ${message}`, stack);
      throw error;
    }
  }
}
