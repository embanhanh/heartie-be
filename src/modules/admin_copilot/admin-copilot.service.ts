import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { FunctionCall, FunctionResponsePart, Tool, SchemaType } from '@google/generative-ai';
import { Repository } from 'typeorm';
import { GeminiService, GeminiChatMessage, GeminiChatRole } from '../gemini/gemini.service';
import {
  AdminCopilotChatRequestDto,
  AdminCopilotHistoryMessageDto,
  AdminCopilotMessageRole,
  AdminCopilotResponseDto,
} from './dto/admin-copilot-chat.dto';
import {
  AdminCopilotHistoryItemDto,
  AdminCopilotHistoryQueryDto,
  AdminCopilotHistoryResponseDto,
} from './dto/admin-copilot-history.dto';
import { TrendForecastingService } from '../trend_forecasting/trend-forecasting.service';
import { TrendGranularity } from '../trend_forecasting/dto/trend-forecast-query.dto';
import { TrendForecastResponseDto } from '../trend_forecasting/dto/trend-forecast-response.dto';
import { OrderItem } from '../order_items/entities/order-item.entity';
import { ProductVariantInventory } from '../inventory/entities/product-variant-inventory.entity';
import { OrderStatus } from '../orders/entities/order.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversation_participants/entities/conversation_participant.entity';
import { ParticipantRole } from '../conversations/enums/conversation.enums';
import { Message } from '../messages/entities/message.entity';
import { MessageRole } from '../messages/enums/message.enums';

const ADMIN_COPILOT_SYSTEM_PROMPT = `Bạn là FiaOps — trợ lý chiến lược dành cho đội vận hành/ban giám đốc của Fashia.

# Phong cách trả lời
- Giọng điệu: chuyên nghiệp, ngắn gọn, ưu tiên bullet với dấu gạch ngang (-).
- Nhấn mạnh insight chính, nêu rõ số liệu quan trọng, đề xuất hành động tiếp theo.
- Nếu dữ liệu không đủ, nói thẳng "chưa đủ dữ liệu" và gợi ý bước cần lấy thêm.

# Nguyên tắc dữ liệu
- Chỉ sử dụng số liệu được cung cấp từ các hàm (tool). Không phỏng đoán.
- Đối với tiền tệ, sử dụng định dạng VND với dấu phẩy phân tách hàng nghìn.
- Khi so sánh tăng/giảm, nêu rõ phần trăm và ngữ cảnh thời gian.

# Hàm (tool) khả dụng
- get_revenue_overview: lấy tổng quan doanh thu, số đơn, AOV, dự báo.
- get_top_products: liệt kê sản phẩm bán chạy theo doanh thu.
- get_stock_alerts: cảnh báo SKU tồn kho thấp.

# Quy tắc output
- Nếu cần gọi tool, hãy gọi ngay, không trả lời vòng vo.
- Sau khi có kết quả, tóm tắt 2-4 ý quan trọng và đề xuất bước hành động rõ ràng.
- Tránh các cụm từ chung chung như "có vẻ" hoặc "có thể" nếu dữ liệu đã rõ.
`;

const ADMIN_COPILOT_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'get_revenue_overview',
        description:
          'Lấy tổng quan doanh thu, số đơn, sản phẩm bán ra và dự báo cho khoảng thời gian gần nhất.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            range: {
              type: SchemaType.STRING,
              format: 'enum',
              description: 'Khoảng thời gian phân tích',
              enum: ['7d', '30d', '90d'],
            },
            granularity: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: ['day', 'week', 'month'],
            },
            forecastPeriods: {
              type: SchemaType.NUMBER,
              description: 'Số kỳ dự báo tiếp theo',
            },
          },
        },
      },
      {
        name: 'get_top_products',
        description: 'Lấy danh sách sản phẩm bán chạy theo doanh thu.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            range: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: ['7d', '30d', '90d'],
            },
            limit: { type: SchemaType.NUMBER, description: 'Số lượng sản phẩm, mặc định 5' },
          },
        },
      },
      {
        name: 'get_stock_alerts',
        description: 'Liệt kê các SKU tồn kho thấp để kịp thời bổ sung.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            threshold: {
              type: SchemaType.NUMBER,
              description: 'Ngưỡng tồn kho tối thiểu để cảnh báo',
            },
            branchId: {
              type: SchemaType.NUMBER,
              description: 'Lọc theo chi nhánh cụ thể (tùy chọn)',
            },
            limit: {
              type: SchemaType.NUMBER,
              description: 'Số lượng cảnh báo tối đa trả về',
            },
          },
        },
      },
    ],
  },
];

