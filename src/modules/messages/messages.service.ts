import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { Message } from './entities/message.entity';
import { MessageRole } from './enums/message.enums';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversation_participants/entities/conversation_participant.entity';
import { GeminiService, GeminiChatMessage, GeminiChatRole } from '../gemini/gemini.service';
import { FunctionCall, FunctionResponsePart } from '@google/generative-ai';

// "TOOLS" – nghiệp vụ bên dưới
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { OrderStatus } from '../orders/entities/order.entity';
import { UserRole } from '../users/entities/user.entity';
// import { ProductQueryDto } from '../products/dto/product-query.dto';

interface OrderListItem {
  orderNumber: string;
  status: OrderStatus;
  createdAt: Date;
}

export interface RequestUserContext {
  id: number;
  role: UserRole;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  // Whitelist tool names để tránh LLM gọi lung tung
  private readonly toolWhitelist = new Set<string>([
    'track_order',
    'create_return_request',
    'search_products',
    'get_list_orders',
    'get_order_detail',
    // 'get_product_detail',
    // 'update_cart',
  ]);

  // Giới hạn lịch sử (có thể chuyển thành cấu hình)
  private readonly historyLimit = 40;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
    @InjectRepository(Conversation) private readonly conversationRepo: Repository<Conversation>,
    private readonly geminiService: GeminiService,

