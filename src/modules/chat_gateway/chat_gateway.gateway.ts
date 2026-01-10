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
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { IncomingHttpHeaders } from 'http';
import { ChatGatewayService } from './chat_gateway.service';
import { UserRole } from '../users/entities/user.entity';
import { AppException } from '../../common/errors/app.exception';
import {
  ACCEPT_LANGUAGE_HEADER,
  FALLBACK_LANGUAGE,
  SOCKET_LANGUAGE_FIELD,
  USER_LANGUAGE_HEADER,
} from '../../common/i18n/language.constants';

// ==================== Interfaces ====================

interface SendMessageDto {
  conversationId: number;
  content: string;
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
}

interface JoinConversationDto {
  conversationId: number;
}

interface TypingDto {
  conversationId: number;
  isTyping: boolean;
}

interface GetConversationsDto {
  limit?: number;
  cursorId?: number;
}

interface GetConversationHistoryDto {
  conversationId: number;
}

interface DeleteConversationDto {
  conversationId: number;
}

interface ChatSocketData {
  userId?: number;
  role?: UserRole;
  language?: string;
}

type ChatSocket = Socket<any, any, any, ChatSocketData>;

// ==================== Gateway ====================

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGatewayGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGatewayGateway.name);

  constructor(
    private readonly chatGatewayService: ChatGatewayService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Chat WebSocket Gateway initialized');
    this.logger.debug('Chat WebSocket Server ready', server);
  }

  async handleConnection(client: ChatSocket): Promise<void> {
    const lang = this.resolveSocketLanguage(client);
    client.data.language = lang;

    try {
      const { userId, role } = this.resolveUserFromToken(client);
      this.logger.log(`Chat client connected: ${client.id} (userId=${userId}, role=${role})`);

      const message = await this.translateKey(
        'chat.messages.status.connected',
        lang,
        'Connected to chat server successfully.',
      );
      this.emit(client, 'connection', { message, userId, role });
    } catch (error) {
      const message = await this.translateErrorMessage(
        error,
        lang,
        'chat.messages.errors.unauthorized',
        'Unauthorized',
      );
      this.logger.warn(`Chat connection rejected: ${message}`);
      this.emit(client, 'error', { message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: ChatSocket) {
    const userId = client.data?.userId;
    this.logger.log(`Chat client disconnected: ${client.id}${userId ? ` (userId=${userId})` : ''}`);
  }

  // ==================== Message Handlers ====================

  /**
   * Client tham gia vào một cuộc hội thoại
   */
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @MessageBody() data: JoinConversationDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    const lang = this.getSocketLanguage(client);
    try {
      const userId = client.data?.userId;
      if (!userId) {
        return this.createErrorResponse(
          await this.translateKey(
            'chat.messages.errors.unauthorized',
            lang,
            'You must be authenticated to use chat.',
          ),
        );
      }

      this.logger.log(
        `Client ${client.id} (userId=${userId}) attempting to join conversation ${data.conversationId}`,
      );

      const roomName = `conversation_${data.conversationId}`;
      await client.join(roomName);

      this.logger.log(`Client ${client.id} successfully joined ${roomName}`);

      return {
        event: 'joined_conversation',
        data: {
          conversationId: data.conversationId,
          message: await this.translateKey(
            'chat.messages.status.joinedConversation',
            lang,
            'Successfully joined conversation',
          ),
        },
      };
    } catch (error) {
      const message = await this.translateErrorMessage(
        error,
        lang,
        'chat.messages.errors.joinFailed',
        'Failed to join conversation',
      );
      this.logger.error(`Error joining conversation ${data.conversationId}: ${message}`);
      return this.createErrorResponse(message);
    }
  }

  /**
   * Client rời khỏi một cuộc hội thoại
   */
  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @MessageBody() data: JoinConversationDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    const lang = this.getSocketLanguage(client);
    try {
      const roomName = `conversation_${data.conversationId}`;
      await client.leave(roomName);
      this.logger.log(`Client ${client.id} left ${roomName}`);

      return {
        event: 'left_conversation',
        data: {
          conversationId: data.conversationId,
          message: await this.translateKey(
            'chat.messages.status.leftConversation',
            lang,
            'Successfully left conversation',
          ),
        },
      };
    } catch (error) {
      const message = await this.translateErrorMessage(
        error,
        lang,
        'chat.messages.errors.leaveFailed',
        'Failed to leave conversation',
      );
      this.logger.error(`Error leaving conversation: ${message}`);
      return this.createErrorResponse(message);
    }
  }

  /**
   * Gửi tin nhắn mới (sẽ xử lý qua chatbot)
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: SendMessageDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    const lang = this.getSocketLanguage(client);
    const userId = client.data?.userId;
    const role = client.data?.role;

    if (!userId) {
      return this.createErrorResponse(
        await this.translateKey(
          'chat.messages.errors.unauthorized',
          lang,
          'You must be authenticated to send messages.',
        ),
      );
    }

    if (!data.content?.trim()) {
      return this.createErrorResponse(
        await this.translateKey(
          'chat.messages.errors.messageRequired',
          lang,
          'Message content is required.',
        ),
      );
    }

    this.logger.log(
      `Received message from client ${client.id} (userId=${userId}, conversationId=${data.conversationId})`,
    );

    const roomName = `conversation_${data.conversationId}`;

    // Emit trạng thái "bot đang xử lý"
    this.server.to(roomName).emit('bot_typing', {
      conversationId: data.conversationId,
      isTyping: true,
    });

    try {
      const result = await this.chatGatewayService.handleChatMessage(
        {
          conversationId: data.conversationId,
          content: data.content.trim(),
          userId,
          systemPrompt: data.systemPrompt,
          metadata: data.metadata,
          correlationId: client.id,
        },
        {
          id: userId,
          role: role ?? UserRole.CUSTOMER,
        },
      );

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
      const message = await this.translateErrorMessage(
        error,
        lang,
        'chat.messages.errors.sendFailed',
        'Failed to send message',
      );
      this.logger.error(`Error handling send message: ${message}`);
      return this.createErrorResponse(message);
    } finally {
      // Emit trạng thái "bot không còn typing"
      this.server.to(roomName).emit('bot_typing', {
        conversationId: data.conversationId,
        isTyping: false,
      });
    }
  }

  /**
   * Thông báo user đang gõ
   */
  @SubscribeMessage('typing')
  handleTyping(@MessageBody() data: TypingDto, @ConnectedSocket() client: ChatSocket) {
    const userId = client.data?.userId;
    if (!userId) {
      return;
    }

    const roomName = `conversation_${data.conversationId}`;
    client.to(roomName).emit('user_typing', {
      conversationId: data.conversationId,
      userId,
      isTyping: data.isTyping,
    });
  }

  /**
   * Lấy lịch sử cuộc hội thoại
   */
  @SubscribeMessage('get_conversation_history')
  async handleGetHistory(
    @MessageBody() data: GetConversationHistoryDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    const lang = this.getSocketLanguage(client);
    const userId = client.data?.userId;

    if (!userId) {
      return this.createErrorResponse(
        await this.translateKey(
          'chat.messages.errors.unauthorized',
          lang,
          'You must be authenticated to view history.',
        ),
      );
    }

    try {
      this.logger.log(
        `Client ${client.id} (userId=${userId}) requesting history for conversation ${data.conversationId}`,
      );

      const conversation = await this.chatGatewayService.getConversation(
        data.conversationId,
        userId,
      );

      this.logger.log(
        `Successfully retrieved history for conversation ${data.conversationId}, ${conversation.messages?.length || 0} messages`,
      );

      return {
        event: 'conversation_history',
        data: conversation,
      };
    } catch (error) {
      const message = await this.translateErrorMessage(
        error,
        lang,
        'chat.messages.errors.historyFailed',
        'Failed to get conversation history',
      );
      this.logger.error(
        `Error getting conversation history for conversation ${data.conversationId}: ${message}`,
      );
      return this.createErrorResponse(message);
    }
  }

  /**
   * Lấy danh sách cuộc hội thoại
   */
  @SubscribeMessage('get_conversations')
  async handleGetConversations(
    @MessageBody() data: GetConversationsDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    const lang = this.getSocketLanguage(client);
    const userId = client.data?.userId;

    if (!userId) {
      return this.createErrorResponse(
        await this.translateKey(
          'chat.messages.errors.unauthorized',
          lang,
          'You must be authenticated to view conversations.',
        ),
      );
    }

    try {
      const conversations = await this.chatGatewayService.getConversations(userId, {
        limit: data.limit,
        cursorId: data.cursorId,
      });

      return {
        event: 'conversations_list',
        data: conversations,
      };
    } catch (error) {
      const message = await this.translateErrorMessage(
        error,
        lang,
        'chat.messages.errors.getConversationsFailed',
        'Failed to get conversations',
      );
      this.logger.error(`Error getting conversations: ${message}`);
      return this.createErrorResponse(message);
    }
  }

  /**
   * Xóa cuộc hội thoại
   */
  @SubscribeMessage('delete_conversation')
  async handleDeleteConversation(
    @MessageBody() data: DeleteConversationDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    const lang = this.getSocketLanguage(client);
    const userId = client.data?.userId;

    if (!userId) {
      return this.createErrorResponse(
        await this.translateKey(
          'chat.messages.errors.unauthorized',
          lang,
          'You must be authenticated to delete conversations.',
        ),
      );
    }

    try {
      await this.chatGatewayService.deleteConversation(data.conversationId, userId);

      const roomName = `conversation_${data.conversationId}`;
      await client.leave(roomName);

      return {
        event: 'conversation_deleted',
        data: {
          success: true,
          message: await this.translateKey(
            'chat.messages.status.conversationDeleted',
            lang,
            'Conversation deleted successfully',
          ),
        },
      };
    } catch (error) {
      const message = await this.translateErrorMessage(
        error,
        lang,
        'chat.messages.errors.deleteFailed',
        'Failed to delete conversation',
      );
      this.logger.error(`Error deleting conversation: ${message}`);
      return this.createErrorResponse(message);
    }
  }

  // ==================== Helper Methods ====================

  private createErrorResponse(message: string) {
    return {
      event: 'error',
      data: { message },
    };
  }

  private getSocketLanguage(client: ChatSocket): string {
    if (client.data?.language) {
      return client.data.language;
    }
    const lang = this.resolveSocketLanguage(client);
    client.data.language = lang;
    return lang;
  }

  private resolveSocketLanguage(client: ChatSocket): string {
    const authLang = this.normalizeLanguageValue(client.handshake?.auth?.[SOCKET_LANGUAGE_FIELD]);
    if (authLang) {
      return authLang;
    }

    const queryLang = this.normalizeLanguageValue(client.handshake?.query?.[SOCKET_LANGUAGE_FIELD]);
    if (queryLang) {
      return queryLang;
    }

    const headerLang = this.extractLanguageFromHeaders(client.handshake?.headers);
    if (headerLang) {
      return headerLang;
    }

    return FALLBACK_LANGUAGE;
  }

  private normalizeLanguageValue(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length) {
      return value;
    }
    return undefined;
  }

  private extractLanguageFromHeaders(headers?: IncomingHttpHeaders): string | undefined {
    if (!headers) {
      return undefined;
    }

    const headerValue = headers[USER_LANGUAGE_HEADER] ?? headers[ACCEPT_LANGUAGE_HEADER];

    if (typeof headerValue === 'string' && headerValue.trim().length) {
      return headerValue;
    }

    if (Array.isArray(headerValue)) {
      return headerValue.find(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
    }

    return undefined;
  }

  private async translateKey(
    key: string,
    lang: string,
    fallback: string,
    args?: Record<string, unknown>,
  ): Promise<string> {
    try {
      const result = await this.i18n.translate(key, { lang, args });
      if (typeof result === 'string') {
        return result;
      }
    } catch (error) {
      this.logger.debug(`Translation failed for key ${key} (lang=${lang}): ${error}`);
    }
    return fallback;
  }

  private async translateErrorMessage(
    error: unknown,
    lang: string,
    fallbackKey: string,
    fallbackMessage: string,
  ): Promise<string> {
    if (error instanceof AppException) {
      return this.translateKey(error.translationKey ?? fallbackKey, lang, fallbackMessage);
    }

    if (error instanceof HttpException) {
      const response = error.getResponse() as
        | { translationKey?: string; message?: unknown }
        | string
        | undefined;

      if (typeof response === 'string' && response.includes('.')) {
        return this.translateKey(response, lang, fallbackMessage);
      }

      if (response && typeof response === 'object') {
        const translationKey =
          typeof response.translationKey === 'string'
            ? response.translationKey
            : typeof response.message === 'string' && response.message.includes('.')
              ? response.message
              : undefined;
        if (translationKey) {
          return this.translateKey(translationKey, lang, fallbackMessage);
        }
      }

      if (typeof error.message === 'string' && error.message.includes('.')) {
        return this.translateKey(error.message, lang, fallbackMessage);
      }
    }

    if (
      error instanceof Error &&
      typeof error.message === 'string' &&
      error.message.includes('.')
    ) {
      return this.translateKey(error.message, lang, fallbackMessage);
    }

    return this.translateKey(fallbackKey, lang, fallbackMessage);
  }

  private resolveUserFromToken(client: ChatSocket): { userId: number; role: UserRole } {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      this.extractTokenFromHeader(client.handshake.headers.authorization) ??
      (typeof client.handshake.query?.token === 'string' ? client.handshake.query.token : null);

    if (!token) {
      throw new AppException({
        status: HttpStatus.UNAUTHORIZED,
        code: 'CHAT_SOCKET_UNAUTHORIZED',
        translationKey: 'errors.chat.socketUnauthorized',
      });
    }

    try {
      const payload = this.jwtService.verify<{ sub: number; role: UserRole }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      const userId = Number(payload.sub);
      const role = payload.role ?? UserRole.CUSTOMER;

      client.data.userId = userId;
      client.data.role = role;

      return { userId, role };
    } catch (error) {
      this.logger.warn(`Failed to verify chat socket token: ${error}`);
      if (error instanceof AppException) {
        throw error;
      }
      throw new AppException({
        status: HttpStatus.UNAUTHORIZED,
        code: 'CHAT_SOCKET_TOKEN_INVALID',
        translationKey: 'errors.chat.socketTokenInvalid',
        cause: error,
      });
    }
  }

  private extractTokenFromHeader(header?: string | string[]): string | null {
    if (!header) {
      return null;
    }

    if (Array.isArray(header)) {
      return this.extractTokenFromHeader(header.find(Boolean));
    }

    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token) {
      return token;
    }

    return null;
  }

  private emit<T>(client: ChatSocket, event: string, data: T): void {
    const emitter = client as unknown as { emit: (event: string, payload: T) => void };
    emitter.emit(event, data);
  }
}
