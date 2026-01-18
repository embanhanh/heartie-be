import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository, In } from 'typeorm';
import { FulfillmentMethod, Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { Branch } from '../branches/entities/branch.entity';
import { OrderItem } from '../order_items/entities/order-item.entity';
import { Address } from '../addresses/entities/address.entity';
import { AddressesService } from '../addresses/addresses.service';
import { CreateAddressDto } from '../addresses/dto/create-address.dto';
import { PricingService } from '../pricing/pricing.service';
import { PricingSummary } from '../pricing/types/pricing.types';
import {
  ProductVariant,
  ProductVariantStatus,
} from '../product_variants/entities/product_variant.entity';
import { ComboType } from '../promotions/entities/promotion.entity';
import { Cart } from '../carts/entities/cart.entity';
import { CartItem } from '../cart_items/entities/cart-item.entity';
import {
  NotificationsService,
  OrderCreatedAdminPayload,
  OrderStatusChangedPayload,
} from '../notifications/notifications.service';
import { BaseService } from '../../common/services/base.service';
import { SortParam } from '../../common/dto/pagination.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { MomoService } from '../momo/momo.service';
import { InteractionsService } from '../interactions/interactions.service';
import { InteractionType } from '../interactions/entities/interaction.entity';

interface AutoGiftLine {
  variant: ProductVariant;
  quantity: number;
}

interface RequestUserContext {
  id: number;
  role: UserRole;
}

export interface CreateOrderResult {
  order: Order;
  payUrl: string | null;
}

@Injectable()
export class OrdersService extends BaseService<Order> {
  private readonly logger = new Logger(OrdersService.name);
  private readonly orderRelations: FindOptionsRelations<Order> = {
    user: true,
    branch: true,
    address: true,
    items: {
      variant: {
        product: true,
      },
    },
  };

  protected override getDefaultSorts(): SortParam[] {
    return [{ field: 'createdAt', direction: 'desc' }];
  }

  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Cart)
    private readonly cartRepo: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepo: Repository<CartItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    private readonly addressesService: AddressesService,
    private readonly pricingService: PricingService,
    private readonly notificationsService: NotificationsService,
    private readonly momoService: MomoService,
    private readonly interactionsService: InteractionsService,
  ) {
    super(repo, 'order');
  }

  async create(dto: CreateOrderDto, userId?: number): Promise<CreateOrderResult> {
    const resolvedAddressId = await this.resolveAddressId({
      providedAddressId: dto.addressId,
      addressPayload: dto.address,
      userId,
    });

    const effectiveAddressId = resolvedAddressId ?? undefined;

    await this.validateRelations({
      userId,
      branchId: dto.branchId,
      addressId: effectiveAddressId,
    });

    const pricing = await this.pricingService.calculate({
      items: dto.items,
      promotionCode: dto.promotionCode,
      branchId: dto.branchId,
      addressId: effectiveAddressId,
      userId,
    });

    const autoGiftLines = await this.resolveAutoGiftLines(pricing);
    const giftTotals = this.calculateGiftTotals(autoGiftLines);

    // Determine initial status based on payment method
    const isMomoPayment = dto.paymentMethod === PaymentMethod.MOMO;
    const initialStatus = isMomoPayment
      ? OrderStatus.PENDING_PAYMENT
      : (dto.status ?? OrderStatus.PENDING);

    const entity = this.repo.create({
      userId: userId ?? null,
      branchId: dto.branchId ?? null,
      addressId: resolvedAddressId ?? null,
      note: dto.note,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.COD,
      fulfillmentMethod: dto.fulfillmentMethod ?? FulfillmentMethod.DELIVERY,
      expectedDeliveryDate: dto.expectedDeliveryDate,
      paidAt: dto.paidAt,
      deliveredAt: dto.deliveredAt,
      cancelledAt: dto.cancelledAt,
      status: initialStatus,
      orderNumber: this.generateOrderNumber(),
      subTotal: this.roundMoney(pricing.totals.subTotal + giftTotals.subTotal),
      discountTotal: this.roundMoney(pricing.totals.discountTotal + giftTotals.discountTotal),
      shippingFee: pricing.totals.shippingFee,
      taxTotal: pricing.totals.taxTotal,
      totalAmount: pricing.totals.totalAmount,
    });

    const savedOrder = await this.repo.save(entity);

    await this.saveOrderItems(savedOrder.id, pricing, autoGiftLines);

    // Track PURCHASE interactions
    if (userId) {
      const variantIds = [
        ...pricing.items.map((i) => i.variantId),
        ...autoGiftLines.map((g) => g.variant.id),
      ];

      if (variantIds.length > 0) {
        // Bulk fetch variants with products to get product IDs
        const variants = await this.variantRepo.find({
          where: { id: In(variantIds) },
          relations: ['product'],
          select: {
            id: true,
            product: {
              id: true,
              tikiId: true,
            },
          },
        });

        const tikiIds = new Set(variants.map((v) => v.product?.tikiId).filter((id) => !!id));

        for (const tikiId of tikiIds) {
          if (tikiId) {
            this.interactionsService.logInteraction(userId, +tikiId, InteractionType.PURCHASE);
          }
        }
      }
    }

    if (userId) {
      await this.removePurchasedCartItems(userId, dto.items);
    }

    await this.notifyAdminsOrderCreated({
      orderId: savedOrder.id,
      orderNumber: savedOrder.orderNumber ?? '',
      totalAmount: savedOrder.totalAmount,
      userId: savedOrder.userId,
    });

    // If payment method is MoMo, create MoMo payment and return payUrl
    if (isMomoPayment) {
      const momoResult = await this.momoService.createPayment(
        savedOrder.id,
        savedOrder.orderNumber,
        savedOrder.totalAmount,
      );
      const order = await this.findOne(savedOrder.id);
      return { order, payUrl: momoResult.payUrl };
    }

    const order = await this.findOne(savedOrder.id);
    return { order, payUrl: null };
  }

  // Get order status by order number and user ID (used for payment polling)
  async getOrderStatus(
    orderNumber: string,
    userId: number,
  ): Promise<{
    id: number;
    orderNumber: string;
    status: OrderStatus;
    totalAmount: number;
    isPaid: boolean;
    paidAt: Date | null;
  }> {
    const order = await this.repo.findOne({ where: { orderNumber, user: { id: userId } } });

    if (!order) {
      throw new NotFoundException(`Order with number ${orderNumber} not found for user ${userId}`);
    }
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      isPaid: order.paidAt !== null,
      paidAt: order.paidAt ?? null,
    };
  }

  // Get order details for a user
  async getOrderDetails(orderNumber: string, userId: number): Promise<Order> {
    const order = await this.repo.findOne({ where: { orderNumber, user: { id: userId } } });

    if (!order) {
      throw new NotFoundException(`Order with number ${orderNumber} not found for user ${userId}`);
    }
    return order;
  }

  // Get recent orders for a user
  async listRecentOrders(
    userId: number,
    limit = 5,
  ): Promise<{ orderNumber: string; status: OrderStatus; createdAt: Date }[]> {
    const orders = await this.repo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return orders.map((o) => ({
      orderNumber: o.orderNumber ?? '',
      status: o.status,
      createdAt: o.createdAt,
    }));
  }

  // Request to cancel an order
  async requestCancellation(
    orderNumber: string,
    requester?: RequestUserContext,
  ): Promise<{ orderNumber: string; status: OrderStatus; message: string }> {
    const order = await this.repo.findOne({ where: { orderNumber, user: { id: requester?.id } } });

    if (!order) {
      throw new NotFoundException(
        `Order with number ${orderNumber} not found for user ${requester?.id}`,
      );
    }

    if (requester?.role === UserRole.CUSTOMER) {
      if (order.userId !== requester.id) {
        throw new ForbiddenException('Customers can only manage their own orders.');
      }
      if (order.status !== OrderStatus.PENDING) {
        if (order.status === OrderStatus.CANCELLED) {
          return {
            orderNumber: order.orderNumber ?? '',
            status: order.status,
            message: 'Order is already cancelled',
          };
        }
        throw new BadRequestException('Customers can only cancel pending orders');
      }
    }

    if (order.status === OrderStatus.CANCELLED) {
      return {
        orderNumber: order.orderNumber ?? '',
        status: order.status,
        message: 'Order is already cancelled',
      };
    }

    order.status = OrderStatus.CANCELLED;
    await this.repo.save(order);

    return {
      orderNumber: order.orderNumber ?? '',
      status: order.status,
      message: 'Order cancellation requested successfully',
    };
  }

  async findAll(query: OrdersQueryDto = new OrdersQueryDto()) {
    return this.paginate(query, (qb) => {
      qb.leftJoinAndSelect('order.user', 'user')
        .leftJoinAndSelect('order.branch', 'branch')
        .leftJoinAndSelect('order.address', 'address')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.variant', 'variant')
        .leftJoinAndSelect('variant.product', 'variantProduct');

      if (query.status?.length) {
        qb.andWhere('order.status IN (:...status)', { status: query.status });
      }

      if (query.paymentMethods?.length) {
        qb.andWhere('order.paymentMethod IN (:...paymentMethods)', {
          paymentMethods: query.paymentMethods,
        });
      }

      if (query.fulfillmentMethods?.length) {
        qb.andWhere('order.fulfillmentMethod IN (:...fulfillmentMethods)', {
          fulfillmentMethods: query.fulfillmentMethods,
        });
      }

      if (query.branchId) {
        qb.andWhere('order.branchId = :branchId', { branchId: query.branchId });
      }

      if (query.userId) {
        qb.andWhere('order.userId = :userId', { userId: query.userId });
      }

      if (typeof query.minTotal === 'number') {
        qb.andWhere('order.totalAmount >= :minTotal', { minTotal: query.minTotal });
      }

      if (typeof query.maxTotal === 'number') {
        qb.andWhere('order.totalAmount <= :maxTotal', { maxTotal: query.maxTotal });
      }

      const search = query.search?.trim();
      if (search) {
        const formattedSearch = `%${search.replace(/\s+/g, '%')}%`;
        qb.andWhere(
          'order.orderNumber ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR user.phoneNumber ILIKE :search',
          { search: formattedSearch },
        );
      }

      this.applyDateFilter(qb, 'createdAt', query.createdFrom, query.createdTo);
    });
  }

  async findOne(id: number, requester?: RequestUserContext) {
    if (!id) {
      throw new BadRequestException('Invalid order ID');
    }
    const order = await this.repo.findOne({
      where: { id },
      relations: this.orderRelations,
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    this.ensureCustomerOwnership(order, requester);

    return order;
  }

  async update(id: number, dto: UpdateOrderDto, requester?: RequestUserContext) {
    const existing = await this.repo.findOne({
      where: { id },
      relations: { items: true },
    });

    if (!existing) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    this.ensureCustomerOwnership(existing, requester);

    if (requester?.role === UserRole.CUSTOMER) {
      if (dto.status && dto.status !== existing.status) {
        throw new ForbiddenException('Customers cannot change order status');
      }
      if (
        existing.status === OrderStatus.CANCELLED ||
        existing.status === OrderStatus.DELIVERED ||
        existing.status === OrderStatus.SHIPPED
      ) {
        throw new BadRequestException('Cannot update order in current status');
      }
    }

    const { items, promotionCode, address, ...rest } = dto;
    type MutableOrderFields = Partial<Omit<CreateOrderDto, 'items' | 'promotionCode' | 'address'>>;
    const restPayload: MutableOrderFields = { ...rest };

    const previousStatus = existing.status;

    const targetUserId = existing.userId ?? undefined;
    const targetBranchId = restPayload.branchId ?? existing.branchId ?? undefined;
    const resolvedAddressId = await this.resolveAddressId({
      providedAddressId: restPayload.addressId,
      addressPayload: address,
      userId: targetUserId,
    });

    const effectiveAddressId = resolvedAddressId ?? existing.addressId ?? undefined;

    await this.validateRelations({
      userId: targetUserId,
      branchId: targetBranchId,
      addressId: effectiveAddressId,
    });

    let pricing: PricingSummary | null = null;

    if (items && items.length > 0) {
      pricing = await this.pricingService.calculate({
        items,
        promotionCode,
        branchId: targetBranchId,
        addressId: effectiveAddressId,
        userId: targetUserId,
      });
    }

    const merged = this.repo.merge(existing, restPayload);

    merged.addressId = resolvedAddressId ?? existing.addressId ?? null;

    merged.status = merged.status ?? OrderStatus.PENDING;
    merged.paymentMethod = merged.paymentMethod ?? PaymentMethod.COD;

    const statusChanged = merged.status !== previousStatus;

    if (pricing) {
      const autoGiftLines = await this.resolveAutoGiftLines(pricing);
      const giftTotals = this.calculateGiftTotals(autoGiftLines);

      merged.subTotal = this.roundMoney(pricing.totals.subTotal + giftTotals.subTotal);
      merged.discountTotal = this.roundMoney(
        pricing.totals.discountTotal + giftTotals.discountTotal,
      );
      merged.shippingFee = pricing.totals.shippingFee;
      merged.taxTotal = pricing.totals.taxTotal;
      merged.totalAmount = pricing.totals.totalAmount;

      const saved = await this.repo.save(merged);

      await this.orderItemRepo.delete({ orderId: saved.id });
      await this.saveOrderItems(saved.id, pricing, autoGiftLines);

      const userId = saved.userId;
      if (statusChanged && typeof userId === 'number') {
        await this.notifyUserOrderStatusChanged({
          userId,
          orderId: saved.id,
          orderNumber: saved.orderNumber ?? '',
          status: saved.status,
          totalAmount: saved.totalAmount,
        });
      }

      return this.findOne(saved.id, requester);
    }

    const saved = await this.repo.save(merged);

    const userId = saved.userId;
    if (statusChanged && typeof userId === 'number') {
      await this.notifyUserOrderStatusChanged({
        userId,
        orderId: saved.id,
        orderNumber: saved.orderNumber ?? '',
        status: saved.status,
        totalAmount: saved.totalAmount,
      });
    }

    return this.findOne(saved.id, requester);
  }

  async remove(id: number) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    await this.repo.delete(id);
    return { success: true };
  }

  private async saveOrderItems(
    orderId: number,
    pricing: PricingSummary,
    autoGifts: AutoGiftLine[] = [],
  ) {
    if (pricing.items.length === 0 && autoGifts.length === 0) {
      return;
    }

    const giftVariantIds = this.collectGiftVariantIds(pricing);

    const persistedItems = pricing.items.map((item) =>
      this.orderItemRepo.create({
        orderId,
        variantId: item.variantId,
        quantity: item.quantity,
        subTotal: item.subTotal,
        discountTotal: item.discountTotal,
        totalAmount: item.totalAmount,
        isGift: giftVariantIds.has(item.variantId) && item.totalAmount === 0,
      }),
    );

    autoGifts.forEach((gift) => {
      const subTotal = this.roundMoney(gift.variant.price * gift.quantity);
      persistedItems.push(
        this.orderItemRepo.create({
          orderId,
          variantId: gift.variant.id,
          quantity: gift.quantity,
          subTotal,
          discountTotal: subTotal,
          totalAmount: 0,
          isGift: true,
        }),
      );
    });

    if (persistedItems.length > 0) {
      await this.orderItemRepo.save(persistedItems);
    }
  }

  private async removePurchasedCartItems(
    userId: number,
    items: Array<{ variantId?: number | string | null; quantity: number }> = [],
  ) {
    if (!userId || !items.length) {
      return;
    }

    const cart = await this.cartRepo.findOne({
      where: { userId },
      relations: { items: true },
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return;
    }

    const remainingByVariant = new Map<number, number>();

    for (const item of items) {
      let variantIdNumber: number | null = null;

      if (typeof item.variantId === 'number') {
        variantIdNumber = item.variantId;
      } else if (typeof item.variantId === 'string' && item.variantId.trim()) {
        const parsed = Number(item.variantId);
        variantIdNumber = Number.isNaN(parsed) ? null : parsed;
      }

      if (!variantIdNumber) {
        continue;
      }

      const current = remainingByVariant.get(variantIdNumber) ?? 0;
      remainingByVariant.set(variantIdNumber, current + Math.max(0, item.quantity));
    }

    if (!remainingByVariant.size) {
      return;
    }

    const itemsToUpdate: CartItem[] = [];
    const itemIdsToRemove: number[] = [];

    for (const cartItem of cart.items) {
      const variantId = cartItem.variantId ?? undefined;
      if (!variantId) {
        continue;
      }

      const remaining = remainingByVariant.get(variantId);
      if (!remaining || remaining <= 0) {
        continue;
      }

      if (cartItem.quantity <= remaining) {
        itemIdsToRemove.push(cartItem.id);
        remainingByVariant.set(variantId, remaining - cartItem.quantity);
      } else {
        cartItem.quantity = cartItem.quantity - remaining;
        remainingByVariant.set(variantId, 0);
        itemsToUpdate.push(cartItem);
      }
    }

    if (itemIdsToRemove.length > 0) {
      await this.cartItemRepo.delete(itemIdsToRemove);
    }

    if (itemsToUpdate.length > 0) {
      await this.cartItemRepo.save(itemsToUpdate);
    }
  }

  private async resolveAutoGiftLines(pricing: PricingSummary): Promise<AutoGiftLine[]> {
    const productQuantities = new Map<number, number>();

    for (const promotion of pricing.appliedPromotions ?? []) {
      if (promotion.comboType !== ComboType.BUY_X_GET_Y) {
        continue;
      }

      for (const suggestion of promotion.suggestions ?? []) {
        if (!suggestion.autoAdd || suggestion.missingQuantity <= 0) {
          continue;
        }

        const current = productQuantities.get(suggestion.productId) ?? 0;
        productQuantities.set(suggestion.productId, current + suggestion.missingQuantity);
      }
    }

    if (!productQuantities.size) {
      return [];
    }

    const results: AutoGiftLine[] = [];

    for (const [productId, quantity] of productQuantities) {
      let variant = await this.variantRepo.findOne({
        where: { productId, status: ProductVariantStatus.ACTIVE },
        order: { id: 'ASC' },
      });

      if (!variant) {
        variant = await this.variantRepo.findOne({
          where: { productId },
          order: { id: 'ASC' },
        });
      }

      if (!variant) {
        throw new BadRequestException(
          `Không tìm thấy biến thể phù hợp để thêm quà tặng cho sản phẩm ${productId}.`,
        );
      }

      results.push({ variant, quantity });
    }

    return results;
  }

  private calculateGiftTotals(gifts: AutoGiftLine[]): { subTotal: number; discountTotal: number } {
    return gifts.reduce(
      (acc, gift) => {
        const subTotal = this.roundMoney(gift.variant.price * gift.quantity);
        return {
          subTotal: this.roundMoney(acc.subTotal + subTotal),
          discountTotal: this.roundMoney(acc.discountTotal + subTotal),
        };
      },
      { subTotal: 0, discountTotal: 0 },
    );
  }

  private collectGiftVariantIds(pricing: PricingSummary): Set<number> {
    const ids = new Set<number>();

    for (const promotion of pricing.appliedPromotions ?? []) {
      if (promotion.comboType !== ComboType.BUY_X_GET_Y) {
        continue;
      }

      for (const item of promotion.items ?? []) {
        if (item.isGift && typeof item.variantId === 'number') {
          ids.add(item.variantId);
        }
      }
    }

    return ids;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async validateRelations(payload: {
    userId?: number;
    branchId?: number;
    addressId?: number;
  }) {
    const { userId, branchId, addressId } = payload;

    if (userId !== undefined) {
      const exists = await this.userRepo.exist({ where: { id: userId } });

      if (!exists) {
        throw new BadRequestException(`User ${userId} not found`);
      }
    }

    if (branchId !== undefined) {
      const exists = await this.branchRepo.exist({ where: { id: branchId } });

      if (!exists) {
        throw new BadRequestException(`Branch ${branchId} not found`);
      }
    }

    if (addressId !== undefined && addressId !== null) {
      const exists = await this.addressRepo.exist({ where: { id: addressId } });

      if (!exists) {
        throw new BadRequestException(`Address ${addressId} not found`);
      }
    }
  }

  private async resolveAddressId(params: {
    providedAddressId?: number;
    addressPayload?: CreateAddressDto;
    userId?: number;
  }): Promise<number | null> {
    if (params.providedAddressId) {
      return params.providedAddressId;
    }

    if (!params.addressPayload) {
      return null;
    }

    const payload: CreateAddressDto = {
      ...params.addressPayload,
      userId: params.addressPayload.userId ?? params.userId,
    };

    const created = await this.addressesService.create(payload);

    return created.id;
  }

  private generateOrderNumber() {
    const now = new Date();
    const stamp = `${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    return `ORD-${stamp}-${random}`;
  }

  private logNotificationError(error: unknown, context: string) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Failed to ${context}: ${message}`,
      error instanceof Error ? error.stack : undefined,
    );
  }

  private async notifyAdminsOrderCreated(payload: OrderCreatedAdminPayload) {
    try {
      await this.notificationsService.notifyAdminsOrderCreated(payload);
    } catch (error: unknown) {
      this.logNotificationError(error, 'notify admins order created');
    }
  }

  private async notifyUserOrderStatusChanged(payload: OrderStatusChangedPayload) {
    try {
      await this.notificationsService.notifyUserOrderStatusChanged(payload);
    } catch (error: unknown) {
      this.logNotificationError(error, 'notify user order status updated');
    }
  }

  async ensureOrderBelongsToUserOrFail(orderId: number, userId: number) {
    const order = await this.repo.findOne({
      where: { id: orderId },
      select: { id: true, userId: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('Customers can only manage their own orders.');
    }
  }

  private ensureCustomerOwnership(order: Order, requester?: RequestUserContext) {
    if (!requester || requester.role !== UserRole.CUSTOMER) {
      return;
    }

    if (order.userId !== requester.id) {
      throw new ForbiddenException('Customers can only manage their own orders.');
    }
  }
}