    // “Tools”
    private readonly ordersService: OrdersService,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * Gửi tin nhắn của USER và lấy phản hồi từ Gemini (có thể kèm function call).
   * Toàn bộ trong 1 transaction để đảm bảo tính toàn vẹn.
   */
  async create(
    dto: CreateMessageDto,
    requestUserContext: RequestUserContext,
    opts?: { correlationId?: string },
  ) {
    const logPrefix = `[convo:${dto.conversationId}]${opts?.correlationId ? `[cid:${opts.correlationId}]` : ''}`;

    return this.dataSource.transaction(async (trx) => {
      const convRepo = trx.getRepository(Conversation);
      const msgRepo = trx.getRepository(Message);
      const partRepo = trx.getRepository(ConversationParticipant);

      // 1) Validate conversation
      const conversation = await convRepo.findOne({
        where: { id: dto.conversationId },
        select: {
          id: true,
          metadata: true,
          lastMessageAt: true,
          lastMessageId: true,
          updatedAt: true,
        },
      });
      if (!conversation) {
        throw new NotFoundException(`Conversation #${dto.conversationId} not found`);
      }

      // 1.1) Ownership/participation check (IDOR guard) — không cần load participants
      const isParticipant = await partRepo.exist({
        where: { conversationId: conversation.id, userId: requestUserContext.id },
      });
      if (!isParticipant) {
        throw new ForbiddenException('You are not allowed to send message in this conversation');
      }

      // 1.2) Role & content validate
      const role = dto.role ?? MessageRole.USER;
      if (role !== MessageRole.USER) {
        throw new BadRequestException('Only USER can start a message');
      }
      const content = (dto.content ?? '').trim();
      if (!content) {
        throw new BadRequestException('Message content cannot be empty');
      }

      // 1.3) Lấy cấu hình participant (model, name...)
      const participant = await partRepo.findOne({
        where: { conversationId: conversation.id, userId: requestUserContext.id },
      });

      // 2) Lấy lịch sử tối thiểu (chọn cột cần thiết)
      const historyEntities = await msgRepo.find({
        where: { conversationId: conversation.id },
        select: { id: true, role: true, content: true, metadata: true, createdAt: true },
        order: { createdAt: 'ASC', id: 'ASC' },
        take: this.historyLimit,
      });
      const history: GeminiChatMessage[] = historyEntities.map((m) => this.mapMessageToGemini(m));

      // 3) Lưu message của USER
      const userMessage = msgRepo.create({
        conversationId: conversation.id,
        senderParticipantId: participant?.id ?? null,
        role: MessageRole.USER,
        content,
        metadata: { ...(dto.metadata ?? {}), type: 'user_message' },
      });
      await msgRepo.save(userMessage);

      // 4) Gọi Gemini (lần 1)
      this.logger.log(`${logPrefix} Calling Gemini (1st)`);
      const firstCall = await this.geminiService.generateContent(content, history);

      let finalText: string | null = null;
      let finalMetadata: Record<string, unknown> = { provider: 'gemini', type: 'assistant_final' };

      // 5) Xử lý phản hồi
      if (firstCall.functionCall) {
        const call = firstCall.functionCall;

        // 5a) Whitelist tool
        if (!this.toolWhitelist.has(call.name)) {
          this.logger.warn(`${logPrefix} Blocked tool call: ${call.name}`);
          finalText = `Xin lỗi, chức năng ${call.name} hiện không khả dụng.`;
          finalMetadata = { ...finalMetadata, type: 'tool_blocked', toolName: call.name };
        } else {
          this.logger.log(`${logPrefix} Executing tool: ${call.name}`);

          // 5b) Thực thi tool (KHÔNG lưu vào DB, chỉ trong memory)
          const toolResult = await this.executeTool(call, requestUserContext, logPrefix);

          // 5c) Tạo history tạm cho Gemini call thứ 2 (KHÔNG lưu DB)
          const tempHistory: GeminiChatMessage[] = [
            ...history,
            this.mapMessageToGemini(userMessage),
            // Function call message (in-memory only)
            {
              role: GeminiChatRole.MODEL,
              content: JSON.stringify(call),
            },
            // Function response message (in-memory only)
            {
              role: GeminiChatRole.USER,
              content: JSON.stringify(toolResult),
            },
          ];

          // 5d) Gọi Gemini lần 2 để tổng hợp kết quả
          this.logger.log(`${logPrefix} Calling Gemini (2nd) with tool result`);
          const second = await this.geminiService.generateContentWithFunctionResponse(
            tempHistory,
            toolResult,
            { systemPrompt: dto.systemPrompt },
          );
          finalText = this.sanitizeMarkdown(second.text ?? '');
          finalMetadata = {
            ...finalMetadata,
            toolUsed: call.name,
            toolArgs: call.args,
          };
        }
      } else {
        if (!firstCall.text) {
          throw new InternalServerErrorException('Gemini returned neither text nor function call');
        }
        this.logger.log(`${logPrefix} Direct text response`);
        finalText = this.sanitizeMarkdown(firstCall.text);
      }

      // 6) Lưu ASSISTANT final response (DUY NHẤT message từ AI được lưu)
      const assistantFinal = msgRepo.create({
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: finalText ?? '',
        metadata: finalMetadata,
      });
      await msgRepo.save(assistantFinal);

      // 7) Update denorm fields + metadata
      await convRepo.update(conversation.id, {
        lastMessageAt: assistantFinal.createdAt,
        lastMessageId: assistantFinal.id,
        metadata: {
          ...(conversation.metadata ?? {}),
          lastInteractionAt: new Date().toISOString(),
          lastMessageId: assistantFinal.id,
        },
      });

      // 8) Return
      return {
        conversationId: conversation.id,
        userMessage,
        assistantMessage: assistantFinal,
      };
    });
  }

  // ------------------------- Helper mapping -------------------------

