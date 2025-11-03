import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { CalculatePricingDto } from './dto/calculate-pricing.dto';

interface PricingContext {
  promotionId?: number;
  branchId?: number;
  addressId?: number;
  userId?: number;
}

interface PricingItemInput {
  variantId: number;
  quantity: number;
}

export interface PricingLineItem {
  variantId: number;
  quantity: number;
  unitPrice: number;
  subTotal: number;
  discountTotal: number;
  totalAmount: number;
  variant: {
    id: number;
    name: string;
    image?: string | null;
    productId: number;
    productName: string;
  };
}

export interface AppliedPromotion {
  promotionId: number;
  amount: number;
  description?: string;
}

export interface PricingSummary {
  items: PricingLineItem[];
  totals: {
    subTotal: number;
    discountTotal: number;
    shippingFee: number;
    taxTotal: number;
    totalAmount: number;
  };
  context: PricingContext;
  appliedPromotions: AppliedPromotion[];
}

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
  ) {}

  async calculate(dto: CalculatePricingDto): Promise<PricingSummary> {
    if (!dto.items?.length) {
      throw new BadRequestException('Danh sách sản phẩm không được bỏ trống');
    }

    return this.calculateFromItems(dto.items, {
      promotionId: dto.promotionId,
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
      promotionId: context.promotionId,
      branchId: context.branchId,
      addressId: context.addressId,
      userId: context.userId,
    };

    if (!items.length) {
      const shippingFee = this.roundMoney(this.calculateShippingFee(normalizedContext));
      const taxTotal = 0;
      const appliedPromotions = this.buildPromotionPlaceholders(normalizedContext);
      return {
        items: [],
        totals: {
          subTotal: 0,
          discountTotal: 0,
          shippingFee,
          taxTotal,
          totalAmount: this.roundMoney(0 - 0 + shippingFee + taxTotal),
        },
        context: normalizedContext,
        appliedPromotions,
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

    let subTotal = 0;
    let discountTotal = 0;
    const lineItems: PricingLineItem[] = [];

    aggregatedItems.forEach((itemQuantity, variantId) => {
      const variant = variantMap.get(variantId);
      if (!variant) {
        return;
      }

      const unitPrice = this.roundMoney(variant.price);
      const quantity = itemQuantity;
      const lineSubTotal = this.roundMoney(unitPrice * quantity);
      const discount = this.roundMoney(
        this.calculateDiscountForItem({ variant, quantity, context, lineSubTotal }),
      );
      const lineTotal = this.roundMoney(lineSubTotal - discount);

      subTotal = this.roundMoney(subTotal + lineSubTotal);
      discountTotal = this.roundMoney(discountTotal + discount);

      lineItems.push({
        variantId,
        quantity,
        unitPrice,
        subTotal: lineSubTotal,
        discountTotal: discount,
        totalAmount: lineTotal,
        variant: {
          id: variant.id,
          name: variant.product?.name ?? `Variant ${variant.id}`,
          image: variant.image ?? null,
          productId: variant.productId,
          productName: variant.product?.name ?? 'Unknown product',
        },
      });
    });

    const shippingFee = this.roundMoney(this.calculateShippingFee(context));
    const taxTotal = 0;
    const totalAmount = this.roundMoney(subTotal - discountTotal + shippingFee + taxTotal);
    const appliedPromotions = this.buildPromotionPlaceholders(context);

    return {
      items: lineItems,
      totals: {
        subTotal,
        discountTotal,
        shippingFee,
        taxTotal,
        totalAmount,
      },
      context,
      appliedPromotions,
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

  private calculateDiscountForItem(input: {
    variant: ProductVariant;
    quantity: number;
    context: PricingContext;
    lineSubTotal: number;
  }): number {
    void input;
    return 0;
  }

  private calculateShippingFee(context: PricingContext): number {
    void context;
    return 0;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private buildPromotionPlaceholders(context: PricingContext): AppliedPromotion[] {
    if (!context.promotionId) {
      return [];
    }

    return [
      {
        promotionId: context.promotionId,
        amount: 0,
        description: 'Placeholder: logic khuyến mãi sẽ được bổ sung sau',
      },
    ];
  }
}