const ADMIN_COPILOT_CONVERSATION_TYPE = 'ADMIN_COPILOT';
const ADMIN_COPILOT_HISTORY_LIMIT = 40;

interface RangeConfig {
  range: '7d' | '30d' | '90d';
  days: number;
  lookbackMonths: number;
  granularity: TrendGranularity;
}

const RANGE_CONFIGS: RangeConfig[] = [
  { range: '7d', days: 7, lookbackMonths: 1, granularity: 'day' },
  { range: '30d', days: 30, lookbackMonths: 3, granularity: 'week' },
  { range: '90d', days: 90, lookbackMonths: 6, granularity: 'month' },
];

type RangeKey = RangeConfig['range'];

interface RevenueOverviewInput {
  range?: RangeKey;
  granularity?: TrendGranularity;
  forecastPeriods?: number;
}

export interface AdminCopilotRevenueOverviewResult {
  range: RangeKey;
  granularity: TrendGranularity;
  periodStart: string | null;
  periodEnd: string | null;
  totalRevenue: number;
  totalOrders: number;
  totalUnits: number;
  averageOrderValue: number;
  forecast: TrendForecastResponseDto['forecast'][number] | null;
  summary: TrendForecastResponseDto['summary'];
}

interface TopProductsInput {
  range?: RangeKey;
  limit?: number;
}

interface TopProductRow {
  productId: number;
  name: string;
  revenue: number;
  unitsSold: number;
  revenueShare: number;
}

export interface AdminCopilotTopProductsResult {
  range: RangeKey;
  products: TopProductRow[];
}

interface StockAlertsInput {
  threshold?: number;
  branchId?: number;
  limit?: number;
}

interface StockAlertRow {
  inventoryId: number;
  variantId: number;
  productId: number;
  productName: string;
  stock: number;
  branchId: number | null;
  branchName: string | null;
}

export interface AdminCopilotStockAlertsResult {
  threshold: number;
  alerts: StockAlertRow[];
}

