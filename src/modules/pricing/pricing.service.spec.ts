import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  ApplyScope,
  ComboType,
  CouponType,
  DiscountType,
  Promotion,
  PromotionType,
} from '../promotions/entities/promotion.entity';
import {
  PromotionCondition,
  PromotionConditionRole,
} from '../promotion_conditions/entities/promotion-condition.entity';
import { Product, ProductStatus } from '../products/entities/product.entity';
import {
  ProductVariant,
  ProductVariantStatus,
} from '../product_variants/entities/product_variant.entity';
import { UserCustomerGroup } from '../user_customer_groups/entities/user-customer-group.entity';
import { PricingService } from './pricing.service';

type MockRepo<T extends object> = Partial<jest.Mocked<Repository<T>>>;

describe('PricingService', () => {
  const now = new Date();

  const createServiceDependencies = () => {
    const variantRepo: MockRepo<ProductVariant> = {
      find: jest.fn(),
    };
    const promotionRepo: MockRepo<Promotion> = {
      find: jest.fn(),
    };
    const userCustomerGroupRepo: MockRepo<UserCustomerGroup> = {
      find: jest.fn(),
    };

    const service = new PricingService(
      variantRepo as Repository<ProductVariant>,
      promotionRepo as Repository<Promotion>,
      userCustomerGroupRepo as Repository<UserCustomerGroup>,
    );

    return { service, variantRepo, promotionRepo, userCustomerGroupRepo };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createProduct = (overrides: Partial<Product> = {}): Product => ({
    id: overrides.id ?? 0,
    name: overrides.name ?? 'Product',
    brandId: overrides.brandId ?? null,
    categoryId: overrides.categoryId ?? null,
    description: overrides.description ?? undefined,
    image: overrides.image ?? undefined,
    originalPrice: overrides.originalPrice ?? 0,
    stock: overrides.stock ?? 0,
    status: overrides.status ?? ProductStatus.ACTIVE,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    brand: overrides.brand,
    category: overrides.category,
    variants: overrides.variants ?? [],
    productAttributes: overrides.productAttributes ?? [],
    ratings: overrides.ratings ?? [],
    embedding: overrides.embedding ?? null,
    rating: overrides.rating ?? 0,
  });

  const createVariant = (overrides: Partial<ProductVariant>): ProductVariant => ({
    id: overrides.id ?? 1,
    productId: overrides.productId ?? 1,
    price: overrides.price ?? 0,
    image: overrides.image ?? undefined,
    weight: overrides.weight ?? undefined,
    status: overrides.status ?? ProductVariantStatus.ACTIVE,
    extra: overrides.extra ?? {},
    createdAt: now,
    updatedAt: now,
    product:
      overrides.product ?? createProduct({ id: overrides.productId ?? 1, name: 'Variant Product' }),
    inventories: [],
    attributeValues: [],
  });

  const createCondition = (overrides: Partial<PromotionCondition>): PromotionCondition => ({
    id: overrides.id ?? 0,
    promotionId: overrides.promotionId ?? 0,
    promotion: overrides.promotion ?? ({} as Promotion),
    productId: overrides.productId ?? 0,
    product: overrides.product ?? createProduct({ id: overrides.productId }),
    quantity: overrides.quantity ?? 1,
    role: overrides.role ?? PromotionConditionRole.BUY,
  });

  const createPromotion = (overrides: Partial<Promotion>): Promotion => ({
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Promotion',
    code: overrides.code ?? null,
    description: overrides.description ?? null,
    type: overrides.type ?? PromotionType.COMBO,
    comboType: overrides.comboType ?? null,
    couponType: overrides.couponType ?? null,
    discountValue: overrides.discountValue ?? 0,
    discountType: overrides.discountType ?? DiscountType.PERCENT,
    startDate: overrides.startDate ?? now,
    endDate: overrides.endDate ?? now,
    minOrderValue: overrides.minOrderValue ?? 0,
    maxDiscount: overrides.maxDiscount ?? null,
    usageLimit: overrides.usageLimit ?? null,
    usedCount: overrides.usedCount ?? 0,
    applyScope: overrides.applyScope ?? ApplyScope.GLOBAL,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    conditions: overrides.conditions ?? [],
    branches: overrides.branches ?? [],
    customerGroups: overrides.customerGroups ?? [],
  });

  it('calculates automatic combo discount for qualifying items', async () => {
    const { service, variantRepo, promotionRepo, userCustomerGroupRepo } =
      createServiceDependencies();

    variantRepo.find!.mockResolvedValue([
      createVariant({
        id: 1,
        productId: 101,
        price: 100,
        product: createProduct({ id: 101, name: 'Combo Item' }),
      }),
    ]);
    userCustomerGroupRepo.find!.mockResolvedValue([]);

    const comboPromotion = createPromotion({
      id: 99,
      name: 'Buy 2 Save 10%',
      type: PromotionType.COMBO,
      comboType: ComboType.PRODUCT_COMBO,
      discountType: DiscountType.PERCENT,
      discountValue: 10,
      conditions: [
        createCondition({
          promotionId: 99,
          productId: 101,
          quantity: 2,
          role: PromotionConditionRole.BUY,
        }),
      ],
    });

    promotionRepo.find!.mockResolvedValue([comboPromotion]);

    const summary = await service.calculateFromItems(
      [
        {
          variantId: 1,
          quantity: 2,
        },
      ],
      {},
    );

    expect(summary.totals.subTotal).toBe(200);
    expect(summary.totals.autoDiscountTotal).toBe(20);
    expect(summary.totals.totalAmount).toBe(180);
    expect(summary.appliedPromotions).toHaveLength(1);
    expect(summary.appliedPromotions[0].amount).toBe(20);
    expect(summary.items[0].isInCombo).toBe(true);
  });

  it('allocates BUY_X_GET_Y discount to gift items only', async () => {
    const { service, variantRepo, promotionRepo, userCustomerGroupRepo } =
      createServiceDependencies();

    variantRepo.find!.mockResolvedValue([
      createVariant({
        id: 10,
        productId: 501,
        price: 200,
        product: createProduct({ id: 501, name: 'Buy Item' }),
      }),
      createVariant({
        id: 11,
        productId: 502,
        price: 150,
        product: createProduct({ id: 502, name: 'Gift Item' }),
      }),
    ]);
    userCustomerGroupRepo.find!.mockResolvedValue([]);

    const promotion = createPromotion({
      id: 777,
      name: 'Buy 2 Get 1',
      type: PromotionType.COMBO,
      comboType: ComboType.BUY_X_GET_Y,
      discountType: DiscountType.PERCENT,
      discountValue: 100,
      conditions: [
        createCondition({
          promotionId: 777,
          productId: 501,
          quantity: 2,
          role: PromotionConditionRole.BUY,
          product: createProduct({ id: 501, name: 'Buy Item' }),
        }),
        createCondition({
          promotionId: 777,
          productId: 502,
          quantity: 1,
          role: PromotionConditionRole.GET,
          product: createProduct({
            id: 502,
            name: 'Gift Item',
            image: 'https://cdn.example.com/gift.jpg',
            originalPrice: 150,
          }),
        }),
      ],
    });

    promotionRepo.find!.mockResolvedValue([promotion]);

    const summary = await service.calculateFromItems(
      [
        {
          variantId: 10,
          quantity: 2,
        },
        {
          variantId: 11,
          quantity: 1,
        },
      ],
      {},
    );

    expect(summary.totals.subTotal).toBe(550);
    expect(summary.totals.autoDiscountTotal).toBe(150);
    expect(summary.totals.totalAmount).toBe(400);
    expect(summary.appliedPromotions).toHaveLength(1);
    expect(summary.appliedPromotions[0].amount).toBe(150);
    expect(summary.appliedPromotions[0].items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantId: 11,
          discountAmount: 150,
          isGift: true,
        }),
        expect.objectContaining({
          variantId: 10,
          discountAmount: 0,
        }),
      ]),
    );

    const giftLine = summary.items.find((item) => item.variantId === 11)!;
    const buyLine = summary.items.find((item) => item.variantId === 10)!;

    expect(giftLine.discountTotal).toBe(150);
    expect(giftLine.totalAmount).toBe(0);
    expect(buyLine.discountTotal).toBe(0);
    expect(buyLine.isInCombo).toBe(true);
  });

  it('suggests missing gift items for incomplete BUY_X_GET_Y combos', async () => {
    const { service, variantRepo, promotionRepo, userCustomerGroupRepo } =
      createServiceDependencies();

    variantRepo.find!.mockResolvedValue([
      createVariant({
        id: 20,
        productId: 601,
        price: 180,
        product: createProduct({ id: 601, name: 'Buy Item' }),
      }),
    ]);
    userCustomerGroupRepo.find!.mockResolvedValue([]);

    const promotion = createPromotion({
      id: 778,
      name: 'Incomplete Gift',
      type: PromotionType.COMBO,
      comboType: ComboType.BUY_X_GET_Y,
      discountType: DiscountType.PERCENT,
      discountValue: 100,
      conditions: [
        createCondition({
          promotionId: 778,
          productId: 601,
          quantity: 2,
          role: PromotionConditionRole.BUY,
          product: createProduct({ id: 601, name: 'Combo Trio' }),
        }),
        createCondition({
          promotionId: 778,
          productId: 602,
          quantity: 1,
          role: PromotionConditionRole.GET,
          product: createProduct({
            id: 602,
            name: 'Bonus Scarf',
            image: 'https://cdn.example.com/bonus-scarf.jpg',
            originalPrice: 99_000,
          }),
        }),
      ],
    });

    promotionRepo.find!.mockResolvedValue([promotion]);

    const summary = await service.calculateFromItems(
      [
        {
          variantId: 20,
          quantity: 2,
        },
      ],
      {},
    );

    expect(summary.totals.autoDiscountTotal).toBe(0);
    expect(summary.appliedPromotions).toHaveLength(1);
    expect(summary.appliedPromotions[0].amount).toBe(0);
    expect(summary.appliedPromotions[0].suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: 602,
          missingQuantity: 1,
          productName: 'Bonus Scarf',
          productImage: 'https://cdn.example.com/bonus-scarf.jpg',
          productPrice: 99_000,
          autoAdd: true,
        }),
      ]),
    );

    const buyLine = summary.items.find((item) => item.variantId === 20)!;
    expect(buyLine.isInCombo).toBe(false);
    expect(buyLine.discountTotal).toBe(0);
  });

  it('applies specific product coupon when eligible', async () => {
    const { service, variantRepo, promotionRepo, userCustomerGroupRepo } =
      createServiceDependencies();

    variantRepo.find!.mockResolvedValue([
      createVariant({
        id: 2,
        productId: 202,
        price: 150,
        product: createProduct({ id: 202, name: 'Coupon Item' }),
      }),
    ]);
    userCustomerGroupRepo.find!.mockResolvedValue([]);

    const couponPromotion = createPromotion({
      id: 100,
      name: '20% off',
      code: 'SAVE20',
      type: PromotionType.COUPON,
      couponType: CouponType.SPECIFIC_PRODUCTS,
      discountType: DiscountType.PERCENT,
      discountValue: 20,
      conditions: [
        createCondition({
          promotionId: 100,
          productId: 202,
          role: PromotionConditionRole.APPLIES_TO,
        }),
      ],
    });

    promotionRepo.find!.mockResolvedValue([couponPromotion]);

    const summary = await service.calculateFromItems(
      [
        {
          variantId: 2,
          quantity: 1,
        },
      ],
      { promotionCode: 'SAVE20' },
    );

    expect(summary.totals.subTotal).toBe(150);
    expect(summary.totals.couponDiscountTotal).toBe(30);
    expect(summary.totals.totalAmount).toBe(120);
    expect(summary.appliedPromotions).toHaveLength(1);
    expect(summary.appliedPromotions[0].amount).toBe(30);
  });

  it('rejects coupon when product participates in combo', async () => {
    const { service, variantRepo, promotionRepo, userCustomerGroupRepo } =
      createServiceDependencies();

    variantRepo.find!.mockResolvedValue([
      createVariant({
        id: 3,
        productId: 303,
        price: 120,
        product: createProduct({ id: 303, name: 'Stacked Item' }),
      }),
    ]);
    userCustomerGroupRepo.find!.mockResolvedValue([]);

    const comboPromotion = createPromotion({
      id: 200,
      name: 'Auto',
      type: PromotionType.COMBO,
      comboType: ComboType.PRODUCT_COMBO,
      discountType: DiscountType.FIXED,
      discountValue: 10,
      conditions: [
        createCondition({
          promotionId: 200,
          productId: 303,
          quantity: 1,
          role: PromotionConditionRole.BUY,
        }),
      ],
    });

    const couponPromotion = createPromotion({
      id: 201,
      name: 'Coupon',
      code: 'STACK10',
      type: PromotionType.COUPON,
      couponType: CouponType.SPECIFIC_PRODUCTS,
      discountType: DiscountType.PERCENT,
      discountValue: 10,
      conditions: [
        createCondition({
          promotionId: 201,
          productId: 303,
          role: PromotionConditionRole.APPLIES_TO,
        }),
      ],
    });

    promotionRepo.find!.mockResolvedValue([comboPromotion, couponPromotion]);

    await expect(
      service.calculateFromItems(
        [
          {
            variantId: 3,
            quantity: 1,
          },
        ],
        { promotionCode: 'STACK10' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
