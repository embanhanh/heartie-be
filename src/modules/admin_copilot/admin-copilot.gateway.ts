import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AdminCopilotService } from './admin-copilot.service';
import {
  AdminCopilotChatRequestDto,
  AdminCopilotHistoryMessageDto,
} from './dto/admin-copilot-chat.dto';
import {
  AdminCopilotRevenueOverviewQueryDto,
  AdminCopilotStockAlertsQueryDto,
  AdminCopilotTopProductsQueryDto,
} from './dto/admin-copilot-tool-query.dto';
import { AdminCopilotHistoryQueryDto } from './dto/admin-copilot-history.dto';
import { UserRole } from '../users/entities/user.entity';
import { I18nService } from 'nestjs-i18n';
import { AppException } from '../../common/errors/app.exception';
import { IncomingHttpHeaders } from 'http';
import {
  ACCEPT_LANGUAGE_HEADER,
  FALLBACK_LANGUAGE,
  SOCKET_LANGUAGE_FIELD,
  USER_LANGUAGE_HEADER,
} from '../../common/i18n/language.constants';

interface AdminCopilotChatPayload {
  message: string;
  history?: AdminCopilotHistoryMessageDto[];
  conversationId?: number;
}

interface AdminCopilotHistoryPayload {
  conversationId?: number;
  page?: number;
  limit?: number;
}

interface AdminCopilotSocketData {
  adminUserId?: number;
  language?: string;
}