@Injectable()
export class AdminCopilotService {
  private readonly logger = new Logger(AdminCopilotService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly trendForecastingService: TrendForecastingService,
    private readonly configService: ConfigService,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(ProductVariantInventory)
    private readonly inventoryRepository: Repository<ProductVariantInventory>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepository: Repository<ConversationParticipant>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async chat(
    request: AdminCopilotChatRequestDto,
    adminUserId: number,
  ): Promise<AdminCopilotResponseDto> {
    const trimmedMessage = request.message?.trim();
    if (!trimmedMessage) {
      throw new BadRequestException('Message cannot be empty');
    }

    this.logger.debug(
      `Admin ${adminUserId} is sending copilot chat message` +
        ` (conversationId=${request.conversationId ?? 'auto'}, historyLength=${
          request.history?.length ?? 0
        })`,
    );

    const context = await this.ensureAdminConversation(adminUserId, {
      conversationId: request.conversationId,
    });

    this.logger.debug(
      `Resolved admin copilot conversation ${context.conversation.id} for admin ${adminUserId}`,
    );

    const historyEntities = await this.messageRepository.find({
      where: { conversationId: context.conversation.id },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: ADMIN_COPILOT_HISTORY_LIMIT,
    });

    const historyMessages = this.mapMessagesToGemini(historyEntities);

    const adminMessageEntity = this.messageRepository.create({
      conversationId: context.conversation.id,
      senderParticipantId: context.adminParticipant?.id ?? null,
      role: MessageRole.ADMIN,
      content: trimmedMessage,
      metadata: {
        type: 'admin_message',
      },
    });
    await this.messageRepository.save(adminMessageEntity);

    const newHistory: AdminCopilotHistoryMessageDto[] = [
      { role: AdminCopilotMessageRole.USER, content: trimmedMessage },
    ];

    const firstCall = await this.geminiService.generateContent(trimmedMessage, historyMessages, {
      systemPrompt: ADMIN_COPILOT_SYSTEM_PROMPT,
      temperature: 0.1,
      tools: ADMIN_COPILOT_TOOLS,
      model: this.getAdminModelName(),
    });

    if (firstCall.functionCall) {
      this.logger.debug(
        `Gemini requested function call ${firstCall.functionCall.name} for conversation ${context.conversation.id}`,
      );
    }

    if (!firstCall.text) {
      this.logger.debug(
        `Gemini returned empty text on first call for conversation ${context.conversation.id}`,
      );
    }

    let reply = firstCall.text ?? '';
    let functionCall: AdminCopilotResponseDto['functionCall'] = null;
    let toolResult: Record<string, unknown> | null = null;

    if (firstCall.functionCall) {
      const toolExecution = await this.dispatchTool(firstCall.functionCall);
      const responsePayload = toolExecution.functionResponse.response as Record<string, unknown>;
      toolResult = responsePayload;
      functionCall = {
        name: firstCall.functionCall.name,
        args: (firstCall.functionCall.args ?? {}) as Record<string, unknown>,
      };

      this.logger.debug(
        `Executed tool ${functionCall.name} for conversation ${context.conversation.id} with args ${JSON.stringify(functionCall.args)}`,
      );

      const tempHistory: GeminiChatMessage[] = [
        ...historyMessages,
        { role: GeminiChatRole.USER, content: trimmedMessage },
        { role: GeminiChatRole.MODEL, content: JSON.stringify(firstCall.functionCall) },
        { role: GeminiChatRole.USER, content: JSON.stringify(toolExecution) },
      ];

      const second = await this.geminiService.generateContentWithFunctionResponse(
        tempHistory,
        toolExecution,
        {
          systemPrompt: ADMIN_COPILOT_SYSTEM_PROMPT,
          temperature: 0.1,
          tools: ADMIN_COPILOT_TOOLS,
          model: this.getAdminModelName(),
        },
      );
      reply = second.text ?? '';

      if (!reply) {
        this.logger.warn(
          `Gemini returned empty response after tool execution for conversation ${context.conversation.id}`,
        );
      }
    } else if (!reply) {
      throw new BadRequestException('Gemini did not return any answer');
    }

    const assistantHistoryEntry: AdminCopilotHistoryMessageDto = {
      role: AdminCopilotMessageRole.ASSISTANT,
      content: reply,
    };
    newHistory.push(assistantHistoryEntry);

    const assistantMetadata: Record<string, unknown> = {
      provider: 'gemini',
      model: this.getAdminModelName(),
    };
    if (functionCall) {
      assistantMetadata.functionCall = functionCall;
    }
    if (toolResult) {
      assistantMetadata.toolResult = toolResult;
    }

    const assistantMessageEntity = this.messageRepository.create({
      conversationId: context.conversation.id,
      senderParticipantId: context.assistantParticipant?.id ?? null,
      role: MessageRole.ASSISTANT,
      content: reply,
      metadata: assistantMetadata,
    });
    await this.messageRepository.save(assistantMessageEntity);

    await this.conversationRepository.update(context.conversation.id, {
      lastMessageAt: assistantMessageEntity.createdAt,
      lastMessageId: assistantMessageEntity.id,
      metadata: {
        ...(context.conversation.metadata ?? {}),
        type: ADMIN_COPILOT_CONVERSATION_TYPE,
        lastMessageId: assistantMessageEntity.id,
        lastInteractionUserId: adminUserId,
      },
    });

    this.logger.debug(
      `Admin ${adminUserId} copilot reply persisted (conversationId=${context.conversation.id}, adminMessageId=${adminMessageEntity.id}, assistantMessageId=${assistantMessageEntity.id})`,
    );

    return {
      reply,
      functionCall,
      toolResult,
      newHistory,
      metadata: {
        model: this.getAdminModelName(),
        conversationId: context.conversation.id,
        adminMessageId: adminMessageEntity.id,
        assistantMessageId: assistantMessageEntity.id,
      },
    };
  }

  getRevenueOverview(params: RevenueOverviewInput): Promise<AdminCopilotRevenueOverviewResult> {
    return this.computeRevenueOverview(params);
  }

  async getHistory(
    adminUserId: number,
    query: AdminCopilotHistoryQueryDto,
  ): Promise<AdminCopilotHistoryResponseDto> {
    this.logger.debug(
      `Admin ${adminUserId} requesting copilot history (conversationId=${query.conversationId ?? 'auto'}, page=${query.page ?? 1}, limit=${query.limit ?? 'default'})`,
    );

    const context = await this.ensureAdminConversation(adminUserId, {
      conversationId: query.conversationId,
    });

    const limit = this.normalizeLimit(query.limit);
    const page = this.normalizePage(query.page);
    const skip = (page - 1) * limit;

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', {
        conversationId: context.conversation.id,
      })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .skip(skip)
      .take(limit);

