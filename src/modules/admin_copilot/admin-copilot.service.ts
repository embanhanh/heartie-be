import { FunctionCall, FunctionResponsePart } from '@google/generative-ai';
import { BadRequestException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { AppException } from '../../common/errors/app.exception';
import {
  normalizeFormat,
  normalizeLanguageInput,
  normalizeScheduleIso,
  normalizeString,
  normalizeStringArray,
  parsePositiveInt,
  subtractDays,
} from '../../common/utils/data-normalization.util';
import { AdsAiService } from '../ads_ai/ads_ai.service';
import { CreateAdsAiDto } from '../ads_ai/dto/create-ads-ai.dto';
import { GenerateAdsAiDto } from '../ads_ai/dto/generate-ads-ai.dto';
import { ScheduleAdsAiDto } from '../ads_ai/dto/schedule-ads-ai.dto';
import { AdsAiCampaign, AdsAiStatus } from '../ads_ai/entities/ads-ai-campaign.entity';
import { AdsAiQueryDto } from '../ads_ai/dto/ads-ai-query.dto';
import { GeneratedAdContent } from '../ads_ai/interfaces/generated-ad-content.interface';
import { ConversationParticipant } from '../conversation_participants/entities/conversation_participant.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ParticipantRole } from '../conversations/enums/conversation.enums';
import { GeminiChatMessage, GeminiChatRole, GeminiService } from '../gemini/gemini.service';
import { ProductVariantInventory } from '../inventory/entities/product-variant-inventory.entity';
import { Message } from '../messages/entities/message.entity';
import { MessageRole } from '../messages/enums/message.enums';
import { OrderItem } from '../order_items/entities/order-item.entity';
import { TrendGranularity } from '../trend_forecasting/dto/trend-forecast-query.dto';
import { TrendForecastingService } from '../trend_forecasting/trend-forecasting.service';
import { StatsService } from '../stats/stats.service';
import { User } from '../users/entities/user.entity';
import {
  ADMIN_COPILOT_DEFAULT_RANGE,
  ADMIN_COPILOT_FULFILLED_ORDER_STATUSES,
  ADMIN_COPILOT_RANGE_OPTIONS,
} from './constants/admin-copilot.constants';
import { ADMIN_COPILOT_TOOLS } from './constants/admin-copilot.tools';
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
import {
  AdminCopilotPostCampaignInput,
  AdminCopilotRevenueOverviewInput,
  AdminCopilotStockAlertsInput,
  AdminCopilotTopProductsInput,
} from './types/admin-copilot-tool-inputs';
import {
  AdminCopilotAdminContext,
  AdminCopilotPostBrief,
  AdminCopilotPostCampaignNormalizedInput,
  AdminCopilotPostCampaignResult,
  AdminCopilotPostDraft,
  AdminCopilotPostSchedule,
  AdminCopilotPostStrategy,
  AdminCopilotRangeConfig,
  AdminCopilotRangeKey,
  AdminCopilotRevenueOverviewResult,
  AdminCopilotStockAlertRow,
  AdminCopilotStockAlertsResult,
  AdminCopilotTopProductRow,
  AdminCopilotTopProductsResult,
} from './types/admin-copilot.types';

const ADMIN_COPILOT_CONVERSATION_TYPE = 'ADMIN_COPILOT';
const ADMIN_COPILOT_HISTORY_LIMIT = 40;

const RANGE_CONFIGS: AdminCopilotRangeConfig[] = [
  { range: '7d', days: 7, lookbackMonths: 1, granularity: 'day' },
  { range: '30d', days: 30, lookbackMonths: 3, granularity: 'week' },
  { range: '90d', days: 90, lookbackMonths: 6, granularity: 'month' },
];

interface AdminCopilotRequestContextOptions {
  requestMeta?: Record<string, unknown>;
}

@Injectable()
export class AdminCopilotService {
  private readonly logger = new Logger(AdminCopilotService.name);

  constructor(
    private readonly adsAiService: AdsAiService,
    private readonly geminiService: GeminiService,
    private readonly trendForecastingService: TrendForecastingService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
    private readonly statsService: StatsService,
  ) {}

  async chat(
    request: AdminCopilotChatRequestDto,
    adminUserId: number,
    options: { lang?: string } = {},
  ): Promise<AdminCopilotResponseDto> {
    const trimmedMessage = request.message?.trim();
    if (!trimmedMessage) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        code: 'ADMIN_COPILOT_MESSAGE_EMPTY',
        translationKey: 'errors.adminCopilot.messageEmpty',
      });
    }

    const lang = options.lang ?? this.getRequestLanguage();
    const adminContext = await this.resolveAdminContext(adminUserId);
    const systemPrompt = await this.buildSystemPrompt(adminContext, lang);
    const tools = ADMIN_COPILOT_TOOLS;
    const requestMeta = request.metadata ?? undefined;

    let geminiMessage = trimmedMessage;

    // HANDLE META
    if (requestMeta && Object.keys(requestMeta).length > 0) {
      const metaStr = JSON.stringify(requestMeta);
      this.logger.debug(
        `Admin copilot request meta: ${metaStr.length > 500 ? `${metaStr.slice(0, 500)}... (total ${metaStr.length})` : metaStr}`,
      );

      // Protect against extremely large metadata that could clog context
      if (metaStr.length > 10000) {
        this.logger.warn(
          `Lớn hơn 10k bytes metadata phát hiện (size=${metaStr.length}). Chỉ gửi phím chính.`,
        );
        const keys = Object.keys(requestMeta).join(', ');
        geminiMessage += `\n[Metadata Keys]: ${keys} (Data too large to include full JSON)`;
      } else {
        geminiMessage += `\n[Metadata Context]: ${metaStr}`;
      }
    }

    const requestContext: AdminCopilotRequestContextOptions = {
      requestMeta,
    };

    this.logger.debug(
      `Admin ${adminUserId} (${adminContext.isGlobalAdmin ? 'global' : `branch ${adminContext.branchId}`}) is sending copilot chat message` +
        ` (conversationId=${request.conversationId ?? 'auto'}
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
      order: { createdAt: 'DESC', id: 'DESC' },
      take: ADMIN_COPILOT_HISTORY_LIMIT,
    });

    const historyMessages = this.mapMessagesToGemini(historyEntities.reverse());

    // const adminMessageMetadata = this.buildAdminMessageMetadata(requestMeta, attachments);

    const adminMessageEntity = this.messageRepository.create({
      conversationId: context.conversation.id,
      senderParticipantId: context.adminParticipant?.id ?? null,
      role: MessageRole.ADMIN,
      content: trimmedMessage,
      metadata: requestMeta,
    });
    await this.messageRepository.save(adminMessageEntity);

    const newHistory: AdminCopilotHistoryMessageDto[] = [
      {
        role: AdminCopilotMessageRole.USER,
        content: trimmedMessage,
        metadata: requestMeta,
      },
    ];

    this.logger.debug(`call with system prompt: ${systemPrompt}`);

    let firstCall:
      | {
          text: string | null;
          functionCall: FunctionCall | null;
        }
      | null
      | undefined;
    try {
      firstCall = await this.geminiService.generateContent(geminiMessage, historyMessages, {
        systemPrompt,
        temperature: 0.1,
        tools,
        model: this.getAdminModelName(),
        maxOutputTokens: 4096,
      });
    } catch (error) {
      // Chuẩn hoá lỗi Gemini "không trả về nội dung" thành lỗi nghiệp vụ dễ hiểu cho admin
      if (error instanceof BadRequestException) {
        this.logger.warn(
          `Gemini did not return any content for admin ${adminUserId} (conversationId=${context.conversation.id})`,
        );
        throw new AppException({
          status: HttpStatus.BAD_REQUEST,
          code: 'ADMIN_COPILOT_NO_ANSWER',
          translationKey: 'errors.adminCopilot.geminiNoAnswer',
          cause: error,
        });
      }
      throw error;
    }

    if (firstCall?.functionCall) {
      this.logger.debug(
        `Gemini requested function call ${firstCall.functionCall.name} for conversation ${context.conversation.id}`,
      );
    }

    if (!firstCall?.text) {
      this.logger.debug(
        `Gemini returned empty text on first call for conversation ${context.conversation.id}`,
      );
    }

    let reply = firstCall?.text ?? '';
    let functionCall: AdminCopilotResponseDto['functionCall'] = null;
    let toolResult: Record<string, unknown> | null = null;

    if (firstCall?.functionCall) {
      const toolExecution = await this.dispatchTool(
        firstCall.functionCall,
        adminContext,
        lang,
        requestContext,
      );
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

      try {
        const second = await this.geminiService.generateContentWithFunctionResponse(
          tempHistory,
          toolExecution,
          {
            systemPrompt,
            temperature: 0.1,
            tools,
            model: this.getAdminModelName(),
            maxOutputTokens: 4096,
          },
        );
        reply = second.text ?? '';
      } catch (error) {
        this.logger.warn(
          `Gemini second call failed for conversation ${context.conversation.id}: ${error}`,
        );
        // Fallback message if Gemini fails to generate summary after tool execution
        reply =
          (await this.translateString(
            'admin-copilot.messages.toolSuccessFallback',
            lang,
            {},
            'Yêu cầu của bạn đã được xử lý thành công.',
          )) || 'Yêu cầu của bạn đã được xử lý thành công.';
      }

      if (!reply) {
        this.logger.warn(
          `Gemini returned empty response after tool execution for conversation ${context.conversation.id}`,
        );
      }
    } else if (!reply) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        code: 'ADMIN_COPILOT_NO_ANSWER',
        translationKey: 'errors.adminCopilot.geminiNoAnswer',
      });
    }

    const assistantHistoryEntry: AdminCopilotHistoryMessageDto = {
      role: AdminCopilotMessageRole.ASSISTANT,
      content: reply,
      metadata: undefined,
    };
    newHistory.push(assistantHistoryEntry);

    const assistantMetadata: Record<string, unknown> = {
      provider: 'gemini',
      model: this.getAdminModelName(),
      language: lang,
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

    assistantHistoryEntry.metadata = assistantMetadata;

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

  async getRevenueOverview(
    adminUserId: number,
    params: AdminCopilotRevenueOverviewInput,
  ): Promise<AdminCopilotRevenueOverviewResult> {
    const context = await this.resolveAdminContext(adminUserId);
    const branchSuffix = context.branchId ? ` branchId=${context.branchId}` : '';
    this.logger.debug(
      `Admin ${adminUserId} fetching revenue overview (range=${params.range ?? 'default'}, granularity=${params.granularity ?? 'default'})${branchSuffix}`,
    );
    return this.computeRevenueOverview(params, context);
  }

  async clearHistory(adminUserId: number, conversationId: number): Promise<void> {
    this.logger.debug(
      `Admin ${adminUserId} requesting to clear history for conversation ${conversationId}`,
    );

    const context = await this.ensureAdminConversation(adminUserId, {
      conversationId: conversationId,
    });

    await this.messageRepository.delete({ conversationId: context.conversation.id });

    context.conversation.lastMessageAt = null;
    context.conversation.lastMessageId = null;

    // Update metadata
    const metadata = context.conversation.metadata || {};
    context.conversation.metadata = {
      ...metadata,
      lastMessageId: null,
      lastInteractionUserId: adminUserId,
    };

    await this.conversationRepository.save(context.conversation);

    this.logger.log(
      `Cleared message history for conversation ${conversationId} (admin ${adminUserId})`,
    );
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

  async getTopProducts(
    adminUserId: number,
    params: AdminCopilotTopProductsInput,
  ): Promise<AdminCopilotTopProductsResult> {
    const context = await this.resolveAdminContext(adminUserId);
    const branchSuffix = context.branchId ? ` branchId=${context.branchId}` : '';
    this.logger.debug(
      `Admin ${adminUserId} fetching top products (range=${params.range ?? 'default'}, limit=${params.limit ?? 'default'})${branchSuffix}`,
    );
    return this.computeTopProducts(params, context);
  }

  async getStockAlerts(
    adminUserId: number,
    params: AdminCopilotStockAlertsInput,
  ): Promise<AdminCopilotStockAlertsResult> {
    const context = await this.resolveAdminContext(adminUserId);
    const branchSuffix = context.branchId
      ? ` branchId=${context.branchId}`
      : params.branchId
        ? ` branchId=${params.branchId}`
        : '';
    this.logger.debug(
      `Admin ${adminUserId} fetching stock alerts (threshold=${params.threshold ?? 'default'}, limit=${params.limit ?? 'default'})${branchSuffix}`,
    );
    return this.computeStockAlerts(params, context);
  }

  public async resolveAdminContext(adminUserId: number): Promise<AdminCopilotAdminContext> {
    const user = await this.userRepository.findOne({
      where: { id: adminUserId },
      relations: { branch: true },
    });

    if (!user) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        code: 'ADMIN_COPILOT_ADMIN_NOT_FOUND',
        translationKey: 'errors.adminCopilot.adminNotFound',
      });
    }

    const branchId = user.branchId ?? null;

    this.logger.debug(
      `Admin context resolved for ${adminUserId} (role=${user.role}, branchId=${branchId ?? 'all'})`,
    );

    return {
      adminUserId,
      role: user.role,
      branchId,
      branchName: user.branch?.name ?? null,
      isGlobalAdmin: branchId === null,
    };
  }

  private async buildSystemPrompt(
    context: AdminCopilotAdminContext,
    lang: string,
  ): Promise<string> {
    const base = (await this.translateString('admin-copilot.prompts.system.base', lang)).trim();
    const scopeHeading = await this.translateString(
      'admin-copilot.prompts.system.scopeHeading',
      lang,
    );
    const scopeLines = await this.translateStringArray(
      `admin-copilot.prompts.system.scopes.${context.isGlobalAdmin ? 'global' : 'branch'}`,
      lang,
      context.isGlobalAdmin
        ? undefined
        : {
            branchLabel: this.getBranchLabel(context),
          },
    );
    const footer = await this.translateString('admin-copilot.prompts.system.footer', lang);
    const languageDirective = await this.translateString(
      'admin-copilot.prompts.system.languageDirective',
      lang,
      {
        languageName: this.getLanguageDisplayName(lang),
      },
    );

    const segments = [base, '', scopeHeading, ...scopeLines, footer, languageDirective].filter(
      (segment): segment is string => typeof segment === 'string',
    );

    return segments
      .filter((segment, index) => segment !== '' || segments[index - 1] !== '')
      .join('\n')
      .trim();
  }

  private getRequestLanguage(): string {
    const lang = I18nContext.current()?.lang;
    if (lang && typeof lang === 'string') {
      return lang;
    }
    return 'vi';
  }

  private getLanguageDisplayName(lang: string): string {
    const normalized = lang.toLowerCase();
    if (normalized.startsWith('vi')) {
      return 'Tiếng Việt';
    }
    if (normalized.startsWith('en')) {
      return 'English';
    }
    return 'English';
  }

  private getBranchLabel(context: AdminCopilotAdminContext): string {
    if (context.branchName) {
      return context.branchName;
    }
    if (context.branchId) {
      return `#${context.branchId}`;
    }
    return 'N/A';
  }

  private async translateString(
    key: string,
    lang: string,
    args?: Record<string, unknown>,
    fallback = '',
  ): Promise<string> {
    const value = await this.i18n.translate(key, { lang, args });
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.join('\n');
    }
    if (value === null || value === undefined) {
      return fallback;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  private async translateStringArray(
    key: string,
    lang: string,
    args?: Record<string, unknown>,
  ): Promise<string[]> {
    const value = await this.i18n.translate(key, { lang, args });
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    if (typeof value === 'string') {
      return value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
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
        throw new AppException({
          status: HttpStatus.NOT_FOUND,
          code: 'ADMIN_COPILOT_CONVERSATION_NOT_FOUND',
          translationKey: 'errors.adminCopilot.conversationNotFound',
        });
      }

      const isParticipant = await this.participantRepository.exist({
        where: { conversationId: conversation.id, userId: adminUserId },
      });

      if (!isParticipant) {
        throw new AppException({
          status: HttpStatus.FORBIDDEN,
          code: 'ADMIN_COPILOT_CONVERSATION_FORBIDDEN',
          translationKey: 'errors.adminCopilot.conversationAccessDenied',
        });
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

  private async dispatchTool(
    functionCall: FunctionCall,
    context: AdminCopilotAdminContext,
    lang: string,
    options: AdminCopilotRequestContextOptions = {},
  ): Promise<FunctionResponsePart> {
    const { name, args } = functionCall;
    this.logger.debug(
      `Dispatching admin copilot tool ${name} with args ${JSON.stringify(args)} (scope=${context.isGlobalAdmin ? 'global' : `branch ${context.branchId}`})`,
    );
    switch (name) {
      case 'get_revenue_overview':
        return this.handleRevenueOverview((args ?? {}) as Record<string, unknown>, context);
      case 'get_top_products':
        return this.handleTopProducts((args ?? {}) as Record<string, unknown>, context);
      case 'get_stock_alerts':
        return this.handleStockAlerts((args ?? {}) as Record<string, unknown>, context);
      case 'generate_post_campaign':
        return this.handlePostCampaign(
          (args ?? {}) as Record<string, unknown>,
          context,
          lang,
          options,
        );
      case 'finalize_post_campaign':
        return this.handleFinalizePostCampaign(
          (args ?? {}) as Record<string, unknown>,
          context,
          lang,
          options,
        );
      case 'schedule_post_campaign':
        return this.handleSchedulePostCampaign(
          (args ?? {}) as Record<string, unknown>,
          context,
          lang,
        );
      case 'get_ads_performance':
        return this.handleAdsPerformance((args ?? {}) as Record<string, unknown>, context);
      case 'get_ad_details':
        return this.handleAdDetails((args ?? {}) as Record<string, unknown>, context);
      default: {
        this.logger.warn(`Unknown admin copilot tool: ${name}`);
        const errorMessage =
          (await this.translateString(
            'errors.adminCopilot.toolUnsupported',
            lang,
            { toolName: name },
            `Tool ${name} is not supported`,
          )) || `Tool ${name} is not supported`;
        return {
          functionResponse: {
            name,
            response: {
              content: {
                error: errorMessage,
                code: 'ADMIN_COPILOT_TOOL_UNSUPPORTED',
              },
            },
          },
        };
      }
    }
  }

  private async computeRevenueOverview(
    params: AdminCopilotRevenueOverviewInput,
    context: AdminCopilotAdminContext,
  ): Promise<AdminCopilotRevenueOverviewResult> {
    const { range, config } = this.resolveRangeConfig(params.range);
    const granularity = this.resolveGranularity(params.granularity, config.granularity);
    const forecastPeriods = parsePositiveInt(params.forecastPeriods, 1, 1, 12) ?? 1;

    // 1. Resolve exact date range for StatsService (matching Dashboard logic)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setHours(23, 59, 59, 999);

    const periodStart = subtractDays(now, config.days - 1);
    periodStart.setHours(0, 0, 0, 0);

    // 2. Fetch standard aggregates from StatsService (The source of truth for Dashboard)
    const statsOverview = await this.statsService.getOverview({
      from: periodStart,
      to: periodEnd,
      branchId: context.branchId ?? undefined,
    });

    // 3. Fetch Trend Forecasting results (for narrative and expected forecast point)
    const forecast = await this.trendForecastingService.getSalesForecast({
      granularity,
      lookbackMonths: config.lookbackMonths,
      forecastPeriods,
      branchId: context.branchId ?? undefined,
    });

    this.logger.debug(
      `Revenue overview computed via StatsService (range=${range}, days=${config.days}, revenue=${statsOverview.revenue.value}, scope=${context.isGlobalAdmin ? 'global' : `branch ${context.branchId}`})`,
    );

    return {
      range,
      granularity,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalRevenue: statsOverview.revenue.value,
      totalOrders: statsOverview.orders.value,
      totalUnits: 0, // StatsOverview (getOverview) doesn't provide unitsSold total directly, but we can usually omit if 0
      averageOrderValue:
        statsOverview.orders.value > 0
          ? statsOverview.revenue.value / statsOverview.orders.value
          : 0,
      forecast: forecast.forecast[0] ?? null,
      summary: forecast.summary,
    };
  }

  private async computeTopProducts(
    params: AdminCopilotTopProductsInput,
    context: AdminCopilotAdminContext,
  ): Promise<AdminCopilotTopProductsResult> {
    const { range, config } = this.resolveRangeConfig(params.range);
    const limit = parsePositiveInt(params.limit, 5, 1, 20) ?? 5;
    const startDate = subtractDays(new Date(), config.days);

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
        statuses: ADMIN_COPILOT_FULFILLED_ORDER_STATUSES,
      })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .orderBy('revenue', 'DESC')
      .limit(limit);

    if (context.branchId) {
      qb.andWhere('order.branchId = :branchId', { branchId: context.branchId });
    }

    const rows = await qb.getRawMany<{
      productId: number;
      name: string;
      revenue: string;
      unitsSold: string;
    }>();
    const totalRevenue = rows.reduce((acc, row) => acc + Number(row.revenue ?? 0), 0);

    const products: AdminCopilotTopProductRow[] = rows.map((row) => ({
      productId: Number(row.productId),
      name: row.name,
      revenue: Number(row.revenue ?? 0),
      unitsSold: Number(row.unitsSold ?? 0),
      revenueShare: totalRevenue ? Number(row.revenue ?? 0) / totalRevenue : 0,
    }));

    this.logger.debug(
      `Top products computed (range=${range}, items=${products.length}, scope=${context.isGlobalAdmin ? 'global' : `branch ${context.branchId}`})`,
    );

    return {
      range,
      products,
    };
  }

  private async computeStockAlerts(
    params: AdminCopilotStockAlertsInput,
    context: AdminCopilotAdminContext,
  ): Promise<AdminCopilotStockAlertsResult> {
    const threshold = parsePositiveInt(params.threshold, 20, 0, 1000) ?? 20;
    const limit = parsePositiveInt(params.limit, 10, 1, 50) ?? 10;

    const requestedBranchId = parsePositiveInt(params.branchId, undefined, 1);
    const effectiveBranchId = context.branchId ?? requestedBranchId ?? undefined;

    if (context.branchId && requestedBranchId && requestedBranchId !== context.branchId) {
      this.logger.warn(
        `Branch admin ${context.adminUserId} attempted to access stock alerts for branch ${requestedBranchId}; enforced branch ${context.branchId}`,
      );
    }

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

    if (effectiveBranchId) {
      qb.andWhere('inventory.branchId = :branchId', { branchId: effectiveBranchId });
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

    const alerts: AdminCopilotStockAlertRow[] = rows.map((row) => ({
      inventoryId: Number(row.inventoryId),
      variantId: Number(row.variantId),
      productId: Number(row.productId),
      productName: row.productName,
      stock: Number(row.stock ?? 0),
      branchId: row.branchId ? Number(row.branchId) : null,
      branchName: row.branchName ?? null,
    }));

    this.logger.debug(
      `Stock alerts computed (threshold=${threshold}, alerts=${alerts.length}, scope=${context.isGlobalAdmin ? 'global' : `branch ${context.branchId}`})`,
    );

    return {
      threshold,
      alerts,
    };
  }

  private normalizeRangeKey(value: unknown): AdminCopilotRangeKey | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const options = ADMIN_COPILOT_RANGE_OPTIONS as readonly AdminCopilotRangeKey[];
    return options.includes(value as AdminCopilotRangeKey)
      ? (value as AdminCopilotRangeKey)
      : undefined;
  }

  private resolveRangeConfig(source?: unknown): {
    range: AdminCopilotRangeKey;
    config: AdminCopilotRangeConfig;
  } {
    const fallbackRange =
      this.normalizeRangeKey(ADMIN_COPILOT_DEFAULT_RANGE) ?? ('30d' as AdminCopilotRangeKey);
    const normalized = this.normalizeRangeKey(source) ?? fallbackRange;
    const config =
      RANGE_CONFIGS.find((item) => item.range === normalized) ??
      RANGE_CONFIGS.find((item) => item.range === fallbackRange) ??
      RANGE_CONFIGS[0];

    return { range: config.range, config };
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
    context: AdminCopilotAdminContext,
  ): Promise<FunctionResponsePart> {
    this.logger.debug(
      `Handling revenue overview tool with payload ${JSON.stringify(rawArgs)} (scope=${context.isGlobalAdmin ? 'global' : `branch ${context.branchId}`})`,
    );
    const payload = await this.computeRevenueOverview(
      {
        range: this.normalizeRangeKey(rawArgs.range),
        granularity: this.normalizeGranularity(rawArgs.granularity),
        forecastPeriods: parsePositiveInt(rawArgs.forecastPeriods, undefined, 1, 12),
      },
      context,
    );

    return {
      functionResponse: {
        name: 'get_revenue_overview',
        response: { content: payload },
      },
    };
  }

  private async handleTopProducts(
    rawArgs: Record<string, unknown>,
    context: AdminCopilotAdminContext,
  ): Promise<FunctionResponsePart> {
    this.logger.debug(
      `Handling top products tool with payload ${JSON.stringify(rawArgs)} (scope=${context.isGlobalAdmin ? 'global' : `branch ${context.branchId}`})`,
    );
    const payload = await this.computeTopProducts(
      {
        range: this.normalizeRangeKey(rawArgs.range),
        limit: parsePositiveInt(rawArgs.limit, undefined, 1, 20),
      },
      context,
    );

    return {
      functionResponse: {
        name: 'get_top_products',
        response: {
          content: payload,
        },
      },
    };
  }

  private async handleStockAlerts(
    rawArgs: Record<string, unknown>,
    context: AdminCopilotAdminContext,
  ): Promise<FunctionResponsePart> {
    this.logger.debug(
      `Handling stock alerts tool with payload ${JSON.stringify(rawArgs)} (scope=${context.isGlobalAdmin ? 'global' : `branch ${context.branchId}`})`,
    );
    const payload = await this.computeStockAlerts(
      {
        threshold: parsePositiveInt(rawArgs.threshold, undefined, 0, 1000),
        branchId: parsePositiveInt(rawArgs.branchId, undefined, 1),
        limit: parsePositiveInt(rawArgs.limit, undefined, 1, 50),
      },
      context,
    );

    return {
      functionResponse: {
        name: 'get_stock_alerts',
        response: {
          content: payload,
        },
      },
    };
  }

  private async handlePostCampaign(
    rawArgs: Record<string, unknown>,
    context: AdminCopilotAdminContext,
    requestLang: string,
    options: AdminCopilotRequestContextOptions = {},
  ): Promise<FunctionResponsePart> {
    this.logger.debug(
      `Handling post campaign tool with payload ${JSON.stringify(rawArgs)} (scope=${context.isGlobalAdmin ? 'global' : `branch ${context.branchId}`})`,
    );

    try {
      const normalized = this.normalizePostCampaignInput(rawArgs, requestLang, options);
      const posts = await this.generatePostCampaignDraftsWithAdsAi(normalized, context);
      const strategy = this.buildPostCampaignStrategyFromAdsAi(posts, normalized, context);
      const payload = this.normalizePostCampaignResult(
        {
          brief: normalized.brief,
          strategy,
          posts,
        },
        normalized,
      );

      return {
        functionResponse: {
          name: 'generate_post_campaign',
          response: {
            content: payload,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate post campaign content for admin ${context.adminUserId}`,
        error instanceof Error ? error.stack : String(error),
      );

      const fallbackMessage =
        (await this.translateString(
          'admin-copilot.messages.errors.postPlanFailed',
          requestLang,
          {},
          'Không thể tạo kế hoạch nội dung, vui lòng thử lại sau.',
        )) || 'Không thể tạo kế hoạch nội dung, vui lòng thử lại sau.';

      return {
        functionResponse: {
          name: 'generate_post_campaign',
          response: {
            content: {
              error: fallbackMessage,
            },
          },
        },
      };
    }
  }

  private async handleFinalizePostCampaign(
    rawArgs: Record<string, unknown>,
    context: AdminCopilotAdminContext,
    requestLang: string,
    options: AdminCopilotRequestContextOptions = {},
  ): Promise<FunctionResponsePart> {
    this.logger.debug(
      `Handling finalize post campaign tool with payload ${JSON.stringify(rawArgs)} (scope=${context.isGlobalAdmin ? 'global' : `branch ${context.branchId}`})`,
    );

    try {
      const campaignPayload = this.extractFinalizeCampaignInput(rawArgs);
      const dto = await this.buildAdsAiCreateDto(campaignPayload, context, options);
      const campaign = await this.adsAiService.createFromForm(dto);
      const payload = {
        advertisement: this.buildAdsAiCampaignResponse(campaign),
      };

      return {
        functionResponse: {
          name: 'finalize_post_campaign',
          response: { content: payload },
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to finalize post campaign for admin ${context.adminUserId}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      const fallback =
        (await this.translateString(
          'admin-copilot.messages.errors.postFinalizeFailed',
          requestLang,
          {},
          'Không thể lưu bài viết, vui lòng thử lại sau.',
        )) || 'Không thể lưu bài viết, vui lòng thử lại sau.';

      return {
        functionResponse: {
          name: 'finalize_post_campaign',
          response: {
            content: {
              error: fallback,
            },
          },
        },
      };
    }
  }

  private async handleSchedulePostCampaign(
    rawArgs: Record<string, unknown>,
    context: AdminCopilotAdminContext,
    requestLang: string,
  ): Promise<FunctionResponsePart> {
    this.logger.debug(
      `Handling schedule post campaign tool with payload ${JSON.stringify(rawArgs)} (scope=${context.isGlobalAdmin ? 'global' : `branch ${context.branchId}`})`,
    );

    try {
      const advertisementId =
        parsePositiveInt(rawArgs.advertisementId, undefined, 1) ??
        parsePositiveInt(rawArgs.campaignId, undefined, 1) ??
        parsePositiveInt(rawArgs.id, undefined, 1);

      if (!advertisementId) {
        throw new Error('Thiếu advertisementId để lên lịch.');
      }

      const confirmReschedule = Boolean(rawArgs.confirmReschedule);

      // Check current status
      const existingAd = await this.adsAiService.findOne(advertisementId);
      if (!existingAd) {
        throw new Error(`Không tìm thấy chiến dịch #${advertisementId}`);
      }

      if (
        (existingAd.status === AdsAiStatus.SCHEDULED ||
          existingAd.status === AdsAiStatus.PUBLISHED) &&
        !confirmReschedule
      ) {
        return {
          functionResponse: {
            name: 'schedule_post_campaign',
            response: {
              content: {
                confirmationRequired: true,
                message: `Chiến dịch #${advertisementId} đang ở trạng thái ${existingAd.status}. Bạn có chắc chắn muốn đặt lại lịch không?`,
                currentStatus: existingAd.status,
                scheduledAt: existingAd.scheduledAt,
              },
            },
          },
        };
      }

      const scheduledAtInput =
        normalizeScheduleIso(rawArgs.scheduledAt) ?? normalizeScheduleIso(rawArgs.schedule);

      if (!scheduledAtInput) {
        throw new Error('Thiếu scheduledAt hợp lệ.');
      }

      const dto = plainToInstance(
        ScheduleAdsAiDto,
        { scheduledAt: scheduledAtInput },
        { enableImplicitConversion: true, exposeDefaultValues: true },
      );

      const errors = await validate(dto, {
        whitelist: true,
        forbidUnknownValues: false,
      });

      if (errors.length) {
        throw new Error(this.buildValidationErrorMessage(errors));
      }

      const scheduled = await this.adsAiService.schedule(advertisementId, dto);
      const payload = {
        advertisement: this.buildAdsAiCampaignResponse(scheduled),
      };

      return {
        functionResponse: {
          name: 'schedule_post_campaign',
          response: { content: payload },
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to schedule post campaign for admin ${context.adminUserId}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      const fallback =
        (await this.translateString(
          'admin-copilot.messages.errors.postScheduleFailed',
          requestLang,
          {},
          'Không thể lên lịch đăng bài, vui lòng thử lại sau.',
        )) || 'Không thể lên lịch đăng bài, vui lòng thử lại sau.';

      return {
        functionResponse: {
          name: 'schedule_post_campaign',
          response: {
            content: {
              error: fallback,
            },
          },
        },
      };
    }
  }

  private async handleAdsPerformance(
    rawArgs: Record<string, unknown>,
    context: AdminCopilotAdminContext,
  ): Promise<FunctionResponsePart> {
    this.logger.debug(
      `Handling ads performance tool with payload ${JSON.stringify(rawArgs)} (scope=${context.isGlobalAdmin ? 'global' : `branch ${context.branchId}`})`,
    );
    const limit = parsePositiveInt(rawArgs.limit, 5, 1, 20) ?? 5;
    const search = normalizeString(rawArgs.search);
    const statusStr = normalizeString(rawArgs.status);

    const query = new AdsAiQueryDto();
    query.limit = limit;
    query.search = search;
    if (statusStr && Object.values(AdsAiStatus).includes(statusStr as AdsAiStatus)) {
      query.status = statusStr as AdsAiStatus;
    }

    const result = await this.adsAiService.findAll(query);

    const campaigns = result.data.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      postType: campaign.postType,
      publishedAt: campaign.publishedAt,
      metrics: {
        reach: campaign.reach,
        impressions: campaign.impressions,
        engagement: campaign.engagement,
        clicks: campaign.clicks,
        conversions: campaign.conversions,
        spend: campaign.spend,
        roi: campaign.spend > 0 ? (campaign.conversions * 50000) / campaign.spend : 0,
      },
    }));

    return {
      functionResponse: {
        name: 'get_ads_performance',
        response: {
          content: { campaigns },
        },
      },
    };
  }

  private async handleAdDetails(
    rawArgs: Record<string, unknown>,
    context: AdminCopilotAdminContext,
  ): Promise<FunctionResponsePart> {
    this.logger.debug(
      `Handling ad details tool for ID ${String(rawArgs.id)} (admin=${context.adminUserId})`,
    );
    const id = parsePositiveInt(rawArgs.id, undefined, 1);
    if (!id) {
      return {
        functionResponse: {
          name: 'get_ad_details',
          response: { content: { error: 'Thiếu ID bài viết.' } },
        },
      };
    }

    const campaign = await this.adsAiService.findOne(id);
    if (!campaign) {
      return {
        functionResponse: {
          name: 'get_ad_details',
          response: { content: { error: `Không tìm thấy bài viết với ID ${id}` } },
        },
      };
    }

    return {
      functionResponse: {
        name: 'get_ad_details',
        response: {
          content: {
            details: this.buildAdsAiCampaignResponse(campaign),
            metrics: {
              reach: campaign.reach,
              impressions: campaign.impressions,
              engagement: campaign.engagement,
              clicks: campaign.clicks,
              conversions: campaign.conversions,
              spend: campaign.spend,
            },
          },
        },
      },
    };
  }

  private extractFinalizeCampaignInput(source: Record<string, unknown>): Record<string, unknown> {
    const candidateKeys = ['campaign', 'advertisement', 'payload', 'data'];

    for (const key of candidateKeys) {
      const value = source[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    }

    return source;
  }

  private async buildAdsAiCreateDto(
    raw: Record<string, unknown>,
    context: AdminCopilotAdminContext,
    options: AdminCopilotRequestContextOptions = {},
  ): Promise<CreateAdsAiDto> {
    const normalizedName =
      normalizeString(raw['name']) ??
      normalizeString(raw['campaignName']) ??
      normalizeString(raw['headline']) ??
      this.buildDefaultAdsCampaignName(context);

    const primaryText =
      normalizeString(raw['primaryText']) ?? normalizeString(raw['caption']) ?? undefined;

    const prompt =
      normalizeString(raw['prompt']) ??
      normalizeString(raw['sourcePrompt']) ??
      primaryText ??
      undefined;

    const description =
      normalizeString(raw['description']) ?? normalizeString(raw['subHeadline']) ?? undefined;

    const callToAction =
      normalizeString(raw['callToAction']) ?? normalizeString(raw['cta']) ?? undefined;

    const ctaUrl = normalizeString(raw['ctaUrl'] ?? raw['url']) ?? 'http://localhost:3000';
    const productName = normalizeString(raw['productName'] ?? raw['productFocus']);
    const targetAudience = normalizeString(raw['targetAudience']);
    const tone = normalizeString(raw['tone']);
    const objective = normalizeString(raw['objective']);
    const headline = normalizeString(raw['headline']);
    let image = normalizeString(raw['image']);
    const postType = normalizeString(raw['postType']);

    let productId = parsePositiveInt(raw['productId'], undefined, 1);
    let normalizedProductName = productName;
    const productContext = this.resolveProductContextFromMeta(options.requestMeta);
    if (!productId && productContext.productId) {
      productId = productContext.productId;
    }
    if (!normalizedProductName && productContext.productName) {
      normalizedProductName = productContext.productName;
    }
    if (!image) {
      const imageFromMeta = this.resolveImageFromMeta(options.requestMeta);
      if (imageFromMeta) {
        image = imageFromMeta;
      }
    }

    const scheduledAt =
      normalizeScheduleIso(raw['scheduledAt']) ?? normalizeScheduleIso(raw['schedule']);

    const hashtagsValue =
      Array.isArray(raw['hashtags']) || typeof raw['hashtags'] === 'string'
        ? raw['hashtags']
        : undefined;

    const dtoInput: Record<string, unknown> = {
      name: normalizedName,
    };

    if (normalizedProductName) {
      dtoInput.productName = normalizedProductName;
    }
    if (productId !== undefined) {
      dtoInput.productId = productId;
    }
    if (targetAudience) {
      dtoInput.targetAudience = targetAudience;
    }
    if (tone) {
      dtoInput.tone = tone;
    }
    if (objective) {
      dtoInput.objective = objective;
    }
    if (callToAction) {
      dtoInput.callToAction = callToAction;
    }
    if (ctaUrl) {
      dtoInput.ctaUrl = ctaUrl;
    }
    if (primaryText) {
      dtoInput.primaryText = primaryText;
    }
    if (headline) {
      dtoInput.headline = headline;
    }
    if (description) {
      dtoInput.description = description;
    }
    if (hashtagsValue !== undefined) {
      dtoInput.hashtags = hashtagsValue;
    }
    if (scheduledAt) {
      dtoInput.scheduledAt = scheduledAt;
    }
    if (image) {
      dtoInput.image = image;
    }
    if (postType) {
      dtoInput.postType = postType;
    }
    if (prompt) {
      dtoInput.prompt = prompt;
    }

    const images = normalizeStringArray(raw['images']);
    if (images && images.length > 0) {
      dtoInput.images = images;
    } else {
      const imagesFromMeta = this.resolveImagesFromMeta(options.requestMeta);
      if (imagesFromMeta && imagesFromMeta.length > 0) {
        dtoInput.images = imagesFromMeta;
      }
    }

    const dto = plainToInstance(CreateAdsAiDto, dtoInput, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidUnknownValues: false,
    });

    if (errors.length) {
      throw new Error(this.buildValidationErrorMessage(errors));
    }

    return dto;
  }

  private buildAdsAiCampaignResponse(campaign: AdsAiCampaign): Record<string, unknown> {
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      productId: campaign.productId,
      productName: campaign.productName,
      targetAudience: campaign.targetAudience,
      tone: campaign.tone,
      objective: campaign.objective,
      callToAction: campaign.callToAction,
      ctaUrl: campaign.ctaUrl,
      primaryText: campaign.primaryText,
      headline: campaign.headline,
      description: campaign.description,
      hashtags: campaign.hashtags ?? [],
      postType: campaign.postType,
      scheduledAt: campaign.scheduledAt ? campaign.scheduledAt.toISOString() : null,
      createdAt: campaign.createdAt ? campaign.createdAt.toISOString() : null,
      updatedAt: campaign.updatedAt ? campaign.updatedAt.toISOString() : null,
    };
  }

  private buildDefaultAdsCampaignName(context: AdminCopilotAdminContext): string {
    const now = new Date();
    const datePart = now.toISOString().split('T')[0];
    const scope = !context.isGlobalAdmin && context.branchName ? ` - ${context.branchName}` : '';
    return `Copilot Campaign ${datePart}${scope}`;
  }

  private buildValidationErrorMessage(errors: ValidationError[]): string {
    const messages: string[] = [];

    const collect = (items: ValidationError[]) => {
      items.forEach((item) => {
        if (item.constraints) {
          messages.push(...Object.values(item.constraints));
        }
        if (item.children && item.children.length) {
          collect(item.children);
        }
      });
    };

    collect(errors);

    return messages.filter(Boolean).join('; ');
  }

  private async generatePostCampaignDraftsWithAdsAi(
    normalized: AdminCopilotPostCampaignNormalizedInput,
    context: AdminCopilotAdminContext,
  ): Promise<AdminCopilotPostDraft[]> {
    const totalPosts = normalized.variants;
    const drafts: AdminCopilotPostDraft[] = [];
    let successCount = 0;

    for (let index = 0; index < totalPosts; index += 1) {
      const variantId = `variant-${index + 1}`;

      try {
        const dto = this.buildAdsAiGenerateDto(normalized, index, context);
        const creative = await this.adsAiService.generateCreative(dto);
        successCount += 1;

        const hashtags =
          Array.isArray(creative.hashtags) && creative.hashtags.length
            ? creative.hashtags
            : normalized.hashtags;

        drafts.push({
          variantId,
          headline: creative.headline,
          subHeadline: creative.description,
          caption: creative.primaryText,
          callToAction:
            creative.callToAction && creative.callToAction.trim().length
              ? creative.callToAction
              : (normalized.brief.callToAction ?? null),
          hashtags,
          schedule: normalized.brief.schedule ?? null,
          preview: this.buildAdsAiPreview(creative),
          notes: this.buildAdsAiPostNotes(normalized),
          suggestedAssets: this.buildSuggestedAssets(normalized),
        });
      } catch (error) {
        this.logger.error(
          `Ads AI generation failed for Facebook variant ${variantId}`,
          error instanceof Error ? error.stack : String(error),
        );

        drafts.push({
          variantId,
          headline: null,
          subHeadline: null,
          caption: this.buildAdsAiFallbackCaption(normalized.language),
          callToAction: normalized.brief.callToAction ?? null,
          hashtags: normalized.hashtags,
          schedule: normalized.brief.schedule ?? null,
          preview: null,
          notes: this.buildAdsAiFailureNote(error, normalized.language),
          suggestedAssets: this.buildSuggestedAssets(normalized),
        });
      }
    }

    if (!successCount) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        code: 'ADMIN_COPILOT_POST_PLAN_FAILED',
        translationKey: 'errors.adminCopilot.postPlanFailed',
      });
    }

    return drafts;
  }

  private buildPostCampaignStrategyFromAdsAi(
    posts: AdminCopilotPostDraft[],
    normalized: AdminCopilotPostCampaignNormalizedInput,
    context: AdminCopilotAdminContext,
  ): AdminCopilotPostStrategy {
    const hookCandidates = posts
      .map((post) => {
        if (post.headline && post.headline.trim().length) {
          return post.headline.trim();
        }
        const caption = post.caption.trim();
        if (!caption.length) {
          return null;
        }
        const firstSentence = caption.split(/(?<=[.!?])\s+/)[0]?.trim();
        return firstSentence && firstSentence.length ? firstSentence : caption;
      })
      .filter((item): item is string => Boolean(item));

    const hookIdeas = Array.from(new Set(hookCandidates)).slice(0, 6);
    const hashtags = this.aggregateHashtags(posts, normalized.hashtags);
    const assetIdeas = this.buildAssetIdeaSuggestions(normalized);
    const publishingTips = this.buildPublishingTipSuggestions(normalized, context);

    return {
      hookIdeas,
      assetIdeas,
      publishingTips,
      hashtags,
    };
  }

  private buildAdsAiGenerateDto(
    normalized: AdminCopilotPostCampaignNormalizedInput,
    variantIndex: number,
    context: AdminCopilotAdminContext,
  ): GenerateAdsAiDto {
    const descriptionSegments: string[] = [];

    if (normalized.brief.campaignName) {
      descriptionSegments.push(`Chiến dịch: ${normalized.brief.campaignName}`);
    }
    if (normalized.brief.productFocus) {
      descriptionSegments.push(`Trọng tâm: ${normalized.brief.productFocus}`);
    }
    if (normalized.brief.keyMessages.length) {
      descriptionSegments.push(`Thông điệp chính: ${normalized.brief.keyMessages.join(', ')}`);
    }
    if (normalized.brief.offers.length) {
      descriptionSegments.push(`Ưu đãi: ${normalized.brief.offers.join(', ')}`);
    }

    const schedule = normalized.brief.schedule;
    if (schedule?.date || schedule?.time) {
      const timedSegments = [
        schedule.date ? `ngày ${schedule.date}` : null,
        schedule.time ? `khung giờ ${schedule.time}` : null,
      ]
        .filter((segment): segment is string => Boolean(segment))
        .join(' ');
      const withTimezone = schedule?.timezone
        ? `${timedSegments} (${schedule.timezone})`
        : timedSegments;
      if (withTimezone.trim().length) {
        descriptionSegments.push(`Thời gian đăng: ${withTimezone.trim()}`);
      }
    }

    if (normalized.brief.notes) {
      descriptionSegments.push(`Ghi chú thương hiệu: ${normalized.brief.notes}`);
    }

    const languageName = this.getLanguageDisplayName(normalized.language);
    const noteSegments: string[] = [];

    if (normalized.format) {
      noteSegments.push(`Độ dài mong muốn: ${normalized.format}.`);
    }
    if (normalized.hashtags.length) {
      noteSegments.push(`Ưu tiên các hashtag: ${normalized.hashtags.join(', ')}.`);
    }
    if (!context.isGlobalAdmin && context.branchName) {
      noteSegments.push(`Nội dung dành cho chi nhánh ${context.branchName}.`);
    }
    noteSegments.push(`Ngôn ngữ bắt buộc: ${languageName}.`);

    const campaignContextSegments: string[] = [`Biến thể #${variantIndex + 1}.`];
    if (normalized.brief.objective) {
      campaignContextSegments.push(`Mục tiêu: ${normalized.brief.objective}.`);
    }
    if (normalized.brief.targetAudience) {
      campaignContextSegments.push(`Đối tượng: ${normalized.brief.targetAudience}.`);
    }

    const dto: GenerateAdsAiDto = {
      productName:
        normalized.brief.productFocus ??
        normalized.brief.campaignName ??
        `Chiến dịch biến thể ${variantIndex + 1}`,
      description: descriptionSegments.length ? descriptionSegments.join('\n') : undefined,
      targetAudience: normalized.brief.targetAudience ?? undefined,
      tone: normalized.brief.tone ?? undefined,
      objective: normalized.brief.objective ?? undefined,
      features: normalized.brief.keyMessages.length ? normalized.brief.keyMessages : undefined,
      benefits: normalized.brief.offers.length ? normalized.brief.offers : undefined,
      campaignContext: campaignContextSegments.join(' '),
      additionalNotes: noteSegments.join('\n'),
    };

    const metaContext = this.resolveProductContextFromMeta(normalized.meta ?? undefined);
    if (metaContext.productId && dto.productId === undefined) {
      dto.productId = metaContext.productId;
    }
    if (metaContext.productName && !dto.productName) {
      dto.productName = metaContext.productName;
    }

    return dto;
  }

  private buildAdsAiPreview(content: GeneratedAdContent): string | null {
    const segments = [content.headline, content.description]
      .map((segment) => segment?.trim())
      .filter((segment): segment is string => Boolean(segment));

    if (!segments.length) {
      return null;
    }

    return segments.join(' — ');
  }

  private buildAdsAiPostNotes(normalized: AdminCopilotPostCampaignNormalizedInput): string | null {
    if (!normalized.brief.notes) {
      return null;
    }

    return normalized.brief.notes;
  }

  private buildAdsAiFallbackCaption(language: string): string {
    const normalizedLang = language.toLowerCase();
    if (normalizedLang.startsWith('en')) {
      return 'Content could not be generated. Please try again later.';
    }
    return 'Không thể tạo nội dung. Vui lòng thử lại sau.';
  }

  private buildAdsAiFailureNote(error: unknown, language: string): string | null {
    const message = error instanceof Error ? error.message : null;
    const normalizedLang = language.toLowerCase();

    if (normalizedLang.startsWith('en')) {
      return message ? `Generation error: ${message}` : 'Unable to generate content with Ads AI.';
    }

    return message ? `Lỗi tạo nội dung: ${message}` : 'Không thể tạo nội dung bằng Ads AI.';
  }

  private buildSuggestedAssets(normalized: AdminCopilotPostCampaignNormalizedInput): string[] {
    const suggestions = new Set<string>();

    if (normalized.brief.productFocus) {
      suggestions.add(`Hình ảnh/clip nổi bật sản phẩm ${normalized.brief.productFocus}`);
    }

    suggestions.add('Ảnh lifestyle 1:1 phù hợp bài đăng Facebook.');
    suggestions.add('Video ngắn 15-30s giới thiệu ưu đãi chính.');

    if (!suggestions.size) {
      suggestions.add('Chuẩn bị hình ảnh và video thể hiện rõ ưu đãi chiến dịch.');
    }

    return Array.from(suggestions).slice(0, 6);
  }

  private aggregateHashtags(posts: AdminCopilotPostDraft[], fallback: string[]): string[] {
    const collected = new Set<string>();

    posts.forEach((post) => {
      post.hashtags.forEach((hashtag) => {
        const trimmed = hashtag.trim();
        if (!trimmed) {
          return;
        }
        collected.add(trimmed.startsWith('#') ? trimmed : `#${trimmed.replace(/^#+/, '')}`);
      });
    });

    if (!collected.size) {
      return fallback;
    }

    return Array.from(collected).slice(0, 12);
  }

  private buildAssetIdeaSuggestions(normalized: AdminCopilotPostCampaignNormalizedInput): string[] {
    const suggestions = new Set<string>();

    if (normalized.brief.productFocus) {
      suggestions.add(`Chụp cận cảnh ${normalized.brief.productFocus} trong bối cảnh đời thực.`);
    }

    suggestions.add('Ảnh lifestyle có CTA rõ ràng cho Facebook.');
    suggestions.add('Thiết kế mockup mobile/desktop thể hiện bài đăng sau khi lên sóng.');

    if (!suggestions.size) {
      suggestions.add('Chuẩn bị bộ ảnh/video thể hiện ưu đãi và trải nghiệm sản phẩm.');
    }

    return Array.from(suggestions).slice(0, 8);
  }

  private buildPublishingTipSuggestions(
    normalized: AdminCopilotPostCampaignNormalizedInput,
    context: AdminCopilotAdminContext,
  ): string[] {
    const tips = new Set<string>();

    const schedule = normalized.brief.schedule;
    if (schedule?.date || schedule?.time) {
      const scheduleSegments = [
        schedule.date ? `ngày ${schedule.date}` : null,
        schedule.time ? `khung giờ ${schedule.time}` : null,
      ]
        .filter((segment): segment is string => Boolean(segment))
        .join(' ');
      const timezone = schedule?.timezone ? ` (${schedule.timezone})` : '';
      tips.add(`Đăng vào ${scheduleSegments.trim()}${timezone}`.trim());
    }

    if (normalized.brief.callToAction) {
      tips.add(`Nhắc lại CTA "${normalized.brief.callToAction}" ở đầu và cuối caption.`);
    }

    if (!context.isGlobalAdmin && context.branchName) {
      tips.add(`Điều chỉnh nội dung phù hợp chi nhánh ${context.branchName}.`);
    }

    if (!tips.size) {
      tips.add('Theo dõi tương tác sau khi đăng và phản hồi trong 15 phút đầu.');
    }

    return Array.from(tips).slice(0, 8);
  }

  private normalizePostCampaignInput(
    rawArgs: Record<string, unknown>,
    fallbackLanguage: string,
    options: AdminCopilotRequestContextOptions = {},
  ): AdminCopilotPostCampaignNormalizedInput {
    const args = rawArgs as AdminCopilotPostCampaignInput;
    const rawBrief = (args.brief ?? {}) as Record<string, unknown>;
    const language = normalizeLanguageInput(args.language, fallbackLanguage);
    const variants = parsePositiveInt(args.variants, 1, 1, 3) ?? 1;
    const format = normalizeFormat(args.format);
    const hashtags = normalizeStringArray(args.hashtags, 12);

    const brief = this.mergePostBrief(rawBrief, null);
    const meta = options.requestMeta ?? null;

    return {
      language,
      variants,
      format,
      hashtags,
      brief,
      meta,
    };
  }

  private normalizePostCampaignResult(
    raw: Record<string, unknown>,
    normalizedInput: AdminCopilotPostCampaignNormalizedInput,
  ): AdminCopilotPostCampaignResult {
    const mergedBrief = this.mergePostBrief(raw?.brief, normalizedInput.brief);
    const strategy = this.normalizePostStrategy(raw?.strategy, normalizedInput);
    const posts = this.normalizePostDrafts(raw?.posts, normalizedInput);

    return {
      brief: mergedBrief,
      strategy,
      posts,
    };
  }

  private mergePostBrief(
    source: unknown,
    fallback: AdminCopilotPostBrief | null,
  ): AdminCopilotPostBrief {
    const base: AdminCopilotPostBrief = fallback
      ? { ...fallback }
      : {
          campaignName: null,
          objective: null,
          targetAudience: null,
          tone: null,
          productFocus: null,
          keyMessages: [],
          offers: [],
          callToAction: null,
          schedule: null,
          notes: null,
        };

    if (!source || typeof source !== 'object') {
      return base;
    }

    const map = source as Record<string, unknown>;

    const campaignName = normalizeString(map.campaignName);
    const objective = normalizeString(map.objective);
    const targetAudience = normalizeString(map.targetAudience ?? map.audience);
    const tone = normalizeString(map.tone ?? map.voice);
    const productFocus = normalizeString(map.productFocus ?? map.product);
    const keyMessages = normalizeStringArray(map.keyMessages ?? map.keypoints ?? map.messages, 10);
    const offers = normalizeStringArray(map.offers ?? map.promotions ?? map.deals, 8);
    const callToAction = normalizeString(map.callToAction ?? map.cta);
    const schedule = this.normalizePostSchedule(map.schedule) ?? base.schedule;
    const notes = normalizeString(map.notes ?? map.remarks ?? map.additionalNotes) ?? base.notes;

    return {
      campaignName: campaignName ?? base.campaignName ?? null,
      objective: objective ?? base.objective ?? null,
      targetAudience: targetAudience ?? base.targetAudience ?? null,
      tone: tone ?? base.tone ?? null,
      productFocus: productFocus ?? base.productFocus ?? null,
      keyMessages: keyMessages.length ? keyMessages : base.keyMessages,
      offers: offers.length ? offers : base.offers,
      callToAction: callToAction ?? base.callToAction ?? null,
      schedule,
      notes,
    };
  }

  private normalizePostStrategy(
    source: unknown,
    normalizedInput: AdminCopilotPostCampaignNormalizedInput,
  ): AdminCopilotPostStrategy {
    if (!source || typeof source !== 'object') {
      return {
        hookIdeas: [],
        assetIdeas: [],
        publishingTips: [],
        hashtags: normalizedInput.hashtags,
      };
    }

    const map = source as Record<string, unknown>;
    const hookIdeas = normalizeStringArray(map.hookIdeas ?? map.hooks, 8);
    const assetIdeas = normalizeStringArray(map.assetIdeas ?? map.visualIdeas, 8);
    const publishingTips = normalizeStringArray(map.publishingTips ?? map.tips, 8);
    const hashtags = normalizeStringArray(map.hashtags ?? map.tags, 12);

    return {
      hookIdeas,
      assetIdeas,
      publishingTips,
      hashtags: hashtags.length ? hashtags : normalizedInput.hashtags,
    };
  }

  private normalizePostDrafts(
    source: unknown,
    normalizedInput: AdminCopilotPostCampaignNormalizedInput,
  ): AdminCopilotPostDraft[] {
    const postsArray = Array.isArray(source) ? (source as unknown[]) : [];

    const normalized = postsArray
      .map((item, index) => this.normalizeSinglePostDraft(item, index, normalizedInput))
      .filter((item): item is AdminCopilotPostDraft => item !== null);

    if (normalized.length) {
      return normalized.slice(0, normalizedInput.variants);
    }

    const fallbackCaption =
      'Không có nội dung khả dụng. Vui lòng yêu cầu trợ lý tạo lại bài đăng Facebook.';

    return [
      {
        variantId: 'variant-1',
        caption: fallbackCaption,
        hashtags: normalizedInput.hashtags,
        callToAction: normalizedInput.brief.callToAction ?? null,
        schedule: normalizedInput.brief.schedule ?? null,
        preview: null,
        headline: null,
        subHeadline: null,
        notes: null,
        suggestedAssets: [],
      },
    ];
  }

  private resolveProductContextFromMeta(meta?: Record<string, unknown>): {
    productId?: number;
    productName?: string;
  } {
    if (!meta || typeof meta !== 'object') {
      return {};
    }

    const directId = parsePositiveInt(meta['productId'], undefined, 1);
    const productSource =
      meta['product'] && typeof meta['product'] === 'object' && !Array.isArray(meta['product'])
        ? (meta['product'] as Record<string, unknown>)
        : undefined;
    const nestedId = productSource
      ? parsePositiveInt(productSource['id'], undefined, 1)
      : undefined;

    const productName =
      normalizeString(meta['productName']) ??
      (productSource ? normalizeString(productSource['name']) : undefined);

    return {
      productId: directId ?? nestedId,
      productName: productName ?? undefined,
    };
  }

  private resolveImagesFromMeta(meta?: Record<string, unknown>): string[] | undefined {
    if (!meta || typeof meta !== 'object') {
      return undefined;
    }

    // Check for direct array of strings
    if (Array.isArray(meta['images'])) {
      return normalizeStringArray(meta['images']);
    }

    // Check for array of objects (e.g. { url: '...' })
    if (Array.isArray(meta['images'])) {
      const raw = meta['images'] as unknown[];
      const extracted = raw
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            return (item as Record<string, unknown>).url as string;
          }
          return null;
        })
        .filter(Boolean);
      return normalizeStringArray(extracted);
    }

    // Check for 'images' inside 'image' or other common patterns if needed
    // But usually 'images' key at top level is expected for multiple selections.

    return undefined;
  }

  private resolveImageFromMeta(meta?: Record<string, unknown>): string | undefined {
    if (!meta || typeof meta !== 'object') {
      return undefined;
    }

    const direct = normalizeString(meta['imageUrl']) ?? normalizeString(meta['image']) ?? undefined;
    if (direct) {
      return direct;
    }

    const imageSource =
      meta['image'] && typeof meta['image'] === 'object' && !Array.isArray(meta['image'])
        ? (meta['image'] as Record<string, unknown>)
        : undefined;

    const url = imageSource ? normalizeString(imageSource['url']) : undefined;
    return url ?? undefined;
  }

  private normalizeSinglePostDraft(
    source: unknown,
    index: number,
    normalizedInput: AdminCopilotPostCampaignNormalizedInput,
  ): AdminCopilotPostDraft | null {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const map = source as Record<string, unknown>;
    const caption = normalizeString(map.caption);
    if (!caption) {
      return null;
    }

    const variantId = normalizeString(map.variantId ?? map.id) ?? `variant-${index + 1}`;

    const hashtags = normalizeStringArray(map.hashtags ?? map.tags, 12);
    const schedule =
      this.normalizePostSchedule(map.schedule) ?? normalizedInput.brief.schedule ?? null;

    return {
      variantId,
      headline: normalizeString(map.headline ?? map.title) ?? null,
      subHeadline: normalizeString(map.subHeadline ?? map.subtitle ?? map.subheading) ?? null,
      caption,
      callToAction:
        normalizeString(map.callToAction ?? map.cta) ?? normalizedInput.brief.callToAction ?? null,
      hashtags: hashtags.length ? hashtags : normalizedInput.hashtags,
      schedule,
      preview: normalizeString(map.preview ?? map.summary) ?? null,
      notes: normalizeString(map.notes ?? map.comments) ?? null,
      suggestedAssets: normalizeStringArray(map.suggestedAssets ?? map.assetIdeas, 6),
    };
  }

  private normalizePostSchedule(value: unknown): AdminCopilotPostSchedule | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const map = value as Record<string, unknown>;
    const date = normalizeString(map.date ?? map.day ?? map.publishDate);
    const time = normalizeString(map.time ?? map.publishTime ?? map.window);
    const timezone = normalizeString(map.timezone ?? map.tz ?? map.timeZone);

    if (!date && !time && !timezone) {
      return null;
    }

    return {
      date: date ?? null,
      time: time ?? null,
      timezone: timezone ?? null,
    };
  }

  private normalizeGranularity(value: unknown): TrendGranularity | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    if (value === 'day' || value === 'week' || value === 'month') {
      return value;
    }
    return undefined;
  }
}