type AdminCopilotSocket = Socket<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  AdminCopilotSocketData
>;

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/admin/copilot',
})
export class AdminCopilotGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AdminCopilotGateway.name);

  constructor(
    private readonly adminCopilotService: AdminCopilotService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Admin Copilot WebSocket gateway initialized');
    this.logger.debug('Admin Copilot WebSocket server ready', server); // debug log to avoid noise
  }

  async handleConnection(client: AdminCopilotSocket): Promise<void> {
    const lang = this.resolveSocketLanguage(client);
    client.data.language = lang;

    try {
      const adminUserId = this.resolveAdminUserId(client);
      this.logger.log(`Admin copilot client connected: ${client.id} (adminId=${adminUserId})`);
      const message = await this.translateKey(
        'admin-copilot.messages.status.connected',
        lang,
        'Connected to the admin copilot successfully.',
      );
      this.emit(client, 'admin_copilot_connected', {
        message,
      });
    } catch (error) {
      const message = await this.translateErrorMessage(
        error,
        lang,
        'admin-copilot.messages.errors.unauthorized',
        'Unauthorized',
      );
      this.logger.warn(`Admin copilot connection rejected: ${message}`);
      this.emit(client, 'error', { message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AdminCopilotSocket) {
    const adminUserId = client.data?.adminUserId;
    this.logger.log(
      `Admin copilot client disconnected: ${client.id}${adminUserId ? ` (adminId=${adminUserId})` : ''}`,
    );
  }

  @SubscribeMessage('chat')
  async handleChat(
    @MessageBody() payload: AdminCopilotChatPayload,
    @ConnectedSocket() client: AdminCopilotSocket,
  ) {
    const lang = this.getSocketLanguage(client);
    this.logger.debug(
      `Received chat event from client ${client.id} (adminId=${client.data?.adminUserId ?? 'unknown'}) ` +
        `conversationId=${payload?.conversationId ?? 'auto'} historyLength=${payload?.history?.length ?? 0}`,
    );

    if (!payload?.message || !payload.message.trim()) {
      const message = await this.translateKey(
        'admin-copilot.messages.errors.messageRequired',
        lang,
        'Message must not be empty.',
      );
      return {
        event: 'error',
        data: { message },
      };
    }

    const adminUserId = client.data?.adminUserId;
    if (!adminUserId) {
      const message = await this.translateKey(
        'admin-copilot.messages.errors.unauthorized',
        lang,
        'You must be authenticated to use the admin copilot.',
      );
      return {
        event: 'error',
        data: { message },
      };
    }

    const request: AdminCopilotChatRequestDto = {
      message: payload.message.trim(),
      history: payload.history ?? [],
      conversationId: payload.conversationId,
    };

    this.logger.debug(
      `Emitting typing indicator for admin ${adminUserId} (conversationId=${request.conversationId ?? 'auto'})`,
    );

    this.server.to(client.id).emit('admin_copilot_typing', { isTyping: true });

    try {
      const response = await this.adminCopilotService.chat(request, adminUserId, { lang });
      const responseMetadata = response.metadata as { conversationId?: number } | undefined;
      const responseConversationId = responseMetadata?.conversationId;
      this.logger.debug(
        `Chat response ready for admin ${adminUserId} (conversationId=${responseConversationId ?? 'unknown'})`,
      );
      return {
        event: 'admin_copilot_response',
        data: response,
      };
    } catch (error) {
      const message = await this.translateErrorMessage(
        error,
        lang,
        'admin-copilot.messages.errors.chatFailed',
        'Failed to process the admin copilot conversation.',
      );
      this.logger.error(`Admin copilot chat error: ${message}`);
      return {
        event: 'error',
        data: { message },
      };
    } finally {
      this.server.to(client.id).emit('admin_copilot_typing', { isTyping: false });
    }
  }

  @SubscribeMessage('history')
  async handleHistory(
    @MessageBody() payload: AdminCopilotHistoryPayload,
    @ConnectedSocket() client: AdminCopilotSocket,
  ) {
    const lang = this.getSocketLanguage(client);
    const adminUserId = client.data?.adminUserId;
    if (!adminUserId) {
      const message = await this.translateKey(
        'admin-copilot.messages.errors.unauthorized',
        lang,
        'You must be authenticated to use the admin copilot.',
      );
      return {
        event: 'error',
        data: { message },
      };
    }

    try {
      const query: AdminCopilotHistoryQueryDto = {
        page: payload?.page ?? 1,
        limit: payload?.limit ?? 20,
      } as AdminCopilotHistoryQueryDto;

      this.logger.debug(
        `History request from admin ${adminUserId} (conversationId=${payload?.conversationId ?? 'auto'}, page=${query.page}, limit=${query.limit})`,
      );

      if (payload?.conversationId) {
        query.conversationId = payload.conversationId;
      }

      const result = await this.adminCopilotService.getHistory(adminUserId, query);
      return {
        event: 'history',
        data: result,
      };
    } catch (error) {
      const message = await this.translateErrorMessage(
        error,
        lang,
        'admin-copilot.messages.errors.historyFailed',
        'Failed to fetch admin copilot history.',
      );
      this.logger.error(`Admin copilot history error: ${message}`);
      return {
        event: 'error',
        data: { message },
      };
    }
  }

  @SubscribeMessage('get_revenue_overview')
  async handleGetRevenueOverview(
    @MessageBody() payload: Partial<AdminCopilotRevenueOverviewQueryDto> = {},
    @ConnectedSocket() client: AdminCopilotSocket,
  ) {
    const lang = this.getSocketLanguage(client);
    try {
      this.logger.debug(
        `Socket request get_revenue_overview with payload ${JSON.stringify(payload)}`,
      );
      const adminUserId = client.data?.adminUserId;
      if (!adminUserId) {
        this.logger.warn('Socket get_revenue_overview missing admin context');
        const message = await this.translateKey(
          'admin-copilot.messages.errors.unauthorized',
          lang,
          'You must be authenticated to use the admin copilot.',
        );
        return {
          event: 'error',
          data: { message },
        };
      }
      const result = await this.adminCopilotService.getRevenueOverview(adminUserId, payload ?? {});
      return {
        event: 'revenue_overview',
        data: result,
      };
    } catch (error) {
      const message = await this.translateErrorMessage(
        error,
        lang,
        'admin-copilot.messages.errors.toolFailed',
        'Failed to fetch revenue overview.',
      );
      this.logger.error(`Admin copilot revenue overview error: ${message}`);
      return {
        event: 'error',
        data: { message },
      };
    }
  }

  @SubscribeMessage('get_top_products')
  async handleGetTopProducts(
    @MessageBody() payload: Partial<AdminCopilotTopProductsQueryDto> = {},
    @ConnectedSocket() client: AdminCopilotSocket,
  ) {
    const lang = this.getSocketLanguage(client);
    try {
      this.logger.debug(`Socket request get_top_products with payload ${JSON.stringify(payload)}`);
      const adminUserId = client.data?.adminUserId;
      if (!adminUserId) {
        this.logger.warn('Socket get_top_products missing admin context');
        const message = await this.translateKey(
          'admin-copilot.messages.errors.unauthorized',
          lang,
          'You must be authenticated to use the admin copilot.',
        );
        return {
          event: 'error',
          data: { message },
        };
      }
      const result = await this.adminCopilotService.getTopProducts(adminUserId, payload ?? {});
      return {
        event: 'top_products',
        data: result,
      };
    } catch (error) {
      const message = await this.translateErrorMessage(
        error,
        lang,
        'admin-copilot.messages.errors.toolFailed',
        'Failed to fetch top products.',
      );
      this.logger.error(`Admin copilot top products error: ${message}`);
      return {
        event: 'error',
        data: { message },
      };
    }
  }

  @SubscribeMessage('get_stock_alerts')
  async handleGetStockAlerts(
    @MessageBody() payload: Partial<AdminCopilotStockAlertsQueryDto> = {},
    @ConnectedSocket() client: AdminCopilotSocket,
  ) {
    const lang = this.getSocketLanguage(client);
    try {
      this.logger.debug(`Socket request get_stock_alerts with payload ${JSON.stringify(payload)}`);
      const adminUserId = client.data?.adminUserId;
      if (!adminUserId) {
        this.logger.warn('Socket get_stock_alerts missing admin context');
        const message = await this.translateKey(
          'admin-copilot.messages.errors.unauthorized',
          lang,
          'You must be authenticated to use the admin copilot.',
        );
        return {
          event: 'error',
          data: { message },
        };
      }
      const result = await this.adminCopilotService.getStockAlerts(adminUserId, payload ?? {});
      return {
        event: 'stock_alerts',
        data: result,
      };
    } catch (error) {
      const message = await this.translateErrorMessage(
        error,
        lang,
        'admin-copilot.messages.errors.toolFailed',
        'Failed to fetch stock alerts.',
      );
      this.logger.error(`Admin copilot stock alerts error: ${message}`);
      return {
        event: 'error',
        data: { message },
      };
    }
  }

  private getSocketLanguage(client: AdminCopilotSocket): string {
    if (client.data?.language) {
      return client.data.language;
    }
    const lang = this.resolveSocketLanguage(client);
    client.data.language = lang;
    return lang;
  }

  private resolveSocketLanguage(client: AdminCopilotSocket): string {
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

  private resolveAdminUserId(client: AdminCopilotSocket): number {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      this.extractTokenFromHeader(client.handshake.headers.authorization) ??
      (typeof client.handshake.query?.token === 'string' ? client.handshake.query.token : null);

    if (!token) {
      throw new AppException({
        status: HttpStatus.UNAUTHORIZED,
        code: 'ADMIN_COPILOT_SOCKET_UNAUTHORIZED',
        translationKey: 'errors.adminCopilot.socketUnauthorized',
      });
    }

    try {
      const payload = this.jwtService.verify<{ sub: number; role: UserRole }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      if (payload?.role !== UserRole.ADMIN) {
        throw new AppException({
          status: HttpStatus.FORBIDDEN,
          code: 'ADMIN_COPILOT_SOCKET_FORBIDDEN',
          translationKey: 'errors.adminCopilot.conversationAccessDenied',
        });
      }

      const adminUserId = Number(payload.sub);
      client.data.adminUserId = adminUserId;
      return adminUserId;
    } catch (error) {
      this.logger.warn(`Failed to verify admin copilot socket token: ${error}`);
      if (error instanceof AppException) {
        throw error;
      }
      throw new AppException({
        status: HttpStatus.UNAUTHORIZED,
        code: 'ADMIN_COPILOT_SOCKET_TOKEN_INVALID',
        translationKey: 'errors.adminCopilot.socketTokenInvalid',
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

  private emit<T>(client: AdminCopilotSocket, event: string, data: T): void {
    const emitter = client as unknown as { emit: (event: string, payload: T) => void };
    emitter.emit(event, data);
  }
}