    const [entities, total] = await qb.getManyAndCount();

    const data = entities
      .map((entity) => this.mapMessageToHistoryItem(entity))
      .filter((item): item is AdminCopilotHistoryItemDto => Boolean(item));

    this.logger.debug(
      `Loaded ${data.length} messages (page=${page}, limit=${limit}) for conversation ${context.conversation.id}`,
    );

    return {
      conversationId: context.conversation.id,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  getTopProducts(params: TopProductsInput): Promise<AdminCopilotTopProductsResult> {
    return this.computeTopProducts(params);
  }

  getStockAlerts(params: StockAlertsInput): Promise<AdminCopilotStockAlertsResult> {
    return this.computeStockAlerts(params);
  }

  private mapMessagesToGemini(messages: Message[]): GeminiChatMessage[] {
    return messages.map((message) => {
      if (message.role === MessageRole.ASSISTANT) {
        return {
          role: GeminiChatRole.MODEL,
          content: message.content ?? '',
        } satisfies GeminiChatMessage;
      }

      return {
        role: GeminiChatRole.USER,
        content: message.content ?? '',
      } satisfies GeminiChatMessage;
    });
  }

  private mapMessageToHistoryItem(message: Message): AdminCopilotHistoryItemDto | null {
    switch (message.role) {
      case MessageRole.ADMIN:
      case MessageRole.USER:
        return {
          id: message.id,
          role: AdminCopilotMessageRole.USER,
          content: message.content ?? '',
          createdAt: message.createdAt,
          metadata: message.metadata ?? null,
        };
      case MessageRole.ASSISTANT:
        return {
          id: message.id,
          role: AdminCopilotMessageRole.ASSISTANT,
          content: message.content ?? '',
          createdAt: message.createdAt,
          metadata: message.metadata ?? null,
        };
      default:
        return null;
    }
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(limit)) {
      return 20;
    }
    return Math.min(Math.max(limit, 1), 100);
  }

  private normalizePage(page?: number): number {
    if (!page || Number.isNaN(page) || page < 1) {
      return 1;
    }
    return page;
  }

