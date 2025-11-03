import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatGatewayService } from './chat_gateway.service';

interface SendMessageDto {
  conversationId: number;
  content: string;
  userId: number;
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
}

interface JoinConversationDto {
  conversationId: number;
  userId: number;
}

interface TypingDto {
  conversationId: number;
  userId: number;
  isTyping: boolean;
}

interface GetConversationsDto {
  userId: number;
  limit?: number;
  cursorId?: number;
}

interface GetConversationHistoryDto {
  conversationId: number;
  userId: number;
}

interface DeleteConversationDto {
  conversationId: number;
  userId: number;
}

@WebSocketGateway({
  cors: {
    origin: '*', // Cấu hình CORS cho phù hợp với môi trường của bạn
    credentials: true,
  },
  namespace: '/chat', // Namespace cho chat
})
export class ChatGatewayGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGatewayGateway.name);

  constructor(private readonly chatGatewayService: ChatGatewayService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    this.logger.log('WebSocket Server ready to accept connections', server);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connection', { message: 'Connected to chat server' });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Client tham gia vào một cuộc hội thoại
   */
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @MessageBody() data: JoinConversationDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Client ${client.id} attempting to join conversation ${data.conversationId}`);

      const roomName = `conversation_${data.conversationId}`;
      await client.join(roomName);

      this.logger.log(`Client ${client.id} successfully joined ${roomName}`);

      return {
        event: 'joined_conversation',
        data: {
          conversationId: data.conversationId,
          message: 'Successfully joined conversation',
        },
      };
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error joining conversation ${data.conversationId}:`, stack);
      return {
        event: 'error',
        data: { message: 'Failed to join conversation' },
      };
    }
  }

  /**
   * Client rời khỏi một cuộc hội thoại
   */
  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @MessageBody() data: JoinConversationDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const roomName = `conversation_${data.conversationId}`;
      await client.leave(roomName);
      this.logger.log(`Client ${client.id} left ${roomName}`);

      return {
        event: 'left_conversation',
        data: {
          conversationId: data.conversationId,
          message: 'Successfully left conversation',
        },
      };
    } catch (error) {
      this.logger.error('Error leaving conversation:', error);
      return {
        event: 'error',
        data: { message: 'Failed to leave conversation' },
      };
    }
  }

  /**
   * Gửi tin nhắn mới (sẽ xử lý qua chatbot)
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(@MessageBody() data: SendMessageDto, @ConnectedSocket() client: Socket) {
    try {
      if (!data.userId) {
        return {
          event: 'error',
          data: { message: 'userId is required' },
        };
      }

      this.logger.log(`Received message from client ${client.id}, user ${data.userId}`);

      // Emit trạng thái "bot đang xử lý" cho các client trong room
      const roomName = `conversation_${data.conversationId}`;
      this.server.to(roomName).emit('bot_typing', {
        conversationId: data.conversationId,
        isTyping: true,
      });

      // Gọi service để xử lý tin nhắn qua chatbot
      const result = await this.chatGatewayService.handleChatMessage({
        ...data,
        correlationId: client.id,
      });

      // Emit trạng thái "bot đã xử lý xong"
      this.server.to(roomName).emit('bot_typing', {
        conversationId: data.conversationId,
        isTyping: false,
      });

      // Emit tin nhắn của user cho tất cả client trong room
      this.server.to(roomName).emit('new_message', {
        conversationId: result.conversationId,
        message: result.userMessage,
      });

      // Emit phản hồi của bot cho tất cả client trong room
      this.server.to(roomName).emit('new_message', {
        conversationId: result.conversationId,
        message: result.assistantMessage,
      });

      return {
        event: 'message_sent',
        data: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message';
      this.logger.error('Error handling send message:', message);

      // Emit trạng thái "bot không còn typing"
      const roomName = `conversation_${data.conversationId}`;
      this.server.to(roomName).emit('bot_typing', {
        conversationId: data.conversationId,
        isTyping: false,
      });

      return {
        event: 'error',
        data: {
          message,
        },
      };
    }
  }

  /**
   * Thông báo user đang gõ
   */
  @SubscribeMessage('typing')
  handleTyping(@MessageBody() data: TypingDto, @ConnectedSocket() client: Socket) {
    const roomName = `conversation_${data.conversationId}`;
    client.to(roomName).emit('user_typing', {
      conversationId: data.conversationId,
      userId: data.userId,
      isTyping: data.isTyping,
    });
  }

  /**
   * Lấy lịch sử cuộc hội thoại
   */
  @SubscribeMessage('get_conversation_history')
  async handleGetHistory(
    @MessageBody() data: GetConversationHistoryDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(
        `Client ${client.id} requesting history for conversation ${data.conversationId}`,
      );

      if (!data.userId) {
        this.logger.warn('Missing userId in get_conversation_history request');
        return {
          event: 'error',
          data: { message: 'userId is required' },
        };
      }

      const conversation = await this.chatGatewayService.getConversation(
        data.conversationId,
        data.userId,
      );

      this.logger.log(
        `Successfully retrieved history for conversation ${data.conversationId}, ${conversation.messages?.length || 0} messages`,
      );

      return {
        event: 'conversation_history',
        data: conversation,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get conversation history';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error getting conversation history for conversation ${data.conversationId}:`,
        stack,
      );
      return {
        event: 'error',
        data: { message },
      };
    }
  }

  /**
   * Lấy danh sách cuộc hội thoại
   */
  @SubscribeMessage('get_conversations')
  async handleGetConversations(@MessageBody() data: GetConversationsDto) {
    try {
      if (!data.userId) {
        return {
          event: 'error',
          data: { message: 'userId is required' },
        };
      }

      const conversations = await this.chatGatewayService.getConversations(data.userId, {
        limit: data.limit,
        cursorId: data.cursorId,
      });

      return {
        event: 'conversations_list',
        data: conversations,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get conversations';
      this.logger.error('Error getting conversations:', message);
      return {
        event: 'error',
        data: { message },
      };
    }
  }

  /**
   * Tạo cuộc hội thoại mới
   */
  // @SubscribeMessage('create_conversation')
  // async handleCreateConversation(
  //   @MessageBody() data: CreateConversationDto,
  //   @ConnectedSocket() client: Socket,
  // ) {
  //   try {
  //     // Mặc định tạo UNIFIED conversation nếu không chỉ định type

  //     const conversation = await this.chatGatewayService.createConversation(
  //       {
  //         userId: user.id,
  //         adminUserId: data.adminUserId,
  //         metadata: data.metadata,
  //       },
  //     );

  //     // Auto join vào room mới tạo
  //     const roomName = `conversation_${conversation.id}`;
  //     await client.join(roomName);

  //     return {
  //       event: 'conversation_created',
  //       data: conversation,
  //     };
  //   } catch (error) {
  //     this.logger.error('Error creating conversation:', error);
  //     return {
  //       event: 'error',
  //       data: { message: error.message || 'Failed to create conversation' },
  //     };
  //   }
  // }

  /**
   * Đánh dấu cuộc hội thoại đã đọc
   */
  // @SubscribeMessage('mark_read')
  // async handleMarkRead(
  //   @MessageBody() data: MarkReadDto,
  //   @ConnectedSocket() client: Socket,
  // ) {
  //   try {

  //     await this.chatGatewayService.markConversationAsRead(
  //       data.conversationId,
  //     );

  //     // Notify other clients in the room
  //     const roomName = `conversation_${data.conversationId}`;
  //     this.server.to(roomName).emit('conversation_read', {
  //       conversationId: data.conversationId,
  //       userId: data.userId,
  //     });

  //     return {
  //       event: 'marked_read',
  //       data: { success: true },
  //     };
  //   } catch (error) {
  //     this.logger.error('Error marking conversation as read:', error);
  //     return {
  //       event: 'error',
  //       data: { message: error.message || 'Failed to mark as read' },
  //     };
  //   }
  // }

  /**
   * Xóa cuộc hội thoại
   */
  @SubscribeMessage('delete_conversation')
  async handleDeleteConversation(
    @MessageBody() data: DeleteConversationDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      if (!data.userId) {
        return {
          event: 'error',
          data: { message: 'userId is required' },
        };
      }

      await this.chatGatewayService.deleteConversation(data.conversationId, data.userId);

      // Leave the room
      const roomName = `conversation_${data.conversationId}`;
      await client.leave(roomName);

      return {
        event: 'conversation_deleted',
        data: { success: true },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete conversation';
      this.logger.error('Error deleting conversation:', message);
      return {
        event: 'error',
        data: { message },
      };
    }
  }
}
