import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import {
  ApplyScope,
  ComboType,
  CouponType,
  DiscountType,
  Promotion,
  PromotionType,
} from '../promotions/entities/promotion.entity';
import { PromotionConditionRole } from '../promotion_conditions/entities/promotion-condition.entity';
import { UserCustomerGroup } from '../user_customer_groups/entities/user-customer-group.entity';
import { CalculatePricingDto } from './dto/calculate-pricing.dto';
import {
  AppliedPromotionReference,
  PricingContext,
  PricingItemInput,
  PricingLineItem,
  PricingSummary,
  PromotionAdjustment,
  PromotionAdjustmentLineItem,
  PromotionLevel,
  PromotionSuggestionItem,
} from './types/pricing.types';

type MutableLineItem = PricingLineItem;

interface VariantBucketItem {
  variantId: number;
  productId: number;
  unitPrice: number;
  lineItem: MutableLineItem;
  availableQuantity: number;
}

interface LineAllocation {
  variantId: number;
  productId: number;
  quantity: number;
  value: number;
  role: PromotionConditionRole;
  lineItem: MutableLineItem;
  source?: VariantBucketItem;
}

type ProductBuckets = Map<number, VariantBucketItem[]>;

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(Promotion)
    private readonly promotionRepo: Repository<Promotion>,
    @InjectRepository(UserCustomerGroup)
    private readonly userCustomerGroupRepo: Repository<UserCustomerGroup>,
  ) {}

  async calculate(dto: CalculatePricingDto): Promise<PricingSummary> {
    if (!dto.items?.length) {
      throw new BadRequestException('Danh sách sản phẩm không được bỏ trống');
    }

    return this.calculateFromItems(dto.items, {
      promotionCode: dto.promotionCode,
      branchId: dto.branchId,
      addressId: dto.addressId,
      userId: dto.userId,
    });
  }

  async calculateFromItems(
    items: PricingItemInput[],
    context: Partial<PricingContext> = {},
  ): Promise<PricingSummary> {
    const normalizedContext: PricingContext = {
      promotionCode: context.promotionCode?.trim() || undefined,
      promotionId: context.promotionId,
      branchId: context.branchId,
      addressId: context.addressId,
      userId: context.userId,
    };

    if (!items.length) {
      const shippingFee = this.roundMoney(this.calculateShippingFee(normalizedContext));
      const taxTotal = this.roundMoney(this.calculateTax(0, normalizedContext));
      return {
        items: [],
        totals: {
          subTotal: 0,
          autoDiscountTotal: 0,
          couponDiscountTotal: 0,
          discountTotal: 0,
          shippingFee,
          taxTotal,
          totalAmount: this.roundMoney(shippingFee + taxTotal),
        },
        context: normalizedContext,
        appliedPromotions: [],
        meta: {
          totalAutoDiscount: 0,
          totalCouponDiscount: 0,
        },
      };
    }

    return this.calculateSummary(items, normalizedContext);
  }

  private async calculateSummary(
    items: PricingItemInput[],
    context: PricingContext,
  ): Promise<PricingSummary> {
    const aggregatedItems = this.aggregateItems(items);
    const variantIds = [...aggregatedItems.keys()];

    const variants = await this.variantRepo.find({
      where: { id: In(variantIds) },
      relations: { product: true },
    });

    if (variants.length !== variantIds.length) {
      const foundIds = new Set(variants.map((variant) => variant.id));
      const missing = variantIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Không tìm thấy biến thể: ${missing.join(', ')}`);
    }

    const variantMap = new Map(variants.map((variant) => [variant.id, variant] as const));
    const lineItems = this.buildLineItems(aggregatedItems, variantMap);
    const productBuckets = this.buildProductBuckets(variants, lineItems);

    const userGroupIds = await this.resolveUserGroupIds(context.userId);
    const promotions = await this.fetchApplicablePromotions(context, userGroupIds);
    const comboPromotions = promotions.filter(
      (promotion) => promotion.type === PromotionType.COMBO,
    );
    const couponPromotions = promotions.filter(
      (promotion) => promotion.type === PromotionType.COUPON,
    );

    const autoResult = this.applyAutomaticPromotions(comboPromotions, productBuckets, lineItems);

    let couponDiscount = 0;
    let couponAdjustment: PromotionAdjustment | null = null;

    if (context.promotionCode || context.promotionId) {
      const normalizedCode = context.promotionCode?.trim().toLowerCase();

      const coupon = couponPromotions.find((promotion) => {
        const promotionCode = promotion.code?.trim().toLowerCase();
        if (normalizedCode) {
          return promotionCode === normalizedCode;
        }
        return context.promotionId ? promotion.id === context.promotionId : false;
      });

      if (!coupon) {
        throw new BadRequestException('Mã khuyến mãi không hợp lệ hoặc không khả dụng.');
      }

      context.promotionId = coupon.id;
      context.promotionCode = coupon.code ?? context.promotionCode;

      const couponResult = this.applyCouponPromotion(coupon, lineItems);
      couponDiscount = couponResult.discount;
      couponAdjustment = couponResult.adjustment;
    }

    const autoDiscountTotal = autoResult.totalDiscount;
    const couponDiscountTotal = couponDiscount;
    const discountTotal = this.roundMoney(autoDiscountTotal + couponDiscountTotal);

    const subTotal = this.roundMoney(lineItems.reduce((sum, item) => sum + item.subTotal, 0));
    const netTotal = this.roundMoney(lineItems.reduce((sum, item) => sum + item.totalAmount, 0));
    const shippingFee = this.roundMoney(this.calculateShippingFee(context));
    const taxTotal = this.roundMoney(this.calculateTax(netTotal, context));
    const totalAmount = this.roundMoney(netTotal + shippingFee + taxTotal);

    const appliedPromotions: PromotionAdjustment[] = [...autoResult.adjustments];
    if (couponAdjustment) {
      appliedPromotions.push(couponAdjustment);
    }

    return {
      items: lineItems.map((item) => ({
        ...item,
        discountTotal: this.roundMoney(item.discountTotal),
        totalAmount: this.roundMoney(item.totalAmount),
        appliedPromotions: item.appliedPromotions.map((entry) => ({
          ...entry,
          amount: this.roundMoney(entry.amount),
        })),
      })),
      totals: {
        subTotal,
        autoDiscountTotal,
        couponDiscountTotal,
        discountTotal,
        shippingFee,
        taxTotal,
        totalAmount,
      },
      context,
      appliedPromotions,
      meta: {
        totalAutoDiscount: autoDiscountTotal,
        totalCouponDiscount: couponDiscountTotal,
      },
    };
  }

  private aggregateItems(items: PricingItemInput[]) {
    const aggregated = new Map<number, number>();

    for (const item of items) {
      const quantity = Math.max(1, item.quantity);
      const current = aggregated.get(item.variantId) ?? 0;
      aggregated.set(item.variantId, current + quantity);
    }

    return aggregated;
  }

  private buildLineItems(
    aggregatedItems: Map<number, number>,
    variantMap: Map<number, ProductVariant>,
  ): MutableLineItem[] {
    const lineItems: MutableLineItem[] = [];

    aggregatedItems.forEach((quantity, variantId) => {
      const variant = variantMap.get(variantId);
      if (!variant) {
        return;
      }

      const unitPrice = this.roundMoney(variant.price);
      const subTotal = this.roundMoney(unitPrice * quantity);

      lineItems.push({
        variantId,
        quantity,
        unitPrice,
        subTotal,
        discountTotal: 0,
        totalAmount: subTotal,
        isInCombo: false,
        appliedPromotions: [],
        variant: {
          id: variant.id,
          name: variant.product?.name ?? `Variant ${variant.id}`,
          image: variant.image ?? null,
          productId: variant.productId,
          productName: variant.product?.name ?? 'Unknown product',
        },
      });
    });

    return lineItems;
  }

  private buildProductBuckets(
    variants: ProductVariant[],
    lineItems: MutableLineItem[],
  ): ProductBuckets {
    const buckets: ProductBuckets = new Map();
    const lineItemMap = new Map(lineItems.map((item) => [item.variantId, item] as const));

    for (const variant of variants) {
      const lineItem = lineItemMap.get(variant.id);
      if (!lineItem) {
        continue;
      }

      const entry: VariantBucketItem = {
        variantId: variant.id,
        productId: variant.productId,
        unitPrice: lineItem.unitPrice,
        lineItem,
        availableQuantity: lineItem.quantity,
      };

      const bucket = buckets.get(variant.productId);
      if (bucket) {
        bucket.push(entry);
      } else {
        buckets.set(variant.productId, [entry]);
      }
    }

    return buckets;
  }

  private applyAutomaticPromotions(
    promotions: Promotion[],
    productBuckets: ProductBuckets,
    lineItems: MutableLineItem[],
  ): { adjustments: PromotionAdjustment[]; totalDiscount: number } {
    if (!promotions.length || !lineItems.length) {
      return { adjustments: [], totalDiscount: 0 };
    }

    const adjustments: PromotionAdjustment[] = [];
    let totalDiscount = 0;

    const sortedPromotions = [...promotions].sort((a, b) => a.id - b.id);

    for (const promotion of sortedPromotions) {
      const buyConditions = (promotion.conditions ?? []).filter(
        (condition) => condition.role === PromotionConditionRole.BUY,
      );

      if (!buyConditions.length) {
        continue;
      }

      const isBuyXGetY = promotion.comboType === ComboType.BUY_X_GET_Y;
      const autoAddGift =
        isBuyXGetY &&
        promotion.discountType === DiscountType.PERCENT &&
        Number(promotion.discountValue ?? 0) >= 100;

      const potentialTimes = buyConditions.map((condition) => {
        const available = this.getAvailableProductQuantity(productBuckets, condition.productId);
        const required = Math.max(1, condition.quantity);
        return Math.floor(available / required);
      });

      const maxTimes = Math.min(...potentialTimes);
      if (!Number.isFinite(maxTimes) || maxTimes <= 0) {
        continue;
      }

      let timesApplied = maxTimes;
      if (promotion.usageLimit && promotion.usageLimit > 0) {
        const remainingUsage = promotion.usageLimit - promotion.usedCount;
        if (remainingUsage <= 0) {
          continue;
        }
        timesApplied = Math.min(timesApplied, remainingUsage);
      }

      const buyAllocations: LineAllocation[] = [];
      let buyFailed = false;

      for (const condition of buyConditions) {
        const requiredQuantity = Math.max(1, condition.quantity) * timesApplied;
        const allocations = this.reserveProductQuantity(
          productBuckets,
          condition.productId,
          requiredQuantity,
          PromotionConditionRole.BUY,
        );

        const allocatedQuantity = this.calculateAllocatedQuantity(allocations);
        if (allocatedQuantity < requiredQuantity) {
          this.releaseAllocations([...buyAllocations, ...allocations]);
          buyFailed = true;
          break;
        }

        buyAllocations.push(...allocations);
      }

      if (buyFailed || !buyAllocations.length) {
        continue;
      }

      const buyBaseAmount = this.roundMoney(
        buyAllocations.reduce((sum, allocation) => sum + allocation.value, 0),
      );

      const getConditions = (promotion.conditions ?? []).filter(
        (condition) => condition.role === PromotionConditionRole.GET,
      );

      const getAllocations: LineAllocation[] = [];
      const suggestions: PromotionSuggestionItem[] = [];

      for (const condition of getConditions) {
        const requiredQuantity = Math.max(1, condition.quantity) * timesApplied;
        const allocations = this.reserveProductQuantity(
          productBuckets,
          condition.productId,
          requiredQuantity,
          PromotionConditionRole.GET,
        );

        const allocatedQuantity = this.calculateAllocatedQuantity(allocations);

        if (allocatedQuantity < requiredQuantity) {
          const product = condition.product;
          const productPrice =
            product?.originalPrice === undefined || product?.originalPrice === null
              ? null
              : Number(product.originalPrice);

          suggestions.push({
            productId: condition.productId,
            requiredQuantity,
            currentQuantity: allocatedQuantity,
            missingQuantity: requiredQuantity - allocatedQuantity,
            potentialDiscount: null,
            message: `Thêm ${requiredQuantity - allocatedQuantity} sản phẩm để nhận ưu đãi từ combo này`,
            productName: product?.name ?? null,
            productImage: product?.image ?? null,
            productPrice,
            autoAdd: autoAddGift,
          });
        }

        if (allocatedQuantity > 0) {
          getAllocations.push(...allocations);
        } else {
          this.releaseAllocations(allocations);
        }
      }

      const giftBaseAmount = this.roundMoney(
        getAllocations.reduce((sum, allocation) => sum + allocation.value, 0),
      );

      if (promotion.comboType === ComboType.BUY_X_GET_Y) {
        const requiredGiftQuantity = getConditions.reduce(
          (sum, condition) => sum + Math.max(1, condition.quantity) * timesApplied,
          0,
        );

        const allocatedGiftQuantity = getAllocations.reduce(
          (sum, allocation) => sum + allocation.quantity,
          0,
        );

        const needsMoreGifts =
          requiredGiftQuantity > 0 && allocatedGiftQuantity < requiredGiftQuantity;

        if (requiredGiftQuantity > 0 && (!allocatedGiftQuantity || needsMoreGifts)) {
          this.releaseAllocations([...buyAllocations, ...getAllocations]);

          if (suggestions.length) {
            adjustments.push({
              promotionId: promotion.id,
              promotionName: promotion.name,
              promotionType: promotion.type,
              comboType: promotion.comboType ?? null,
              couponType: null,
              level: 'AUTO',
              amount: 0,
              description: promotion.description ?? null,
              metadata: {
                timesApplied,
                baseAmount: buyBaseAmount,
                giftBaseAmount,
                discountType: promotion.discountType,
                discountValue: promotion.discountValue,
                maxDiscount: promotion.maxDiscount ?? null,
              },
              items: [],
              suggestions,
            });
          }

          continue;
        }
      }

      const discountBase =
        promotion.comboType === ComboType.BUY_X_GET_Y && giftBaseAmount > 0
          ? giftBaseAmount
          : buyBaseAmount;

      let discount = this.calculateDiscountAmount(promotion, discountBase, timesApplied);
      discount = Math.min(discount, buyBaseAmount + giftBaseAmount);
      discount = this.roundMoney(discount);

      if (discount <= 0) {
        this.releaseAllocations([...buyAllocations, ...getAllocations]);

        if (suggestions.length) {
          adjustments.push({
            promotionId: promotion.id,
            promotionName: promotion.name,
            promotionType: promotion.type,
            comboType: promotion.comboType ?? null,
            couponType: null,
            level: 'AUTO',
            amount: 0,
            description: promotion.description ?? null,
            metadata: {
              timesApplied,
              baseAmount: buyBaseAmount,
              giftBaseAmount,
              discountType: promotion.discountType,
              discountValue: promotion.discountValue,
              maxDiscount: promotion.maxDiscount ?? null,
            },
            items: [],
            suggestions,
          });
        }

        continue;
      }

      buyAllocations.forEach((allocation) => {
        allocation.lineItem.isInCombo = true;
      });

      const discountTargets =
        promotion.comboType === ComboType.BUY_X_GET_Y ? getAllocations : buyAllocations;

      const discountedItems = this.distributeDiscount(
        discountTargets,
        discount,
        'AUTO',
        promotion.id,
      );

      if (promotion.comboType === ComboType.BUY_X_GET_Y) {
        const discountedVariantIds = new Set(
          discountedItems
            .map((item) => item.variantId)
            .filter((id): id is number => typeof id === 'number'),
        );

        for (const allocation of buyAllocations) {
          if (!discountedVariantIds.has(allocation.variantId)) {
            discountedItems.push({
              productId: allocation.productId,
              variantId: allocation.variantId,
              quantity: allocation.quantity,
              discountAmount: 0,
            });
          }
        }
      }

      totalDiscount = this.roundMoney(totalDiscount + discount);

      adjustments.push({
        promotionId: promotion.id,
        promotionName: promotion.name,
        promotionType: promotion.type,
        comboType: promotion.comboType ?? null,
        couponType: null,
        level: 'AUTO',
        amount: discount,
        description: promotion.description ?? null,
        metadata: {
          timesApplied,
          baseAmount: buyBaseAmount,
          giftBaseAmount,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
          maxDiscount: promotion.maxDiscount ?? null,
        },
        items: discountedItems,
        suggestions: suggestions.length ? suggestions : undefined,
      });
    }

    return {
      adjustments,
      totalDiscount: this.roundMoney(totalDiscount),
    };
  }

  private applyCouponPromotion(
    coupon: Promotion,
    lineItems: MutableLineItem[],
  ): { adjustment: PromotionAdjustment | null; discount: number } {
    if (!coupon.couponType) {
      throw new BadRequestException('Mã giảm giá chưa được cấu hình loại áp dụng.');
    }

    if (coupon.couponType === CouponType.SPECIFIC_PRODUCTS) {
      const productIds = (coupon.conditions ?? [])
        .filter((condition) => condition.role === PromotionConditionRole.APPLIES_TO)
        .map((condition) => condition.productId);

      if (!productIds.length) {
        throw new BadRequestException('Mã giảm giá chưa cấu hình sản phẩm áp dụng.');
      }

      const eligibleLineItems = lineItems.filter((item) =>
        productIds.includes(item.variant.productId),
      );

      if (!eligibleLineItems.length) {
        throw new BadRequestException('Giỏ hàng không có sản phẩm phù hợp với mã giảm giá.');
      }

      const conflictedItem = eligibleLineItems.find((item) => item.isInCombo);
      if (conflictedItem) {
        throw new BadRequestException(
          `Sản phẩm ${conflictedItem.variant.productName} đang tham gia combo, không thể áp dụng mã giảm giá.`,
        );
      }

      const allocations = eligibleLineItems.map<LineAllocation>((item) => ({
        variantId: item.variantId,
        productId: item.variant.productId,
        quantity: item.quantity,
        value: this.roundMoney(item.totalAmount),
        role: PromotionConditionRole.APPLIES_TO,
        lineItem: item,
      }));

      const baseAmount = this.roundMoney(
        allocations.reduce((sum, allocation) => sum + allocation.value, 0),
      );

      this.assertMinOrderValue(coupon, baseAmount);

      let discount = this.calculateDiscountAmount(coupon, baseAmount, 1);
      discount = Math.min(discount, baseAmount);
      discount = this.roundMoney(discount);

      if (discount <= 0) {
        throw new BadRequestException('Mã giảm giá không áp dụng được cho giỏ hàng hiện tại.');
      }

      const items = this.distributeDiscount(allocations, discount, 'COUPON', coupon.id);

      return {
        discount,
        adjustment: {
          promotionId: coupon.id,
          promotionName: coupon.name,
          promotionType: coupon.type,
          comboType: null,
          couponType: coupon.couponType ?? null,
          level: 'COUPON',
          amount: discount,
          description: coupon.description ?? null,
          metadata: {
            timesApplied: 1,
            baseAmount,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            maxDiscount: coupon.maxDiscount ?? null,
          },
          items,
        },
      };
    }

    if (coupon.couponType === CouponType.ORDER_TOTAL) {
      const baseAmount = this.roundMoney(
        lineItems.reduce((sum, item) => sum + item.totalAmount, 0),
      );

      this.assertMinOrderValue(coupon, baseAmount);

      let discount = this.calculateDiscountAmount(coupon, baseAmount, 1);
      discount = Math.min(discount, baseAmount);
      discount = this.roundMoney(discount);

      if (discount <= 0) {
        throw new BadRequestException('Mã giảm giá không áp dụng được cho giỏ hàng hiện tại.');
      }

      const allocations = lineItems
        .map<LineAllocation>((item) => ({
          variantId: item.variantId,
          productId: item.variant.productId,
          quantity: item.quantity,
          value: this.roundMoney(item.totalAmount),
          role: PromotionConditionRole.APPLIES_TO,
          lineItem: item,
        }))
        .filter((allocation) => allocation.value > 0);

      const items = this.distributeDiscount(allocations, discount, 'COUPON', coupon.id);

      return {
        discount,
        adjustment: {
          promotionId: coupon.id,
          promotionName: coupon.name,
          promotionType: coupon.type,
          comboType: null,
          couponType: coupon.couponType ?? null,
          level: 'COUPON',
          amount: discount,
          description: coupon.description ?? null,
          metadata: {
            timesApplied: 1,
            baseAmount,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            maxDiscount: coupon.maxDiscount ?? null,
          },
          items,
        },
      };
    }

    throw new BadRequestException('Loại mã giảm giá không được hỗ trợ.');
  }

  private async fetchApplicablePromotions(
    context: PricingContext,
    userGroupIds: number[],
  ): Promise<Promotion[]> {
    const now = new Date();

    const promotions = await this.promotionRepo.find({
      where: {
        isActive: true,
        type: In([PromotionType.COMBO, PromotionType.COUPON]),
        startDate: LessThanOrEqual(now),
        endDate: MoreThanOrEqual(now),
      },
      relations: {
        conditions: { product: true },
        branches: true,
        customerGroups: true,
      },
      order: { id: 'ASC' },
    });

    return promotions.filter((promotion) =>
      this.isPromotionApplicable(promotion, context, userGroupIds),
    );
  }

  private isPromotionApplicable(
    promotion: Promotion,
    context: PricingContext,
    userGroupIds: number[],
  ): boolean {
    if (!promotion.isActive) {
      return false;
    }

    if (
      promotion.usageLimit &&
      promotion.usageLimit > 0 &&
      promotion.usedCount >= promotion.usageLimit
    ) {
      return false;
    }

    switch (promotion.applyScope) {
      case ApplyScope.GLOBAL:
        return true;
      case ApplyScope.BRANCH:
        if (!context.branchId) {
          return false;
        }
        return promotion.branches?.some((branch) => branch.branchId === context.branchId) ?? false;
      case ApplyScope.CUSTOMER_GROUP: {
        if (!userGroupIds.length) {
          return false;
        }
        const targetGroupIds = promotion.customerGroups
          ?.map((group) => group.customerGroupId)
          .filter((id): id is number => typeof id === 'number');

        if (!targetGroupIds?.length) {
          return false;
        }

        return targetGroupIds.some((groupId) => userGroupIds.includes(groupId));
      }
      default:
        return true;
    }
  }

  private async resolveUserGroupIds(userId?: number): Promise<number[]> {
    if (!userId) {
      return [];
    }

    const memberships = await this.userCustomerGroupRepo.find({
      where: { userId },
    });

    return memberships.map((membership) => membership.customerGroupId);
  }

  private reserveProductQuantity(
    buckets: ProductBuckets,
    productId: number,
    quantity: number,
    role: PromotionConditionRole,
  ): LineAllocation[] {
    const bucket = buckets.get(productId);
    if (!bucket?.length || quantity <= 0) {
      return [];
    }

    let remaining = quantity;
    const allocations: LineAllocation[] = [];

    for (const entry of bucket) {
      if (remaining <= 0) {
        break;
      }

      if (entry.availableQuantity <= 0) {
        continue;
      }

      const take = Math.min(entry.availableQuantity, remaining);
      entry.availableQuantity -= take;
      remaining -= take;

      allocations.push({
        variantId: entry.variantId,
        productId: entry.productId,
        quantity: take,
        value: this.roundMoney(take * entry.unitPrice),
        role,
        lineItem: entry.lineItem,
        source: entry,
      });
    }

    return allocations;
  }

  private releaseAllocations(allocations: LineAllocation[]) {
    allocations.forEach((allocation) => {
      if (allocation.source) {
        allocation.source.availableQuantity += allocation.quantity;
      }
    });
  }

  private calculateAllocatedQuantity(allocations: LineAllocation[]): number {
    return allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  }

  private getAvailableProductQuantity(buckets: ProductBuckets, productId: number): number {
    const bucket = buckets.get(productId);
    if (!bucket?.length) {
      return 0;
    }

    return bucket.reduce((sum, entry) => sum + entry.availableQuantity, 0);
  }

  private distributeDiscount(
    allocations: LineAllocation[],
    discountAmount: number,
    level: PromotionLevel,
    promotionId: number,
  ): PromotionAdjustmentLineItem[] {
    if (!allocations.length || discountAmount <= 0) {
      return [];
    }

    const valueTotal = allocations.reduce((sum, allocation) => sum + allocation.value, 0);
    const quantityTotal = allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
    const hasValue = valueTotal > 0;

    let remaining = this.roundMoney(discountAmount);
    const aggregated = new Map<number, PromotionAdjustmentLineItem>();

    allocations.forEach((allocation, index) => {
      if (remaining <= 0) {
        return;
      }

      const available = Math.max(
        0,
        this.roundMoney(allocation.lineItem.subTotal - allocation.lineItem.discountTotal),
      );

      if (available <= 0) {
        return;
      }

      const proportion = hasValue
        ? allocation.value / valueTotal
        : allocation.quantity / Math.max(quantityTotal, 1);

      let applied =
        index === allocations.length - 1 ? remaining : this.roundMoney(discountAmount * proportion);

      applied = Math.min(applied, remaining, available);

      if (applied <= 0) {
        return;
      }

      remaining = this.roundMoney(remaining - applied);
      this.applyLineDiscount(allocation.lineItem, applied, level, promotionId);

      const existing = aggregated.get(allocation.variantId);
      if (existing) {
        existing.discountAmount = this.roundMoney(existing.discountAmount + applied);
        existing.quantity += allocation.quantity;
        if (allocation.role === PromotionConditionRole.GET) {
          existing.isGift = true;
        }
      } else {
        aggregated.set(allocation.variantId, {
          productId: allocation.productId,
          variantId: allocation.variantId,
          quantity: allocation.quantity,
          discountAmount: this.roundMoney(applied),
          isGift: allocation.role === PromotionConditionRole.GET ? true : undefined,
        });
      }
    });

    return [...aggregated.values()].map((item) => ({
      ...item,
      discountAmount: this.roundMoney(item.discountAmount),
    }));
  }

  private applyLineDiscount(
    lineItem: MutableLineItem,
    discountAmount: number,
    level: PromotionLevel,
    promotionId: number,
  ) {
    if (discountAmount <= 0) {
      return;
    }

    const available = this.roundMoney(lineItem.subTotal - lineItem.discountTotal);
    if (available <= 0) {
      return;
    }

    const applied = Math.min(discountAmount, available);
    lineItem.discountTotal = this.roundMoney(lineItem.discountTotal + applied);
    lineItem.totalAmount = this.roundMoney(lineItem.subTotal - lineItem.discountTotal);

    if (level === 'AUTO') {
      lineItem.isInCombo = true;
    }

    const existing = lineItem.appliedPromotions.find(
      (entry) => entry.promotionId === promotionId && entry.level === level,
    );

    if (existing) {
      existing.amount = this.roundMoney(existing.amount + applied);
    } else {
      const reference: AppliedPromotionReference = {
        promotionId,
        level,
        amount: this.roundMoney(applied),
      };
      lineItem.appliedPromotions.push(reference);
    }
  }

  private calculateDiscountAmount(
    promotion: Promotion,
    baseAmount: number,
    timesApplied: number,
  ): number {
    const normalizedBase = Math.max(0, baseAmount);
    let discount = 0;

    if (promotion.discountType === DiscountType.PERCENT) {
      discount = (normalizedBase * promotion.discountValue) / 100;
    } else {
      discount = promotion.discountValue * Math.max(1, timesApplied);
    }

    if (
      promotion.maxDiscount !== null &&
      promotion.maxDiscount !== undefined &&
      promotion.maxDiscount > 0
    ) {
      discount = Math.min(discount, promotion.maxDiscount);
    }

    return this.roundMoney(discount);
  }

  private assertMinOrderValue(promotion: Promotion, baseAmount: number) {
    if (promotion.minOrderValue && promotion.minOrderValue > 0) {
      if (baseAmount < promotion.minOrderValue) {
        throw new BadRequestException(
          'Giá trị đơn hàng chưa đạt mức tối thiểu để áp dụng khuyến mãi.',
        );
      }
    }
  }

  private calculateShippingFee(context: PricingContext): number {
    void context;
    return 0;
  }

  private calculateTax(baseAmount: number, context: PricingContext): number {
    void baseAmount;
    void context;
    return 0;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