  private async ensureAdminConversation(
    adminUserId: number,
    opts: { conversationId?: number } = {},
  ): Promise<{
    conversation: Conversation;
    adminParticipant: ConversationParticipant | null;
    assistantParticipant: ConversationParticipant | null;
  }> {
    let conversation: Conversation | null = null;

    if (opts.conversationId) {
      this.logger.debug(
        `Ensuring admin copilot conversation ${opts.conversationId} for admin ${adminUserId}`,
      );
      conversation = await this.conversationRepository.findOne({
        where: { id: opts.conversationId },
      });
      if (!conversation) {
        throw new NotFoundException('Admin copilot conversation not found');
      }

      const isParticipant = await this.participantRepository.exist({
        where: { conversationId: conversation.id, userId: adminUserId },
      });

      if (!isParticipant) {
        throw new ForbiddenException('You are not allowed to access this conversation');
      }
    } else {
      conversation = await this.conversationRepository
        .createQueryBuilder('conversation')
        .innerJoin(
          'conversation.participants',
          'participant',
          'participant.conversationId = conversation.id AND participant.userId = :adminUserId',
          { adminUserId },
        )
        .where("conversation.metadata ->> 'type' = :type", {
          type: ADMIN_COPILOT_CONVERSATION_TYPE,
        })
        .andWhere('conversation.deletedAt IS NULL')
        .orderBy('conversation.updatedAt', 'DESC')
        .addOrderBy('conversation.id', 'DESC')
        .getOne();
    }

    if (!conversation) {
      this.logger.debug(`Creating new admin copilot conversation for admin ${adminUserId}`);
      conversation = await this.conversationRepository.save(
        this.conversationRepository.create({
          metadata: {
            type: ADMIN_COPILOT_CONVERSATION_TYPE,
            createdForUserId: adminUserId,
          },
          lastMessageAt: null,
          lastMessageId: null,
        }),
      );
    }

    const participants = await this.participantRepository.find({
      where: { conversationId: conversation.id },
    });

    let adminParticipant =
      participants.find((participant) => participant.userId === adminUserId) ?? null;
    if (!adminParticipant) {
      this.logger.debug(
        `Adding admin participant ${adminUserId} to conversation ${conversation.id}`,
      );
      adminParticipant = await this.participantRepository.save(
        this.participantRepository.create({
          conversationId: conversation.id,
          userId: adminUserId,
          unreadCount: 0,
          settings: { role: ParticipantRole.ADMIN },
        }),
      );
    }

    let assistantParticipant =
      participants.find((participant) => participant.userId === null) ?? null;
    if (!assistantParticipant) {
      this.logger.debug(
        `Creating assistant participant for conversation ${conversation.id} (admin ${adminUserId})`,
      );
      assistantParticipant = await this.participantRepository.save(
        this.participantRepository.create({
          conversationId: conversation.id,
          userId: null,
          unreadCount: 0,
          settings: {
            role: ParticipantRole.ASSISTANT,
            name: 'FiaOps Copilot',
            model: this.getAdminModelName(),
          },
        }),
      );
    }

    if ((conversation.metadata ?? {}).type !== ADMIN_COPILOT_CONVERSATION_TYPE) {
      conversation.metadata = {
        ...(conversation.metadata ?? {}),
        type: ADMIN_COPILOT_CONVERSATION_TYPE,
        createdForUserId: adminUserId,
      };
      await this.conversationRepository.save(conversation);
      this.logger.debug(
        `Normalized conversation metadata for ${conversation.id} (admin ${adminUserId})`,
      );
    }

    return { conversation, adminParticipant, assistantParticipant };
  }

  private getAdminModelName(): string {
    return this.configService.get<string>('GEMINI_ADMIN_MODEL') ?? 'gemini-2.5-pro';
  }

  private async dispatchTool(functionCall: FunctionCall): Promise<FunctionResponsePart> {
    const { name, args } = functionCall;
    this.logger.debug(`Dispatching admin copilot tool ${name} with args ${JSON.stringify(args)}`);
    switch (name) {
      case 'get_revenue_overview':
        return this.handleRevenueOverview((args ?? {}) as Record<string, unknown>);
      case 'get_top_products':
        return this.handleTopProducts((args ?? {}) as Record<string, unknown>);
      case 'get_stock_alerts':
        return this.handleStockAlerts((args ?? {}) as Record<string, unknown>);
      default:
        this.logger.warn(`Unknown admin copilot tool: ${name}`);
        return {
          functionResponse: {
            name,
            response: { content: { error: `Tool ${name} is not supported` } },
          },
        };
    }
  }

