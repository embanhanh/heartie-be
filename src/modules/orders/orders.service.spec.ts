import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { OrdersService } from './orders.service';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { UserRole } from '../users/entities/user.entity';
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
import { MomoService } from '../momo/momo.service';

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

    const momoService: Partial<MomoService> = {
      createPayment: jest.fn(),
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
      momoService as MomoService,
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

describe('OrdersService - permissions (complete coverage)', () => {
  const createService = () => {
    const orderRepo: MockRepo<Order> = {
      findOne: jest.fn(),
      save: jest.fn(),
      merge: jest.fn((existing: Order, partial: Partial<Order>) => ({ ...existing, ...partial })),
    };
    const orderItemRepo: MockRepo<OrderItem> = {
      delete: jest.fn(),
      save: jest.fn(),
      create: jest.fn((payload) => payload as OrderItem),
    };
    const cartRepo: MockRepo<Cart> = {};
    const cartItemRepo: MockRepo<CartItem> = {};
    const userRepo: MockRepo<User> = { exist: jest.fn(() => Promise.resolve(true)) };
    const branchRepo: MockRepo<Branch> = { exist: jest.fn(() => Promise.resolve(true)) };
    const addressRepo: MockRepo<Address> = {
      exist: jest.fn(() => Promise.resolve(true)),
      find: jest.fn(),
    };
    const variantRepo: MockRepo<ProductVariant> = {};
    const addressesService: Partial<AddressesService> = { create: jest.fn() };
    const pricingService: Partial<PricingService> = { calculate: jest.fn() };
    const notificationsService = { notifyUserOrderStatusChanged: jest.fn() };
    const momoService: Partial<MomoService> = { createPayment: jest.fn() };

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
      pricingService as unknown as PricingService,
      notificationsService as unknown as NotificationsService,
      momoService as MomoService,
    );

    return { service, orderRepo, userRepo, branchRepo, addressRepo };
  };

  // ============================================================================
  // VIEW ORDER DETAILS (findOne) - Matching TC-27 to TC-34
  // ============================================================================
  describe('findOne (View Order Details)', () => {
    describe('permission checks', () => {
      it('allows customer to view their own order', async () => {
        const { service, orderRepo } = createService();
        const order = { id: 123, userId: 100, orderNumber: 'ORD-123' } as Order;
        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);

        const requester = { id: 100, role: UserRole.CUSTOMER };
        const result = await service.findOne(123, requester);

        expect(result).toEqual(order);
      });

      it('throws Forbidden when customer views other customer order', async () => {
        const { service, orderRepo } = createService();
        const order = { id: 456, userId: 200, orderNumber: 'ORD-456' } as Order;
        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);

        const requester = { id: 100, role: UserRole.CUSTOMER };

        await expect(service.findOne(456, requester)).rejects.toThrow(ForbiddenException);
      });

      it('allows admin to view any order regardless of ownership', async () => {
        const { service, orderRepo } = createService();
        const order = { id: 456, userId: 200, orderNumber: 'ORD-456' } as Order;
        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);

        const requester = { id: 999, role: UserRole.ADMIN };
        const result = await service.findOne(456, requester);

        expect(result).toEqual(order);
      });

      it('allows shop owner to view any order', async () => {
        const { service, orderRepo } = createService();
        const order = { id: 456, userId: 200 } as Order;
        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);

        const requester = { id: 50, role: UserRole.SHOP_OWNER };
        const result = await service.findOne(456, requester);

        expect(result).toEqual(order);
      });
    });

    describe('validation checks', () => {
      it('throws BadRequest for null order ID', async () => {
        const { service } = createService();
        const requester = { id: 100, role: UserRole.CUSTOMER };

        await expect(service.findOne(null as unknown as number, requester)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('throws BadRequest for zero order ID', async () => {
        const { service } = createService();
        const requester = { id: 100, role: UserRole.CUSTOMER };

        await expect(service.findOne(0, requester)).rejects.toThrow(BadRequestException);
      });

      it('throws NotFound when order does not exist', async () => {
        const { service, orderRepo } = createService();
        (orderRepo.findOne as jest.Mock).mockResolvedValue(null);

        const requester = { id: 100, role: UserRole.CUSTOMER };

        await expect(service.findOne(9999, requester)).rejects.toThrow(NotFoundException);
      });
    });
  });

  // ============================================================================
  // UPDATE ORDER - Matching TC-35 to TC-46
  // ============================================================================
  describe('update', () => {
    describe('permission checks', () => {
      it('allows customer to update their own order', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 123,
          userId: 100,
          status: OrderStatus.PENDING,
          branchId: 1,
          addressId: 1,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);
        (orderRepo.save as jest.Mock).mockResolvedValue({ ...order, note: 'Updated' });

        const requester = { id: 100, role: UserRole.CUSTOMER };
        const result = await service.update(123, { note: 'Updated' }, requester);

        expect(result).toBeDefined();
        expect(orderRepo.save).toHaveBeenCalled();
      });

      it('throws Forbidden when customer updates other customer order', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 456,
          userId: 200,
          status: OrderStatus.PENDING,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);

        const requester = { id: 100, role: UserRole.CUSTOMER };

        await expect(service.update(456, { note: 'Try to update' }, requester)).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('allows admin to update any order', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 456,
          userId: 200,
          status: OrderStatus.PENDING,
          branchId: 1,
          addressId: 1,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);
        (orderRepo.save as jest.Mock).mockResolvedValue({
          ...order,
          status: OrderStatus.CONFIRMED,
        });

        const requester = { id: 999, role: UserRole.ADMIN };
        const result = await service.update(456, { status: OrderStatus.CONFIRMED }, requester);

        expect(result).toBeDefined();
      });

      it('prevents customer from changing order status', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 123,
          userId: 100,
          status: OrderStatus.PENDING,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);

        const requester = { id: 100, role: UserRole.CUSTOMER };

        await expect(
          service.update(123, { status: OrderStatus.CONFIRMED }, requester),
        ).rejects.toThrow(ForbiddenException);
      });

      it('allows staff to update orders within their branch', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 123,
          userId: 100,
          status: OrderStatus.PENDING,
          branchId: 5,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);
        (orderRepo.save as jest.Mock).mockResolvedValue(order);

        const requester = { id: 50, role: UserRole.STAFF, branchId: 5 };
        const result = await service.update(123, { status: OrderStatus.CONFIRMED }, requester);

        expect(result).toBeDefined();
      });
    });

    describe('validation checks', () => {
      it('throws NotFound when updating non-existent order', async () => {
        const { service, orderRepo } = createService();
        (orderRepo.findOne as jest.Mock).mockResolvedValue(null);

        const requester = { id: 999, role: UserRole.ADMIN };

        await expect(service.update(9999, { note: 'Update' }, requester)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('throws error when userId does not exist', async () => {
        const { service, orderRepo, userRepo } = createService();
        const order = {
          id: 123,
          userId: 100,
          status: OrderStatus.PENDING,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);
        (userRepo.exist as jest.Mock).mockResolvedValue(false);

        const updateDto = {
          status: OrderStatus.CONFIRMED,
        };

        const requester = { id: 999, role: UserRole.ADMIN };

        await expect(service.update(123, updateDto, requester)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('throws error when branchId does not exist', async () => {
        const { service, orderRepo, branchRepo } = createService();
        const order = {
          id: 123,
          userId: 100,
          status: OrderStatus.PENDING,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);
        (branchRepo.exist as jest.Mock).mockResolvedValue(false);

        const requester = { id: 999, role: UserRole.ADMIN };

        await expect(service.update(123, { branchId: 9999 }, requester)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('throws error when addressId does not exist', async () => {
        const { service, orderRepo, addressRepo } = createService();
        const order = {
          id: 123,
          userId: 100,
          status: OrderStatus.PENDING,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);
        (addressRepo.exist as jest.Mock).mockResolvedValue(false);

        const requester = { id: 999, role: UserRole.ADMIN };

        await expect(service.update(123, { addressId: 9999 }, requester)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('edge cases', () => {
      it('prevents update of cancelled orders', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 123,
          userId: 100,
          status: OrderStatus.CANCELLED,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);

        const requester = { id: 100, role: UserRole.CUSTOMER };

        await expect(service.update(123, { note: 'Try to update' }, requester)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('prevents update of delivered orders by customer', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 123,
          userId: 100,
          status: OrderStatus.DELIVERED,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);

        const requester = { id: 100, role: UserRole.CUSTOMER };

        await expect(service.update(123, { note: 'Try to update' }, requester)).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  describe('requestCancellation', () => {
    describe('permission checks', () => {
      it('allows customer to cancel their own pending order', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 123,
          orderNumber: 'ORD-123',
          userId: 100,
          status: OrderStatus.PENDING,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);
        (orderRepo.save as jest.Mock).mockResolvedValue({
          ...order,
          status: OrderStatus.CANCELLED,
        });

        const requester = { id: 100, role: UserRole.CUSTOMER };
        const result = await service.requestCancellation('ORD-123', requester);

        expect(result.status).toBe(OrderStatus.CANCELLED);
        expect(result.message).toContain('successfully');
      });

      it('throws Forbidden when customer cancels other customer order', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 456,
          orderNumber: 'ORD-456',
          userId: 200,
          status: OrderStatus.PENDING,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);

        const requester = { id: 100, role: UserRole.CUSTOMER };

        await expect(service.requestCancellation('ORD-456', requester)).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('allows admin to cancel any order regardless of ownership', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 456,
          orderNumber: 'ORD-456',
          userId: 200,
          status: OrderStatus.PENDING,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);
        (orderRepo.save as jest.Mock).mockResolvedValue({
          ...order,
          status: OrderStatus.CANCELLED,
        });

        const requester = { id: 999, role: UserRole.ADMIN };
        const result = await service.requestCancellation('ORD-456', requester);

        expect(result.status).toBe(OrderStatus.CANCELLED);
      });
    });

    describe('status restrictions', () => {
      it('throws error when cancelling CONFIRMED order (not PENDING)', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 123,
          orderNumber: 'ORD-123',
          userId: 100,
          status: OrderStatus.CONFIRMED,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);

        const requester = { id: 100, role: UserRole.CUSTOMER };

        await expect(service.requestCancellation('ORD-123', requester)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('throws error when cancelling DELIVERED order', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 123,
          orderNumber: 'ORD-123',
          userId: 100,
          status: OrderStatus.DELIVERED,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);

        const requester = { id: 100, role: UserRole.CUSTOMER };

        await expect(service.requestCancellation('ORD-123', requester)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('returns message when order is already CANCELLED', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 123,
          orderNumber: 'ORD-123',
          userId: 100,
          status: OrderStatus.CANCELLED,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);

        const requester = { id: 100, role: UserRole.CUSTOMER };
        const result = await service.requestCancellation('ORD-123', requester);

        expect(result.status).toBe(OrderStatus.CANCELLED);
        expect(result.message).toContain('already cancelled');
        expect(orderRepo.save).not.toHaveBeenCalled();
      });

      it('allows admin to cancel even SHIPPED orders', async () => {
        const { service, orderRepo } = createService();
        const order = {
          id: 123,
          orderNumber: 'ORD-123',
          userId: 100,
          status: OrderStatus.SHIPPED,
        } as Order;

        (orderRepo.findOne as jest.Mock).mockResolvedValue(order);
        (orderRepo.save as jest.Mock).mockResolvedValue({
          ...order,
          status: OrderStatus.CANCELLED,
        });

        const requester = { id: 999, role: UserRole.ADMIN };
        const result = await service.requestCancellation('ORD-123', requester);

        expect(result.status).toBe(OrderStatus.CANCELLED);
      });
    });

    describe('validation checks', () => {
      it('throws NotFound when cancelling non-existent order', async () => {
        const { service, orderRepo } = createService();
        (orderRepo.findOne as jest.Mock).mockResolvedValue(null);

        const requester = { id: 100, role: UserRole.CUSTOMER };

        await expect(service.requestCancellation('ORD-9999', requester)).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });
});
