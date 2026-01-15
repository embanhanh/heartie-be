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
import { OrdersService, CreateOrderResult } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { OrderStatus, PaymentMethod } from '../orders/entities/order.entity';
import { UserRole } from '../users/entities/user.entity';
import { ProductQueryDto } from '../products/dto/product-query.dto';
import { CartItemsService } from '../cart_items/cart-items.service';
import { CartsService } from '../carts/carts.service';
import { AddressesService } from '../addresses/addresses.service';
import { VouchersService } from '../vouchers/vouchers.service';

interface OrderListItem {
  orderNumber: string;
  status: OrderStatus;
  createdAt: Date;
}

export interface RequestUserContext {
  id: number;
  role: UserRole;
}

interface SearchFilters {
  price_min?: string | number;
  price_max?: string | number;
  colors?: unknown[]; // Dùng unknown thay vì any cho mảng
  sizes?: unknown[];
  category?: unknown[];
  fit?: unknown[];
  occasion?: unknown[];
  sort?: string;
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
    'get_product_detail',
    'update_cart',
    'get_my_cart',
    'create_order',
    'get_my_addresses',
    'get_payment_methods',
    'get_available_vouchers',
    'validate_voucher',
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
    private readonly cartItemsService: CartItemsService,
    private readonly cartsService: CartsService,
    private readonly addressesService: AddressesService,
    private readonly vouchersService: VouchersService,
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
      let firstCall: { text: string | null; functionCall: FunctionCall | null };
      try {
        firstCall = await this.geminiService.generateContent(content, history);
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        this.logger.error(`${logPrefix} Gemini call failed: ${error.message}`);
        firstCall = {
          text: 'Xin lỗi, hệ thống đang gặp sự cố kết nối. Bạn vui lòng thử lại sau giây lát.',
          functionCall: null,
        };
      }

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
          // History should end with the model's function call
          // The function response is passed separately via the functionResponse parameter
          const tempHistory: GeminiChatMessage[] = [
            ...history,
            this.mapMessageToGemini(userMessage),
            // Function call message (in-memory only) - this is the last item
            {
              role: GeminiChatRole.MODEL,
              content: JSON.stringify(call),
            },
          ];

