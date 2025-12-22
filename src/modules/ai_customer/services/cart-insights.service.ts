import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { PricingService } from '../../pricing/pricing.service';
import { PricingItemInput, PromotionSuggestionItem } from '../../pricing/types/pricing.types';
import { DiscountType, Promotion, PromotionType } from '../../promotions/entities/promotion.entity';
import { PromotionConditionRole } from '../../promotion_conditions/entities/promotion-condition.entity';
import {
  CartAnalysisRequestDto,
  CartAnalysisResponse,
  CartAssistantGreeting,
  CartComparisonOpportunity,
  CartComparisonProductSummary,
  CartPromotionOpportunity,
  CartPromotionProductGap,
} from '../dto/cart-analysis.dto';
import {
  ProductComparisonRequestDto,
  ProductComparisonResponse,
} from '../dto/product-comparison.dto';
import { CartProductContext, CartProductContextFactory } from './cart-product-context.factory';
import { buildComparisonMatrix } from './cart-comparison.helper';
import { getCartCopy, resolveLocale, SupportedLocale } from './cart-insights.copy';

@Injectable()
export class CartInsightsService {
  private readonly logger = new Logger(CartInsightsService.name);

  constructor(
    private readonly pricingService: PricingService,
    private readonly contextFactory: CartProductContextFactory,
    @InjectRepository(Promotion)
    private readonly promotionRepository: Repository<Promotion>,
  ) {}

  async analyzeCart(payload: CartAnalysisRequestDto): Promise<CartAnalysisResponse> {
    const locale = resolveLocale(payload.locale);
    const startTime = Date.now();
    const analyzeInputLog = this.safeJson({ locale, payload });
    this.logger.debug(`[analyzeCart] Incoming payload=${analyzeInputLog}`);
    const normalizedItems = this.normalizeItems(payload.items ?? []);
    const normalizedIdsLog = normalizedItems.map((item) => item.productId).join(',');
    this.logger.debug(
      `[analyzeCart] Normalized items=${normalizedItems.length} ids=${normalizedIdsLog}`,
    );
    const contextMap = await this.contextFactory.hydrate(
      normalizedItems.map((item) => item.productId),
    );
    this.logger.debug(
      `[analyzeCart] Hydrated contexts=${contextMap.size} missing=${normalizedItems.length - contextMap.size}`,
    );

    const response: CartAnalysisResponse = {
      greeting: this.composeGreeting(locale, normalizedItems.length),
      promotionOpportunities: [],
      comparisonOpportunities: [],
      fallbackApplied: false,
      inspectedItems: normalizedItems.length,
      generatedAt: new Date().toISOString(),
    };

    if (!normalizedItems.length) {
      response.fallbackApplied = true;
      this.logger.debug('[analyzeCart] No items provided, returning fallback greeting.');
      return response;
    }

    try {
      const promoStart = Date.now();
      response.promotionOpportunities = await this.buildPromotionOpportunities(
        normalizedItems,
        locale,
        contextMap,
      );
      this.logger.debug(
        `[analyzeCart] Promotion opportunities=${response.promotionOpportunities.length} computedIn=${Date.now() - promoStart}ms`,
      );
    } catch (error) {
      this.logger.warn(`Failed to evaluate promotions: ${this.stringifyError(error)}`);
      response.fallbackApplied = true;
    }

    const compareStart = Date.now();
    response.comparisonOpportunities = this.buildComparisonOpportunities(locale, contextMap);
    this.logger.debug(
      `[analyzeCart] Comparison opportunities=${response.comparisonOpportunities.length} computedIn=${Date.now() - compareStart}ms`,
    );
    const totalHints =
      response.promotionOpportunities.length + response.comparisonOpportunities.length;
    response.greeting = this.composeGreeting(locale, totalHints);

    const analyzeSummaryLog = this.safeJson({
      totalHints,
      promotionCount: response.promotionOpportunities.length,
      comparisonCount: response.comparisonOpportunities.length,
      fallbackApplied: response.fallbackApplied,
    });
    this.logger.debug(
      `[analyzeCart] Completed in ${Date.now() - startTime}ms response=${analyzeSummaryLog}`,
    );
    this.logger.debug(`[analyzeCart] Full response=${this.safeJson(response)}`);

    return response;
  }

