import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { OrdersService } from './orders.service';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { OrderItem } from '../order_items/entities/order-item.entity';
import { User } from '../users/entities/user.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Address } from '../addresses/entities/address.entity';
import { Cart } from '../carts/entities/cart.entity';
import { CartItem } from '../cart_items/entities/cart-item.entity';
import {
  ProductVariant,
  ProductVariantStatus,
} from '../product_variants/entities/product_variant.entity';
import { PricingService } from '../pricing/pricing.service';
import { PricingSummary, PromotionAdjustment } from '../pricing/types/pricing.types';
import { ComboType, PromotionType } from '../promotions/entities/promotion.entity';
import { AddressesService } from '../addresses/addresses.service';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  NotificationDispatchResult,
  NotificationsService,
} from '../notifications/notifications.service';

type MockRepo<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('OrdersService - auto gift handling', () => {
  const createService = (pricingSummary: PricingSummary) => {
    const orderRepo: MockRepo<Order> = {
      create: jest.fn((payload: Partial<Order>) => ({ ...payload }) as Order),
      save: jest.fn((entity: Order) => {
        const saved = { ...entity, id: 1 } as Order;
        return Promise.resolve(saved);
      }),
      findOne: jest.fn(() => Promise.resolve({ id: 1 } as Order)),
      merge: jest.fn((existing: Order, partial: Partial<Order>) => {
        return { ...existing, ...partial } as Order;
      }),
    };

    const orderItemRepo: MockRepo<OrderItem> = {
      create: jest.fn((payload: Partial<OrderItem>) => payload as OrderItem),
      save: jest.fn((items: OrderItem[]) => Promise.resolve(items)),
    };

    const cartRepo: MockRepo<Cart> = {
      findOne: jest.fn(() => Promise.resolve({ items: [] } as unknown as Cart)),
    };

    const cartItemRepo: MockRepo<CartItem> = {
      delete: jest.fn(() => Promise.resolve({})),
      save: jest.fn((items: CartItem[]) => Promise.resolve(items)),
    };

    const userRepo: MockRepo<User> = {
      exist: jest.fn(() => Promise.resolve(true)),
    };

    const branchRepo: MockRepo<Branch> = {
      exist: jest.fn(() => Promise.resolve(true)),
    };

    const addressRepo: MockRepo<Address> = {
      exist: jest.fn(() => Promise.resolve(true)),
    };

    const variantRepo: MockRepo<ProductVariant> = {
      findOne: jest.fn(() =>
        Promise.resolve({
          id: 99,
          productId: 202,
          price: 100,
          status: ProductVariantStatus.ACTIVE,
        } as ProductVariant),
      ),
    };

    const pricingService: Partial<PricingService> = {
      calculate: jest.fn(() => Promise.resolve(pricingSummary)),
    };

    const addressesService: Partial<AddressesService> = {
      create: jest.fn(),
    };

    const mockDispatchResult: NotificationDispatchResult = {
      success: true,
      targetedReceivers: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      topicSent: false,
    };

    type NotificationsServiceStub = Pick<
      NotificationsService,
      'notifyAdminsOrderCreated' | 'notifyUserOrderStatusChanged'
    >;

    const notificationsService: jest.Mocked<NotificationsServiceStub> = {
      notifyAdminsOrderCreated: jest.fn<
        Promise<NotificationDispatchResult>,
        [Parameters<NotificationsServiceStub['notifyAdminsOrderCreated']>[0]]
      >(() => Promise.resolve(mockDispatchResult)),
      notifyUserOrderStatusChanged: jest.fn<
        Promise<NotificationDispatchResult>,
        [Parameters<NotificationsServiceStub['notifyUserOrderStatusChanged']>[0]]
      >(() => Promise.resolve(mockDispatchResult)),
    };

    const service = new OrdersService(
      orderRepo as unknown as Repository<Order>,
      orderItemRepo as unknown as Repository<OrderItem>,
      cartRepo as unknown as Repository<Cart>,
      cartItemRepo as unknown as Repository<CartItem>,
      userRepo as unknown as Repository<User>,
      branchRepo as unknown as Repository<Branch>,
      addressRepo as unknown as Repository<Address>,
      variantRepo as unknown as Repository<ProductVariant>,
      addressesService as AddressesService,
      pricingService as PricingService,
      notificationsService as unknown as NotificationsService,
    );

    return {
      service,
      orderRepo,
      orderItemRepo,
      cartRepo,
      cartItemRepo,
      variantRepo,
      pricingService,
      notificationsService,
    };
  };

  const buildAutoGiftPromotion = (): PromotionAdjustment => ({
    promotionId: 10,
    promotionName: 'Buy X Get Y',
    promotionType: PromotionType.COMBO,
    comboType: ComboType.BUY_X_GET_Y,
    couponType: null,
    level: 'AUTO',
    amount: 0,
    description: null,
    metadata: {},
    items: [],
    suggestions: [
      {
        productId: 202,
        requiredQuantity: 1,
        currentQuantity: 0,
        missingQuantity: 1,
        potentialDiscount: null,
        message: 'Thêm 1 sản phẩm để nhận ưu đãi',
        productName: 'Gift Product',
        productImage: null,
        productPrice: 100,
        autoAdd: true,
      },
    ],
  });

  const basePricingSummary: PricingSummary = {
    items: [
      {
        variantId: 1,
        quantity: 2,
        unitPrice: 100,
        subTotal: 200,
        discountTotal: 20,
        totalAmount: 180,
        isInCombo: true,
        appliedPromotions: [],
        variant: {
          id: 1,
          name: 'Main Item',
          image: null,
          productId: 101,
          productName: 'Main Product',
        },
      },
    ],
    totals: {
      subTotal: 200,
      autoDiscountTotal: 20,
      couponDiscountTotal: 0,
      discountTotal: 20,
      shippingFee: 0,
      taxTotal: 0,
      totalAmount: 180,
    },
    context: {},
    appliedPromotions: [buildAutoGiftPromotion()],
    meta: {
      totalAutoDiscount: 20,
      totalCouponDiscount: 0,
    },
  };

  it('automatically adds gift variants with zero payable amount', async () => {
    const { service, orderRepo, orderItemRepo, variantRepo, notificationsService } =
      createService(basePricingSummary);

    const dto: CreateOrderDto = {
      items: [
        {
          variantId: 1,
          quantity: 2,
        },
      ],
    } as CreateOrderDto;

    await service.create(dto);

    expect(variantRepo.findOne).toHaveBeenCalledWith({
      where: { productId: 202, status: ProductVariantStatus.ACTIVE },
      order: { id: 'ASC' },
    });

    expect(orderRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        subTotal: 300,
        discountTotal: 120,
      }),
    );

    expect(orderItemRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          variantId: 99,
          isGift: true,
          totalAmount: 0,
          subTotal: 100,
          discountTotal: 100,
        }),
      ]),
    );

    expect(notificationsService.notifyAdminsOrderCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 1,
        totalAmount: 180,
      }),
    );
  });

  it('throws when no variant is available for auto gift', async () => {
    const { service, variantRepo } = createService(basePricingSummary);

    const variantMock = variantRepo.findOne as jest.Mock;
    variantMock.mockResolvedValueOnce(null);
    variantMock.mockResolvedValueOnce(null);

    const dto: CreateOrderDto = {
      items: [
        {
          variantId: 1,
          quantity: 2,
        },
      ],
    } as CreateOrderDto;

    await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('notifies the user when order status changes', async () => {
    const { service, orderRepo, notificationsService } = createService(basePricingSummary);

    const existingOrder = {
      id: 42,
      status: OrderStatus.PENDING,
      userId: 7,
      branchId: null,
      addressId: null,
      paymentMethod: PaymentMethod.COD,
      items: [],
      orderNumber: 'ORD-0001',
      totalAmount: 250,
    } as unknown as Order;

    const findOneMock = orderRepo.findOne as jest.Mock;
    findOneMock.mockResolvedValueOnce(existingOrder);
    findOneMock.mockResolvedValueOnce({
      ...existingOrder,
      status: OrderStatus.CONFIRMED,
    });

    (orderRepo.save as jest.Mock).mockImplementation((entity: Order) => ({
      ...existingOrder,
      ...entity,
    }));

    await service.update(42, { status: OrderStatus.CONFIRMED });

    expect(notificationsService.notifyUserOrderStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        orderId: 42,
        status: OrderStatus.CONFIRMED,
      }),
    );
  });
});