  /**
   * Xử lý markdown formatting từ Gemini response
   * Chuyển markdown sang plain text với format đẹp hơn
   */
  private sanitizeMarkdown(text: string): string {
    return (
      text
        // Xóa bold markdown (**text** -> text)
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        // Xóa italic markdown (*text* -> text)
        .replace(/\*([^*]+)\*/g, '$1')
        // Xóa underscores (_text_ -> text)
        .replace(/_([^_]+)_/g, '$1')
        // Xóa strikethrough (~~text~~ -> text)
        .replace(/~~([^~]+)~~/g, '$1')
        // Xóa code inline (`code` -> code)
        .replace(/`([^`]+)`/g, '$1')
        // Xóa headers (### text -> text)
        .replace(/^#{1,6}\s+/gm, '')
        // Giữ nguyên line breaks
        .trim()
    );
  }

  private mapMessageToGemini(message: Message): GeminiChatMessage {
    // Hỗ trợ function_call/response trong metadata, tránh nhét JSON vào content
    const metaType = message?.metadata?.type as string | undefined;

    if (message.role === MessageRole.ASSISTANT) {
      if (metaType === 'function_call') {
        // chuyển thành “assistant calling a tool”
        const call = message?.metadata?.call as FunctionCall;
        return {
          role: GeminiChatRole.MODEL,
          content: JSON.stringify(call), // hoặc tuỳ theo SDK Gemini bạn đang dùng
        };
      }
      return { role: GeminiChatRole.MODEL, content: message.content ?? '' };
    }

    if (metaType === 'function_response') {
      const result = message?.metadata?.result as FunctionResponsePart;
      return {
        role: GeminiChatRole.USER, // theo convention của Gemini
        content: JSON.stringify(result),
      };
    }

    return { role: GeminiChatRole.USER, content: message.content ?? '' };
  }

  // ------------------------- Tool Dispatcher -------------------------

  // --- Helper: ép về string hợp lệ, trim + cắt 120 ký tự ---
  sanitizeSearch(v: unknown): string | undefined {
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    if (!s) return undefined;
    return s.length > 120 ? s.slice(0, 120) : s;
  }

  // --- Helper: ép nhiều dạng về number[] (hỗ trợ "1,2,3" hoặc [1, "2", 3]) ---
  toNumberArrayLoose(v: unknown): number[] | undefined {
    if (v == null) return undefined;
    if (Array.isArray(v)) {
      const arr = v
        .map((x: unknown) => (typeof x === 'string' ? x.trim() : x))
        .map((x: unknown) => Number(x))
        .filter((n: number) => Number.isFinite(n));
      return arr.length ? arr : undefined;
    }
    if (typeof v === 'string') {
      const arr = v
        .split(',')
        .map((s) => s.trim())
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
      return arr.length ? arr : undefined;
    }
    // Single number?
    if (typeof v === 'number' && Number.isFinite(v)) return [v];
    return undefined;
  }

  private async executeTool(
    functionCall: FunctionCall,
    requestUserContext: RequestUserContext,
    logPrefix: string,
  ): Promise<FunctionResponsePart> {
    const { name, args } = functionCall;
    let result: unknown;

    try {
      this.logger.log(`${logPrefix} Tool ${name} args=${JSON.stringify(args)}`);

      switch (name) {
        // -------- Orders (ví dụ vẫn giữ nguyên) --------
        case 'track_order': {
          const { orderNumber } = (args ?? {}) as { orderNumber?: string };
          if (!orderNumber) throw new BadRequestException('orderNumber is required');
          result = await this.ordersService.getOrderStatus(orderNumber, requestUserContext.id);
          break;
        }

        case 'create_return_request': {
          const input = (args ?? {}) as {
            orderNumber?: string;
            items?: Array<{ itemId: string; quantity: number }>;
            reason?: string;
            note?: string;
          };
          if (!input?.orderNumber) throw new BadRequestException('orderNumber is required');
          // tuỳ nghiệp vụ: xác thực items/reason...
          result = await this.ordersService.requestCancellation(
            input.orderNumber,
            requestUserContext,
          );
          break;
        }

        // -------- Get list orders --------
        case 'get_list_orders': {
          const input = (args ?? {}) as {
            status?: string[];
            limit?: number;
            offset?: number;
          };

          // Luôn dùng currentUserId - không cần user_id từ Gemini
          this.logger.log(`${logPrefix} get_list_orders for user_id=${requestUserContext.id}`);

          // Lấy limit từ args, mặc định 10
          const limit = Number.isFinite(input.limit) && input.limit! > 0 ? input.limit! : 10;

          // Gọi service để lấy danh sách đơn hàng
          let result: OrderListItem[] = await this.ordersService.listRecentOrders(
            requestUserContext.id,
            limit,
          );

          // Nếu có status filter, lọc thêm ở đây
          if (input.status && Array.isArray(input.status) && input.status.length > 0) {
            result = result.filter((order) => input.status!.includes(order.status));
          }

          this.logger.log(
            `${logPrefix} Found ${result.length} orders for user ${requestUserContext.id}`,
          );
          break;
        }

        // -------- Products (cập nhật theo ProductQueryDto mới) --------
        // case 'search_products': {
        //   // Map args -> ProductQueryDto
        //   // Giả định PaginationOptionsDto có: page?, pageSize?, sortBy?, sortOrder?
        //   const a = (args ?? {}) as Record<string, unknown>;

        //   const dto: ProductQueryDto = {
        //     search: this.sanitizeSearch(a.search),
        //     categoryIds: this.toNumberArrayLoose(a.categoryIds),
        //   };

        //   // Tuỳ PaginationOptionsDto của bạn: map thêm nếu muốn cho phép qua tool
        //   if (Number.isFinite(Number(a.page))) dto.page = Number(a.page);
        //   if (Number.isFinite(Number(a.pageSize))) dto.pageSize = Number(a.pageSize);
        //   if (typeof a.sortBy === 'string') dto.sortBy = a.sortBy.trim();
        //   if (typeof a.sortOrder === 'string') {
        //     const o = String(a.sortOrder).toUpperCase();
        //     if (o === 'ASC' || o === 'DESC') dto.sortOrder = o;
        //   }

        //   result = await this.productsService.findAll(dto as ProductQueryDto);
        //   break;
        // }

        // -------- Get order detail --------
        case 'get_order_detail': {
          const input = (args ?? {}) as { orderNumber?: string };

          if (!input.orderNumber) {
            throw new BadRequestException('orderNumber is required');
          }

          this.logger.log(`${logPrefix} get_order_detail for order: ${input.orderNumber}`);

          // Gọi service để lấy chi tiết đơn hàng
          result = await this.ordersService.getOrderDetails(
            input.orderNumber,
            requestUserContext.id,
          );

          this.logger.log(`${logPrefix} Retrieved order detail for ${input.orderNumber}`);
          break;
        }

        // -------- Cart (nếu sau này mở) --------
        // case 'update_cart': {
        //   result = await this.cartService.handleCartUpdate(currentUserId, args as any);
        //   break;
        // }

        default:
          this.logger.warn(`${logPrefix} Unknown tool: ${name}`);
          result = { error: 'Unknown tool' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`${logPrefix} Tool error: ${name} - ${msg}`, stack);
      result = { error: msg };
    }

    return {
      functionResponse: {
        name,
        response: { content: result },
      },
    };
  }

  // ------------------------- CRUD phụ trợ -------------------------

  async findAll(conversationId?: number): Promise<Message[]> {
    return this.messageRepo.find({
      where: conversationId ? { conversationId } : undefined,
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Message> {
    const message = await this.messageRepo.findOne({ where: { id } });
    if (!message) throw new NotFoundException(`Message #${id} not found`);
    return message;
  }

  async update(id: number, dto: UpdateMessageDto): Promise<Message> {
    const message = await this.messageRepo.findOne({ where: { id } });
    if (!message) throw new NotFoundException(`Message #${id} not found`);

    if (dto.content !== undefined) message.content = dto.content;
    if (dto.metadata !== undefined) {
      // merge nông để không mất metadata.type/history flags
      message.metadata = { ...(message.metadata ?? {}), ...(dto.metadata ?? {}) };
    }
    return this.messageRepo.save(message);
  }

  async remove(id: number): Promise<void> {
    const result = await this.messageRepo.delete(id);
    if (!result.affected) throw new NotFoundException(`Message #${id} not found`);
  }
}
