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
import { ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
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
  ) {}

  afterInit(server: Server) {
    this.logger.log('Admin Copilot WebSocket gateway initialized');
    this.logger.debug('Admin Copilot WebSocket server ready', server); // debug log to avoid noise
  }

  handleConnection(client: AdminCopilotSocket) {
    try {
      const adminUserId = this.resolveAdminUserId(client);
      this.logger.log(`Admin copilot client connected: ${client.id} (adminId=${adminUserId})`);
      this.emit(client, 'admin_copilot_connected', {
        message: 'Connected to admin copilot gateway',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
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
    this.logger.debug(
      `Received chat event from client ${client.id} (adminId=${client.data?.adminUserId ?? 'unknown'}) ` +
        `conversationId=${payload?.conversationId ?? 'auto'} historyLength=${payload?.history?.length ?? 0}`,
    );

    if (!payload?.message || !payload.message.trim()) {
      return {
        event: 'error',
        data: { message: 'message is required' },
      };
    }

    const adminUserId = client.data?.adminUserId;
    if (!adminUserId) {
      return {
        event: 'error',
        data: { message: 'Unauthorized' },
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
      const response = await this.adminCopilotService.chat(request, adminUserId);
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
      const message = error instanceof Error ? error.message : 'Admin copilot chat failed';
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
    const adminUserId = client.data?.adminUserId;
    if (!adminUserId) {
      return {
        event: 'error',
        data: { message: 'Unauthorized' },
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
      const message = error instanceof Error ? error.message : 'Failed to fetch history';
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
  ) {
    try {
      this.logger.debug(
        `Socket request get_revenue_overview with payload ${JSON.stringify(payload)}`,
      );
      const result = await this.adminCopilotService.getRevenueOverview(payload ?? {});
      return {
        event: 'revenue_overview',
        data: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch revenue overview';
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
  ) {
    try {
      this.logger.debug(`Socket request get_top_products with payload ${JSON.stringify(payload)}`);
      const result = await this.adminCopilotService.getTopProducts(payload ?? {});
      return {
        event: 'top_products',
        data: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch top products';
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
  ) {
    try {
      this.logger.debug(`Socket request get_stock_alerts with payload ${JSON.stringify(payload)}`);
      const result = await this.adminCopilotService.getStockAlerts(payload ?? {});
      return {
        event: 'stock_alerts',
        data: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch stock alerts';
      this.logger.error(`Admin copilot stock alerts error: ${message}`);
      return {
        event: 'error',
        data: { message },
      };
    }
  }

  private resolveAdminUserId(client: AdminCopilotSocket): number {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      this.extractTokenFromHeader(client.handshake.headers.authorization) ??
      (typeof client.handshake.query?.token === 'string' ? client.handshake.query.token : null);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const payload = this.jwtService.verify<{ sub: number; role: UserRole }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      if (payload?.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Admin privileges required');
      }

      const adminUserId = Number(payload.sub);
      client.data.adminUserId = adminUserId;
      return adminUserId;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(`Failed to verify admin copilot socket token: ${error}`);
      throw new UnauthorizedException('Invalid access token');
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