  async compareProducts(payload: ProductComparisonRequestDto): Promise<ProductComparisonResponse> {
    const locale = resolveLocale(payload.locale);
    const requestedIds = Array.from(new Set(payload.productIds ?? [])).filter((id) => id > 0);
    const compareInputLog = this.safeJson({ locale, productIds: requestedIds });
    this.logger.debug(`[compareProducts] Incoming payload=${compareInputLog}`);

    if (requestedIds.length < 2) {
      throw new BadRequestException('Cần ít nhất hai sản phẩm để so sánh.');
    }

    const contextMap = await this.contextFactory.hydrate(requestedIds);
    const subjects = requestedIds
      .map((id) => contextMap.get(id))
      .filter((context): context is CartProductContext => Boolean(context));

    if (subjects.length < 2) {
      throw new BadRequestException('Không tìm thấy đủ sản phẩm hợp lệ để so sánh.');
    }

    this.logger.debug(
      `[compareProducts] Hydrated subjects=${subjects.length} contextGap=${requestedIds.length - subjects.length}`,
    );

    const copy = getCartCopy(locale);

    const response = {
      headline: copy.comparisonHeadline(),
      summary: copy.comparisonSummary(subjects.length),
      comparedProducts: subjects.map((context) => this.toComparisonSummary(context)),
      featureMatrix: buildComparisonMatrix(locale, subjects),
      generatedAt: new Date().toISOString(),
    };

    const compareSummaryLog = this.safeJson({
      comparedProducts: response.comparedProducts.map((product) => product.productId),
      featureMatrixSize: response.featureMatrix.length,
    });
    this.logger.debug(`[compareProducts] Completed comparison response=${compareSummaryLog}`);
    this.logger.debug(`[compareProducts] Full response=${this.safeJson(response)}`);

    return response;
  }

  private normalizeItems(
    items: CartAnalysisRequestDto['items'],
  ): Array<{ productId: number; variantId?: number; quantity: number }> {
    return items
      .map((item) => ({
        productId: item.productId,
        variantId: typeof item.variantId === 'number' ? item.variantId : undefined,
        quantity: Math.max(1, item.quantity ?? 1),
      }))
      .filter((entry) => entry.productId > 0);
  }

  private composeGreeting(locale: SupportedLocale, suggestionCount: number): CartAssistantGreeting {
    const copy = getCartCopy(locale);
    return {
      headline: copy.greetingHeadline(),
      subtitle: copy.greetingSubtitle(suggestionCount),
    };
  }

  private async buildPromotionOpportunities(
    items: Array<{ productId: number; variantId?: number; quantity: number }>,
    locale: SupportedLocale,
    contextMap: Map<number, CartProductContext>,
  ): Promise<CartPromotionOpportunity[]> {
    const promoInputLog = this.safeJson({
      locale,
      items,
    });
    this.logger.debug(`[buildPromotionOpportunities] Input=${promoInputLog}`);
    const variantItems: PricingItemInput[] = items
      .filter((item) => typeof item.variantId === 'number')
      .map((item) => ({
        variantId: item.variantId as number,
        quantity: item.quantity,
      }));

    if (!variantItems.length) {
      this.logger.debug('[buildPromotionOpportunities] No variant-backed items, skipping.');
      return [];
    }

    const pricingSummary = await this.pricingService.calculateFromItems(variantItems);
    const carriers = pricingSummary.appliedPromotions.filter(
      (adjustment) => Array.isArray(adjustment.suggestions) && adjustment.suggestions.length,
    );

    this.logger.debug(
      `[buildPromotionOpportunities] Applied promotions=${pricingSummary.appliedPromotions.length} carriersWithSuggestions=${carriers.length}`,
    );

    // We don't return early here anymore. Even if PricingService found nothing applied,
    // we still want to check for "Near Miss" manual combo opportunities.

    let opportunities: CartPromotionOpportunity[] = [];

    if (carriers.length > 0) {
      const suggestionProductIds = carriers
        .flatMap((carrier) => carrier.suggestions ?? [])
        .map((suggestion) => suggestion.productId)
        .filter((id): id is number => typeof id === 'number' && id > 0);

      await this.contextFactory.ensure(suggestionProductIds, contextMap);
      const copy = getCartCopy(locale);

      opportunities = carriers.map((carrier) => {
        const missingProducts = (carrier.suggestions ?? []).map((suggestion) =>
          this.toPromotionProductGap(suggestion, contextMap.get(suggestion.productId)),
        );

        const missingQuantity = missingProducts.reduce((sum, gap) => sum + gap.missingQuantity, 0);

        return {
          promotionId: carrier.promotionId,
          promotionName: carrier.promotionName,
          description: carrier.description ?? undefined,
          comboType: carrier.comboType ?? undefined,
          summary: missingQuantity
            ? copy.promotionSummary({ promotionName: carrier.promotionName, missingQuantity })
            : copy.promotionFallback(),
          potentialDiscount: carrier.amount || null,
          primaryProductId: missingProducts[0]?.productId,
          missingProducts,
        } satisfies CartPromotionOpportunity;
      });
    }

    const existingPromotionIds = new Set(
      opportunities.map((opportunity) => opportunity.promotionId),
    );
    const comboGapOpportunities = await this.buildComboGapOpportunities(
      items,
      locale,
      contextMap,
      existingPromotionIds,
    );

    if (comboGapOpportunities.length) {
      this.logger.debug(
        `[buildPromotionOpportunities] Combo gap opportunities=${comboGapOpportunities.length}`,
      );
    }

    const promoOutputLog = this.safeJson({
      opportunityCount: opportunities.length + comboGapOpportunities.length,
      // suggestionProducts: suggestionProductIds,
    });
    this.logger.debug(`[buildPromotionOpportunities] Output=${promoOutputLog}`);

    return [...opportunities, ...comboGapOpportunities];
  }