  private async computeRevenueOverview(
    params: RevenueOverviewInput,
  ): Promise<AdminCopilotRevenueOverviewResult> {
    const { range, config } = this.resolveRangeConfig(params.range);
    const granularity = this.resolveGranularity(params.granularity, config.granularity);
    const forecastPeriods = this.parsePositiveInt(params.forecastPeriods, 1, 1, 12) ?? 1;

    const forecast = await this.trendForecastingService.getSalesForecast({
      granularity,
      lookbackMonths: config.lookbackMonths,
      forecastPeriods,
    });

    const rangeStart = this.subtractDays(new Date(), config.days);
    const filteredSeries = forecast.timeSeries.filter((point) => {
      const periodDate = new Date(point.period);
      return Number.isFinite(periodDate.getTime()) && periodDate >= rangeStart;
    });

    const totals = filteredSeries.reduce(
      (acc, point) => {
        acc.revenue += point.revenue;
        acc.orders += point.orderCount;
        acc.units += point.unitsSold;
        return acc;
      },
      { revenue: 0, orders: 0, units: 0 },
    );

    const averageOrderValue = totals.orders > 0 ? totals.revenue / totals.orders : 0;

    return {
      range,
      granularity,
      periodStart: filteredSeries[0]?.period ?? forecast.timeSeries[0]?.period ?? null,
      periodEnd:
        filteredSeries[filteredSeries.length - 1]?.period ??
        forecast.timeSeries.at(-1)?.period ??
        null,
      totalRevenue: totals.revenue,
      totalOrders: totals.orders,
      totalUnits: totals.units,
      averageOrderValue,
      forecast: forecast.forecast[0] ?? null,
      summary: forecast.summary,
    };
  }