          // 5d) Gọi Gemini lần 2 để tổng hợp kết quả
          // 5d) Gọi Gemini lần 2 để tổng hợp kết quả
          this.logger.log(`${logPrefix} Calling Gemini (2nd) with tool result`);
          let second: { text: string | null };
          try {
            second = await this.geminiService.generateContentWithFunctionResponse(
              tempHistory,
              toolResult,
              { systemPrompt: dto.systemPrompt },
            );
          } catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            this.logger.error(`${logPrefix} Gemini 2nd call failed: ${error.message}`);
            second = { text: 'Đã xử lý xong yêu cầu của bạn.' };
          }
          finalText = this.sanitizeMarkdown(second.text ?? '');
          finalMetadata = {
            ...finalMetadata,
            toolUsed: call.name,
            toolArgs: call.args,
          };

          // Helper to extract content from tool result
          const getToolContent = () => {
            const response = toolResult.functionResponse.response as
              | { content?: unknown }
              | undefined;
            return response?.content;
          };

          // Nếu là search_products, đính kèm kết quả vào metadata để frontend hiển thị
          if (call.name === 'search_products') {
            const content = getToolContent() as
              | { data?: unknown[]; meta?: { total?: number } }
              | undefined;
            if (content?.data && Array.isArray(content.data)) {
              finalMetadata.products = content.data;
              finalMetadata.productCount = content.meta?.total;
            }
          }

          // Nếu là get_product_detail, đính kèm chi tiết sản phẩm vào metadata
          if (call.name === 'get_product_detail') {
            const content = getToolContent() as { error?: string } | undefined;
            if (content && !content.error) {
              finalMetadata.productDetail = content;
            }
          }

          // Nếu là get_my_cart, đính kèm giỏ hàng vào metadata
          if (call.name === 'get_my_cart') {
            const content = getToolContent() as { error?: string } | undefined;
            if (content && !content.error) {
              finalMetadata.cartData = content;
            }
          }

          // Nếu là create_order, đính kèm kết quả đặt hàng vào metadata
          if (call.name === 'create_order') {
            const content = getToolContent() as { error?: string } | undefined;
            if (content && !content.error) {
              finalMetadata.orderResult = content;
            }
          }

          // Nếu là get_my_addresses, đính kèm danh sách địa chỉ vào metadata
          if (call.name === 'get_my_addresses') {
            const content = getToolContent() as { addresses?: unknown[] } | undefined;
            if (content?.addresses) {
              finalMetadata.addresses = content.addresses;
            }
          }

          // Nếu là get_payment_methods, đính kèm phương thức thanh toán vào metadata
          if (call.name === 'get_payment_methods') {
            const content = getToolContent() as { paymentMethods?: unknown[] } | undefined;
            if (content?.paymentMethods) {
              finalMetadata.paymentMethods = content.paymentMethods;
            }
          }

          // Nếu là get_available_vouchers, đính kèm danh sách voucher vào metadata
          if (call.name === 'get_available_vouchers') {
            const content = getToolContent() as { vouchers?: unknown[] } | undefined;
            if (content?.vouchers) {
              finalMetadata.vouchers = content.vouchers;
            }
          }

          // [FIX] Nếu là get_list_orders, đính kèm danh sách đơn hàng vào metadata
          if (call.name === 'get_list_orders') {
            const content = getToolContent();
            this.logger.debug(
              `[get_list_orders] content type: ${typeof content}, isArray: ${Array.isArray(content)}, value: ${JSON.stringify(content)?.substring(0, 200)}`,
            );
            // The tool returns an array of orders directly (OrderListItem[])
            if (Array.isArray(content)) {
              finalMetadata.orders = content;
              this.logger.log(`[get_list_orders] Saved ${content.length} orders to metadata`);
            } else {
              this.logger.warn(
                `[get_list_orders] Content is not an array, cannot save to metadata`,
              );
            }
          }
        }
      } else {
        if (!firstCall.text) {
          throw new InternalServerErrorException('Gemini returned neither text nor function call');
        }
        // IMPORTANT: Log when Gemini returns text without calling a function
        // This helps debug cases where function calls should have been made
        this.logger.log(`${logPrefix} Direct text response (NO function call)`);
        this.logger.debug(`${logPrefix} User message: "${content.substring(0, 100)}..."`);
        this.logger.debug(
          `${logPrefix} Gemini text response: "${firstCall.text.substring(0, 100)}..."`,
        );
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
    const userId = requestUserContext.id;
    let result: unknown;

    try {
      this.logger.log(`${logPrefix} [${name}] args=${JSON.stringify(args)}`);

      switch (name) {
        // ══════════════════════════════════════════════════════════════════
        // ORDERS
        // ══════════════════════════════════════════════════════════════════

        case 'track_order': {
          const input = (args ?? {}) as unknown as { orderNumber?: string };
          if (!input.orderNumber) {
            throw new BadRequestException('orderNumber is required');
          }

          result = await this.ordersService.getOrderStatus(input.orderNumber, userId);
          this.logger.log(`${logPrefix} [${name}] completed for order: ${input.orderNumber}`);
          break;
        }

        case 'create_return_request': {
          const input = (args ?? {}) as unknown as {
            orderNumber?: string;
            items?: Array<{ itemId: string; quantity: number }>;
            reason?: string;
            note?: string;
          };
          if (!input.orderNumber) {
            throw new BadRequestException('orderNumber is required');
          }

          result = await this.ordersService.requestCancellation(
            input.orderNumber,
            requestUserContext,
          );
          this.logger.log(`${logPrefix} [${name}] completed for order: ${input.orderNumber}`);
          break;
        }

        case 'get_list_orders': {
          const input = (args ?? {}) as unknown as {
            status?: string[];
            limit?: number;
            offset?: number;
          };
          const limit = Number.isFinite(input.limit) && input.limit! > 0 ? input.limit! : 10;

          let orders: OrderListItem[] = await this.ordersService.listRecentOrders(userId, limit);

          // Filter by status if provided
          if (input.status?.length) {
            orders = orders.filter((order) => input.status!.includes(order.status));
          }

          result = orders;
          this.logger.log(`${logPrefix} [${name}] found ${orders.length} orders`);
          break;
        }

        case 'get_order_detail': {
          const input = (args ?? {}) as unknown as { orderNumber?: string };
          if (!input.orderNumber) {
            throw new BadRequestException('orderNumber is required');
          }

          result = await this.ordersService.getOrderDetails(input.orderNumber, userId);
          this.logger.log(`${logPrefix} [${name}] completed for order: ${input.orderNumber}`);
          break;
        }

        case 'create_order': {
          const input = (args ?? {}) as unknown as {
            addressId?: number;
            paymentMethod?: string;
            voucherId?: number;
            items?: Array<{ variantId: number; quantity: number }>;
            note?: string;
          };
          if (!input.addressId) {
            throw new BadRequestException('addressId is required');
          }
          if (!input.paymentMethod) {
            throw new BadRequestException('paymentMethod is required');
          }

          // Get cart items if not provided
          let orderItems = input.items;
          if (!orderItems?.length) {
            const cart = await this.cartsService.getMyCart(userId);
            orderItems = (cart.items ?? [])
              .map((item) => ({
                variantId: item.variant?.id ?? 0,
                quantity: item.quantity,
              }))
              .filter((item) => item.variantId > 0);
          }

          if (!orderItems.length) {
            throw new BadRequestException('Giỏ hàng trống, không thể tạo đơn hàng');
          }

          // Map payment method string to enum
          const paymentMethodMap: Record<string, PaymentMethod> = {
            COD: PaymentMethod.COD,
            MOMO: PaymentMethod.MOMO,
            BANK: PaymentMethod.BANK,
            STORE: PaymentMethod.STORE,
          };
          const paymentMethod =
            paymentMethodMap[input.paymentMethod.toUpperCase()] ?? PaymentMethod.COD;

          const createResult: CreateOrderResult = await this.ordersService.create(
            {
              addressId: input.addressId,
              paymentMethod,
              items: orderItems,
              note: input.note,
            },
            userId,
          );

          result = {
            success: true,
            orderId: createResult.order.id,
            orderNumber: createResult.order.orderNumber,
            status: createResult.order.status,
            totalAmount: createResult.order.totalAmount,
            paymentMethod: createResult.order.paymentMethod,
            payUrl: createResult.payUrl,
            message: createResult.payUrl
              ? `Đơn hàng ${createResult.order.orderNumber} đã được tạo. Vui lòng thanh toán qua MoMo.`
              : `Đơn hàng ${createResult.order.orderNumber} đã được tạo thành công!`,
          };
          this.logger.log(`${logPrefix} [${name}] success: ${createResult.order.orderNumber}`);
          break;
        }

        // ══════════════════════════════════════════════════════════════════
        // PRODUCTS
        // ══════════════════════════════════════════════════════════════════

        case 'search_products': {
          const a = (args ?? {}) as unknown as {
            query?: string;
            filters?: SearchFilters;
            limit?: number;
          };
          const filters = a.filters ?? {};

          const dto: Partial<ProductQueryDto> = {
            search: this.sanitizeSearch(a.query),
            limit: Number(a.limit) || 5,
          };

          if (filters.price_min) dto.priceMin = Number(filters.price_min);
          if (filters.price_max) dto.priceMax = Number(filters.price_max);
          if (Array.isArray(filters.colors)) dto.colors = filters.colors.map((c: any) => String(c));
          if (Array.isArray(filters.sizes)) dto.sizes = filters.sizes.map((s: any) => String(s));

          result = await this.productsService.findAll(dto as ProductQueryDto);
          this.logger.log(`${logPrefix} [${name}] completed with dto=${JSON.stringify(dto)}`);
          break;
        }

        case 'get_product_detail': {
          const input = (args ?? {}) as { product_id?: string };
          const productId = Number(input.product_id);
          if (!productId || !Number.isFinite(productId)) {
            throw new BadRequestException('product_id is required');
          }

          const product = await this.productsService.findOne(productId);
          result = product ?? { error: 'Product not found' };
          this.logger.log(`${logPrefix} [${name}] completed for product: ${productId}`);
          break;
        }

        // ══════════════════════════════════════════════════════════════════
        // CART
        // ══════════════════════════════════════════════════════════════════

        case 'update_cart': {
          const input = (args ?? {}) as {
            action?: 'add' | 'remove' | 'change_qty';
            items?: Array<{ variant_id?: number; quantity?: number }>;
          };
          if (!input.action) {
            throw new BadRequestException('action is required');
          }
          if (!input.items?.length) {
            throw new BadRequestException('items is required');
          }

          const results: unknown[] = [];
          for (const item of input.items) {
            const variantId = item.variant_id;
            const quantity = Math.max(1, item.quantity ?? 1);

            if (!variantId) {
              results.push({ variant_id: item.variant_id, error: 'Invalid variant_id' });
              continue;
            }

            if (input.action === 'add') {
              const addResult = await this.cartItemsService.addItem(userId, {
                variantId,
                quantity,
              });
              results.push({
                variant_id: variantId,
                quantity,
                success: true,
                cart_item_id: addResult.id,
              });
            }
            // TODO: Implement 'remove' and 'change_qty' actions if needed
          }

          result = { action: input.action, results };
          this.logger.log(`${logPrefix} [${name}] completed: ${results.length} items processed`);
          break;
        }

        case 'get_my_cart': {
          const cart = await this.cartsService.getMyCart(userId);

          const cartItems = (cart.items ?? []).map((item) => {
            const variant = item.variant;
            const product = variant?.product;
            return {
              cartItemId: item.id,
              variantId: variant?.id,
              productId: product?.id,
              productName: product?.name,
              productImage: product?.image,
              variantImage: variant?.image,
              variantPrice: variant?.price ?? 0,
              quantity: item.quantity,
              subtotal: (variant?.price ?? 0) * item.quantity,
              attributeValues:
                variant?.attributeValues?.map((av) => ({
                  attributeName: av.attribute?.name,
                  attributeValue: av.attributeValue?.value,
                })) ?? [],
              stock: variant?.inventories?.reduce((sum, inv) => sum + (inv.stock ?? 0), 0) ?? 0,
            };
          });

          const totalAmount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
          const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

          result = { cartId: cart.id, totalItems, totalAmount, items: cartItems };
          this.logger.log(
            `${logPrefix} [${name}] found ${cartItems.length} items, total: ${totalAmount}`,
          );
          break;
        }

        // ══════════════════════════════════════════════════════════════════
        // CHECKOUT (Addresses, Payment, Vouchers)
        // ══════════════════════════════════════════════════════════════════

        case 'get_my_addresses': {
          const addresses = await this.addressesService.findAllByUser(userId);
          result = { addresses };
          this.logger.log(`${logPrefix} [${name}] found ${addresses.length} addresses`);
          break;
        }

        case 'get_payment_methods': {
          result = {
            paymentMethods: [
              { code: 'COD', name: 'Thanh toán khi nhận hàng (COD)' },
              { code: 'BANK', name: 'Chuyển khoản ngân hàng' },
              { code: 'STORE', name: 'Thanh toán tại cửa hàng' },
            ],
          };
          this.logger.log(`${logPrefix} [${name}] returned 3 payment methods`);
          break;
        }

        case 'get_available_vouchers': {
          const vouchers = await this.vouchersService.findAvailableForUser(userId);
          result = { vouchers };
          this.logger.log(`${logPrefix} [${name}] found ${vouchers.length} vouchers`);
          break;
        }

        case 'validate_voucher': {
          const input = (args ?? {}) as { code?: string; orderTotal?: number };
          if (!input.code) {
            throw new BadRequestException('Mã voucher là bắt buộc');
          }

          result = await this.vouchersService.validateVoucher(
            input.code,
            userId,
            input.orderTotal ?? 0,
          );
          this.logger.log(`${logPrefix} [${name}] validated code: ${input.code}`);
          break;
        }

        // ══════════════════════════════════════════════════════════════════
        // DEFAULT
        // ══════════════════════════════════════════════════════════════════

        default:
          this.logger.warn(`${logPrefix} [${name}] Unknown tool`);
          result = { error: 'Unknown tool' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`${logPrefix} [${name}] Error: ${msg}`, stack);
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