  private async buildComboGapOpportunities(
    items: Array<{ productId: number; variantId?: number; quantity: number }>,
    locale: SupportedLocale,
    contextMap: Map<number, CartProductContext>,
    excludedPromotionIds: Set<number>,
  ): Promise<CartPromotionOpportunity[]> {
    const copy = getCartCopy(locale);
    const productQuantities = new Map<number, number>();
    items.forEach((item) => {
      const current = productQuantities.get(item.productId) ?? 0;
      productQuantities.set(item.productId, current + item.quantity);
    });

    if (!productQuantities.size) {
      return [];
    }

    const now = new Date();
    const promotions = await this.promotionRepository.find({
      where: {
        type: PromotionType.COMBO,
        isActive: true,
        startDate: LessThanOrEqual(now),
        endDate: MoreThanOrEqual(now),
      },
      relations: {
        conditions: true,
      },
    });

    this.logger.debug(
      `[buildComboGapOpportunities] Found ${promotions.length} active combo promotions. Excluded IDs: ${Array.from(excludedPromotionIds).join(',')}`,
    );

    const opportunities: CartPromotionOpportunity[] = [];

    for (const promotion of promotions) {
      if (excludedPromotionIds.has(promotion.id)) {
        continue;
      }

      const buyConditions = (promotion.conditions ?? []).filter(
        (condition) => condition.role === PromotionConditionRole.BUY,
      );

      if (!buyConditions.length) {
        this.logger.debug(`[combo-gap] Promo ${promotion.id} skipped: No BUY conditions`);
        continue;
      }

      // Snapshot status of each condition against current cart
      const conditionSnapshots = buyConditions.map((condition) => {
        const requiredQuantity = Math.max(1, condition.quantity);
        const currentQuantity = productQuantities.get(condition.productId) ?? 0;
        // Missing is distinct from total required; it's the gap to fill
        const missingQuantity = Math.max(0, requiredQuantity - currentQuantity);
        return { condition, requiredQuantity, currentQuantity, missingQuantity };
      });

      // To be a valid "Gap Opportunity", the user must have at least ONE item from the combo explicitly in cart
      // OR they have fulfilled at least one condition fully.
      // Basically: hasPresence means "User has started checking out this combo"
      const hasPresence = conditionSnapshots.some((entry) => entry.currentQuantity > 0);

      // We only care if there is actually something MISSING. If missingQuantity is 0 for all, the promo is fully applied (handled by PricingService)
      const missingProductsSnapshots = conditionSnapshots.filter(
        (entry) => entry.missingQuantity > 0,
      );

      if (!hasPresence || !missingProductsSnapshots.length) {
        this.logger.debug(
          `[combo-gap] Promo ${promotion.id} skipped: hasPresence=${hasPresence} missing=${missingProductsSnapshots.length}`,
        );
        continue;
      }

      const missingProductIds = missingProductsSnapshots.map((entry) => entry.condition.productId);
      await this.contextFactory.ensure(missingProductIds, contextMap);

      const missingProducts = missingProductsSnapshots.map((entry) =>
        this.buildGapFromCondition(
          entry.condition,
          entry.currentQuantity,
          entry.missingQuantity,
          contextMap.get(entry.condition.productId),
        ),
      );

      const missingQuantityTotal = missingProducts.reduce(
        (sum, gap) => sum + gap.missingQuantity,
        0,
      );

      // Calculate potential discount if they complete the combo
      // This is an estimation: "If you add these missing items, you get X discount"
      const potentialDiscount = this.estimatePromotionDiscount(
        promotion,
        buyConditions,
        contextMap,
      );

      this.logger.debug(
        `[combo-gap] Found opportunity promo=${promotion.id} missing=${missingQuantityTotal} discount=${potentialDiscount}`,
      );

      opportunities.push({
        promotionId: promotion.id,
        promotionName: promotion.name,
        description: promotion.description ?? undefined,
        comboType: promotion.comboType ?? undefined,
        summary: copy.promotionSummary({
          promotionName: promotion.name,
          missingQuantity: missingQuantityTotal,
        }),
        potentialDiscount,
        primaryProductId: missingProducts[0]?.productId,
        missingProducts,
      });
    }

    return opportunities;
  }