  private async computeTopProducts(
    params: TopProductsInput,
  ): Promise<AdminCopilotTopProductsResult> {
    const { range, config } = this.resolveRangeConfig(params.range);
    const limit = this.parsePositiveInt(params.limit, 5, 1, 20) ?? 5;
    const startDate = this.subtractDays(new Date(), config.days);

    const qb = this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .leftJoin('item.variant', 'variant')
      .leftJoin('variant.product', 'product')
      .select('product.id', 'productId')
      .addSelect('product.name', 'name')
      .addSelect('SUM(item.totalAmount)', 'revenue')
      .addSelect('SUM(item.quantity)', 'unitsSold')
      .where('order.createdAt >= :startDate', { startDate: startDate.toISOString() })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [
          OrderStatus.CONFIRMED,
          OrderStatus.PROCESSING,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
        ],
      })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .orderBy('revenue', 'DESC')
      .limit(limit);

    const rows = await qb.getRawMany<{
      productId: number;
      name: string;
      revenue: string;
      unitsSold: string;
    }>();
    const totalRevenue = rows.reduce((acc, row) => acc + Number(row.revenue ?? 0), 0);

    const products: TopProductRow[] = rows.map((row) => ({
      productId: Number(row.productId),
      name: row.name,
      revenue: Number(row.revenue ?? 0),
      unitsSold: Number(row.unitsSold ?? 0),
      revenueShare: totalRevenue ? Number(row.revenue ?? 0) / totalRevenue : 0,
    }));

    return {
      range,
      products,
    };
  }

  private async computeStockAlerts(
    params: StockAlertsInput,
  ): Promise<AdminCopilotStockAlertsResult> {
    const threshold = this.parsePositiveInt(params.threshold, 20, 0, 1000) ?? 20;
    const branchId = this.parsePositiveInt(params.branchId, undefined, 1);
    const limit = this.parsePositiveInt(params.limit, 10, 1, 50) ?? 10;

    const qb = this.inventoryRepository
      .createQueryBuilder('inventory')
      .innerJoin('inventory.variant', 'variant')
      .leftJoin('variant.product', 'product')
      .leftJoin('inventory.branch', 'branch')
      .select('inventory.id', 'inventoryId')
      .addSelect('variant.id', 'variantId')
      .addSelect('product.id', 'productId')
      .addSelect('product.name', 'productName')
      .addSelect('inventory.stock', 'stock')
      .addSelect('branch.id', 'branchId')
      .addSelect('branch.name', 'branchName')
      .where('inventory.stock <= :threshold', { threshold })
      .orderBy('inventory.stock', 'ASC')
      .limit(limit);

    if (branchId) {
      qb.andWhere('inventory.branchId = :branchId', { branchId });
    }

    const rows = await qb.getRawMany<{
      inventoryId: number;
      variantId: number;
      productId: number;
      productName: string;
      stock: string;
      branchId: number | null;
      branchName: string | null;
    }>();

    const alerts: StockAlertRow[] = rows.map((row) => ({
      inventoryId: Number(row.inventoryId),
      variantId: Number(row.variantId),
      productId: Number(row.productId),
      productName: row.productName,
      stock: Number(row.stock ?? 0),
      branchId: row.branchId ? Number(row.branchId) : null,
      branchName: row.branchName ?? null,
    }));

    return {
      threshold,
      alerts,
    };
  }

  private resolveRangeConfig(source?: unknown): { range: RangeKey; config: RangeConfig } {
    if (typeof source === 'string') {
      const match = RANGE_CONFIGS.find((item) => item.range === source);
      if (match) {
        return { range: match.range, config: match };
      }
    }
    const fallback = RANGE_CONFIGS[1];
    return { range: fallback.range, config: fallback };
  }

  private resolveGranularity(source: unknown, fallback: TrendGranularity): TrendGranularity {
    if (typeof source === 'string') {
      const normalized = source as TrendGranularity;
      if (['day', 'week', 'month'].includes(normalized)) {
        return normalized;
      }
    }
    return fallback;
  }

  private async handleRevenueOverview(
    rawArgs: Record<string, unknown>,
  ): Promise<FunctionResponsePart> {
    this.logger.debug(`Handling revenue overview tool with payload ${JSON.stringify(rawArgs)}`);
    const payload = await this.computeRevenueOverview({
      range: typeof rawArgs.range === 'string' ? (rawArgs.range as RangeKey) : undefined,
      granularity:
        typeof rawArgs.granularity === 'string'
          ? (rawArgs.granularity as TrendGranularity)
          : undefined,
      forecastPeriods: this.parsePositiveInt(rawArgs.forecastPeriods, undefined, 1, 12),
    });

    return {
      functionResponse: {
        name: 'get_revenue_overview',
        response: { content: payload },
      },
    };
  }

  private async handleTopProducts(rawArgs: Record<string, unknown>): Promise<FunctionResponsePart> {
    this.logger.debug(`Handling top products tool with payload ${JSON.stringify(rawArgs)}`);
    const payload = await this.computeTopProducts({
      range: typeof rawArgs.range === 'string' ? (rawArgs.range as RangeKey) : undefined,
      limit: this.parsePositiveInt(rawArgs.limit, undefined, 1, 20),
    });

    return {
      functionResponse: {
        name: 'get_top_products',
        response: {
          content: payload,
        },
      },
    };
  }

  private async handleStockAlerts(rawArgs: Record<string, unknown>): Promise<FunctionResponsePart> {
    this.logger.debug(`Handling stock alerts tool with payload ${JSON.stringify(rawArgs)}`);
    const payload = await this.computeStockAlerts({
      threshold: this.parsePositiveInt(rawArgs.threshold, undefined, 0, 1000),
      branchId: this.parsePositiveInt(rawArgs.branchId, undefined, 1),
      limit: this.parsePositiveInt(rawArgs.limit, undefined, 1, 50),
    });

    return {
      functionResponse: {
        name: 'get_stock_alerts',
        response: {
          content: payload,
        },
      },
    };
  }

  private parsePositiveInt(
    value: unknown,
    fallback: number | undefined,
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
  ): number | undefined {
    if (value === undefined || value === null) {
      return fallback;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return fallback;
    }
    const clamped = Math.max(min, Math.min(max, Math.floor(num)));
    return clamped;
  }

  private subtractDays(date: Date, days: number): Date {
    const clone = new Date(date.getTime());
    clone.setDate(clone.getDate() - days);
    return clone;
  }
}