  private toPromotionProductGap(
    suggestion: PromotionSuggestionItem,
    context?: CartProductContext,
  ): CartPromotionProductGap {
    return {
      productId: suggestion.productId,
      productName: context?.name ?? suggestion.productName ?? null,
      productSlug: context?.slug ?? null,
      productImage: context?.image ?? suggestion.productImage ?? null,
      productPrice: context?.minPrice ?? suggestion.productPrice ?? null,
      requiredQuantity: suggestion.requiredQuantity,
      currentQuantity: suggestion.currentQuantity,
      missingQuantity: suggestion.missingQuantity,
      autoAdd: suggestion.autoAdd,
    };
  }

  private buildGapFromCondition(
    condition: { productId: number; quantity: number },
    currentQuantity: number,
    missingQuantity: number,
    context?: CartProductContext,
  ): CartPromotionProductGap {
    return {
      productId: condition.productId,
      productName: context?.name ?? null,
      productSlug: context?.slug ?? null,
      productImage: context?.image ?? null,
      productPrice: context?.minPrice ?? null,
      requiredQuantity: Math.max(1, condition.quantity),
      currentQuantity,
      missingQuantity,
      autoAdd: false,
    };
  }

  private estimatePromotionDiscount(
    promotion: Promotion,
    buyConditions: Array<{ productId: number; quantity: number }>,
    contextMap: Map<number, CartProductContext>,
  ): number | null {
    let estimatedBaseAmount = 0;
    for (const condition of buyConditions) {
      const context = contextMap.get(condition.productId);
      const price = Number(context?.minPrice); // Safely cast to number

      if (!context || isNaN(price)) {
        continue;
      }
      estimatedBaseAmount += price * Math.max(1, condition.quantity);
    }

    if (!estimatedBaseAmount) {
      return null;
    }

    let discountAmount: number;
    if (promotion.discountType === DiscountType.PERCENT) {
      discountAmount = (estimatedBaseAmount * promotion.discountValue) / 100;
    } else {
      discountAmount = promotion.discountValue;
    }

    if (promotion.maxDiscount && promotion.maxDiscount > 0) {
      discountAmount = Math.min(discountAmount, promotion.maxDiscount);
    }

    if (!Number.isFinite(discountAmount) || discountAmount <= 0) {
      return null;
    }

    return Math.round(discountAmount);
  }

  private buildComparisonOpportunities(
    locale: SupportedLocale,
    contextMap: Map<number, CartProductContext>,
  ): CartComparisonOpportunity[] {
    const comparisonInputLog = this.safeJson({
      locale,
      contextIds: Array.from(contextMap.keys()),
    });
    this.logger.debug(`[buildComparisonOpportunities] Input=${comparisonInputLog}`);
    const groups = new Map<string, CartProductContext[]>();

    for (const context of contextMap.values()) {
      if (!context.category) {
        continue;
      }
      const normalizedCategory = context.category.toLowerCase();
      const bucket = groups.get(normalizedCategory) ?? [];
      bucket.push(context);
      groups.set(normalizedCategory, bucket);
    }

    const copy = getCartCopy(locale);
    const opportunities: CartComparisonOpportunity[] = [];

    for (const [category, items] of groups.entries()) {
      if (items.length < 2) {
        continue;
      }

      const sorted = [...items].sort((a, b) => (a.minPrice ?? 0) - (b.minPrice ?? 0));
      const limited = sorted.slice(0, 3);
      const comparisonId = `${category}-${limited.map((item) => item.id).join('-')}`;

      opportunities.push({
        comparisonId,
        reason: copy.comparisonReason(items[0]?.category ?? null),
        productIds: limited.map((item) => item.id),
        products: limited.map((item) => this.toComparisonSummary(item)),
      });
    }

    const limited = opportunities.slice(0, 3);
    const comparisonOutputLog = this.safeJson({
      generated: opportunities.length,
      trimmedTo: limited.length,
      comparisonIds: limited.map((opp) => opp.comparisonId),
    });
    this.logger.debug(`[buildComparisonOpportunities] Output=${comparisonOutputLog}`);
    return limited;
  }

  private safeJson(input: unknown): string {
    try {
      return JSON.stringify(input);
    } catch (error) {
      return `[unserializable:${this.stringifyError(error)}]`;
    }
  }

  private toComparisonSummary(context: CartProductContext): CartComparisonProductSummary {
    return {
      productId: context.id,
      name: context.name,
      brand: context.brand ?? undefined,
      category: context.category ?? undefined,
      priceRange: context.priceRange ?? undefined,
      thumbnail: context.image ?? undefined,
    };
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
