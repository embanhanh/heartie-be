import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';

import { ProductsService, StylistCandidateProduct } from '../products/products.service';
import {
  ProactiveStylistRequestDto,
  ProactiveStylistResponse,
  ProactiveStylistSuggestion,
  ProactiveStylistOutfitItemSuggestion,
} from './dto/proactive-stylist.dto';
import {
  CartAnalysisRequestDto,
  CartAnalysisResponse,
  CartAnalysisSuggestion,
  CartInsightCategory,
} from './dto/cart-analysis.dto';

export interface AiCustomerFeatureManifestItem {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  actions: Array<{
    key: string;
    label: string;
    description: string;
  }>;
}

export interface AiCustomerManifestResponse {
  features: AiCustomerFeatureManifestItem[];
  updatedAt: string;
}

const PROACTIVE_STYLIST_SYSTEM_PROMPT = `Bạn là "Fia Stylist" — trợ lý phối đồ cho khách hàng Fashia. Luôn lịch sự, tinh tế và thực tế.
- Chỉ gợi ý những món đồ phổ biến, dễ tìm (quần jean, blazer, giày sneaker, v.v.).
- Mỗi outfit nên có tối thiểu 3 món: phần dưới, phần ngoài (nếu hợp), phụ kiện/giày.
- Ưu tiên sử dụng tiếng Việt, câu ngắn, giàu tính định hướng.
- Tránh lặp lại cùng một ý ở nhiều outfit.`;

const CART_ASSISTANT_SYSTEM_PROMPT = `Bạn là "Fia Cart" — trợ lý giỏ hàng của khách Fashia.
- Nhận diện trùng lặp, thiếu phối, cơ hội upsell, hoặc ưu đãi.
- Chỉ cung cấp đúng 1 insight quan trọng nhất.
- Nếu không có insight hữu ích, trả về null.
- Ngắn gọn, thân thiện và hành động được ngay.`;

@Injectable()
export class AiCustomerService {
  private readonly logger = new Logger(AiCustomerService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * Provide a static manifest describing the ambient AI touchpoints for the storefront.
   * This gives the frontend a single place to learn what proactive assistants are available.
   * Later iterations can hydrate this manifest dynamically from configuration or persistence.
   */
  getManifest(): AiCustomerManifestResponse {
    const now = new Date().toISOString();

    return {
      features: [
        {
          key: 'proactive-stylist',
          label: 'Proactive Stylist',
          description:
            'Observes product intent signals (scroll idle, focus) and offers curated outfit guidance.',
          enabled: true,
          actions: [
            {
              key: 'magic-mirror-suggestions',
              label: 'Magic Mirror Suggestions',
              description:
                'Generates three mix-and-match outfit ideas when shoppers pause on a product.',
            },
          ],
        },
        {
          key: 'contextual-cart-assistant',
          label: 'Contextual Cart Assistant',
          description:
            'Analyzes cart composition to highlight duplicates, upsell ideas, or decision helpers.',
          enabled: true,
          actions: [
            {
              key: 'cart-smart-hints',
              label: 'Cart Smart Hints',
              description:
                'Surfaces a single actionable insight when shoppers review their cart contents.',
            },
          ],
        },
      ],
      updatedAt: now,
    };
  }

  async generateProactiveStylistSuggestions(
    payload: ProactiveStylistRequestDto,
  ): Promise<ProactiveStylistResponse> {
    const signalCount = payload.signals?.length ?? 0;
    const variantId = payload.variant?.variantId ?? null;
    this.logger.debug(
      `Stylist request received for product ${payload.productId} (variant=${variantId ?? 'none'}, signals=${signalCount})`,
    );

    const product = (await this.productsService.findOne(
      payload.productId,
    )) as ProductDetailHydrated | null;

    if (!product) {
      throw new NotFoundException(`Product ${payload.productId} was not found`);
    }

    const productSnapshot = this.composeProductSnapshot(product, payload.variant?.variantId);
    this.logger.debug(
      `Stylist focus snapshot prepared: ${JSON.stringify({
        id: productSnapshot.id,
        name: productSnapshot.name,
        brand: productSnapshot.brand,
        category: productSnapshot.category,
        variantSelected: Boolean(productSnapshot.selectedVariant),
      })}`,
    );

    const rawCatalogue = await this.productsService.buildStylistCatalogue(productSnapshot.id, {
      limit: 40,
      includeFocus: true,
    });

    this.logger.debug(
      `Stylist catalogue fetched with ${rawCatalogue.length} entries (focus included=${rawCatalogue.some((item) => item.id === productSnapshot.id)})`,
    );

    const stylistCatalogue = this.prepareStylistCatalogue(productSnapshot, rawCatalogue);
    const candidateMap = new Map<number, StylistCandidateSummary>();
    for (const candidate of stylistCatalogue) {
      candidateMap.set(candidate.id, candidate);
    }

    this.logger.debug(
      `Stylist catalogue prepared for product ${productSnapshot.id} with ${stylistCatalogue.length} candidates`,
    );

    const prompt = this.renderProactiveStylistPrompt(productSnapshot, payload, stylistCatalogue);
    const promptPreview = prompt.replace(/\s+/g, ' ').slice(0, 160);
    this.logger.debug(
      `Stylist prompt ready (length=${prompt.length} chars, preview="${promptPreview}${prompt.length > 160 ? '…' : ''}")`,
    );

    let parsed: { headline?: string; suggestions: ProactiveStylistSuggestion[] } | null = null;
    let structuredError: string | null = null;

    try {
      const text = await this.geminiService.generateStructuredContent(prompt, {
        systemPrompt: PROACTIVE_STYLIST_SYSTEM_PROMPT,
        temperature: 0.35,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        retryAttempts: 3,
      });

      parsed = this.parseProactiveStylistResponse(text, candidateMap, productSnapshot.id);
      if (!parsed) {
        this.logger.warn('Gemini returned unparsable stylist response, using fallback suggestions');
      } else {
        this.logger.debug(
          `Stylist structured response parsed with ${parsed.suggestions.length} suggestion(s)`,
        );
      }
    } catch (error) {
      structuredError = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Gemini structured stylist generation failed for product ${productSnapshot.id}: ${structuredError}`,
      );
    }

    const suggestions = parsed?.suggestions?.length
      ? parsed.suggestions
      : this.buildFallbackStylistSuggestions(productSnapshot);

    if (!parsed?.suggestions?.length) {
      this.logger.debug(
        `Stylist fallback engaged for product ${productSnapshot.id} (reason=${structuredError ?? 'empty suggestions'})`,
      );
    }

    this.logger.debug(
      `Stylist response composed with ${suggestions.length} suggestion(s); fallbackApplied=${Boolean(
        structuredError || !parsed?.suggestions?.length,
      )}`,
    );

    const responseSnapshot = {
      id: productSnapshot.id,
      name: productSnapshot.name,
      category: productSnapshot.category,
      brand: productSnapshot.brand,
      priceRange: productSnapshot.priceRange,
      image: productSnapshot.image,
    };

    return {
      headline: parsed?.headline ?? `Fia gợi ý phối đồ cùng ${productSnapshot.name}`,
      suggestions,
      fallbackApplied: Boolean(structuredError || !parsed?.suggestions?.length),
      productSnapshot: responseSnapshot,
    };
  }

  async analyzeCart(payload: CartAnalysisRequestDto): Promise<CartAnalysisResponse> {
    const uniqueProductIds = Array.from(new Set(payload.items.map((item) => item.productId)));

    const productDetails = await Promise.all(
      uniqueProductIds.map(async (productId) => {
        try {
          const detail = (await this.productsService.findOne(
            productId,
          )) as ProductDetailHydrated | null;

          if (!detail) {
            this.logger.warn(`Cart analysis skipped missing product ${productId}`);
          }

          return detail;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to load product ${productId} for cart analysis: ${message}`);
          return null;
        }
      }),
    );

    const productCatalogue = productDetails
      .filter((item): item is ProductDetailHydrated => Boolean(item))
      .map((item) => this.composeProductSnapshot(item));

    const prompt = this.renderCartAnalysisPrompt(payload, productCatalogue);

    const text = await this.geminiService.generateStructuredContent(prompt, {
      systemPrompt: CART_ASSISTANT_SYSTEM_PROMPT,
      temperature: 0.2,
      maxOutputTokens: 768,
      responseMimeType: 'application/json',
    });

    const parsed = this.parseCartAnalysisResponse(text);
    if (!parsed) {
      this.logger.warn('Gemini returned unparsable cart insight, defaulting to null suggestion');
    }

    return {
      suggestion: parsed?.suggestion ?? null,
      fallbackApplied: !parsed,
      inspectedItems: payload.items.length,
    };
  }

  async generateProductSummary(payload: {
    productId: number;
    locale?: string;
  }): Promise<{ summary: string | null }> {
    const product = (await this.productsService.findOne(
      payload.productId,
    )) as ProductDetailHydrated | null;

    if (!product) {
      this.logger.warn(`product-summary: product ${payload.productId} not found`);
      return { summary: null };
    }

    const snapshot = this.composeProductSnapshot(product);
    const brandName = snapshot.brand ?? '';
    const categoryName = snapshot.category ?? '';
    const prompt = `Tóm tắt ngắn gọn (1-2 câu) về sản phẩm sau để giúp khách hàng quyết định mua: ${product.name}\nThông tin: brand=${brandName}, category=${categoryName}, price=${snapshot.priceRange ?? 'n/a'}\nChỉ trả về plain text summary.`;

    try {
      const text = await this.geminiService.generateStructuredContent(prompt, {
        temperature: 0.2,
        maxOutputTokens: 200,
      });

      const summary = typeof text === 'string' ? text.trim() : null;
      return { summary };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`generateProductSummary failed for ${payload.productId}: ${msg}`);
      return { summary: null };
    }
  }

  async generateReviewsSummary(payload: {
    productId: number;
    locale?: string;
  }): Promise<{ summary: string | null }> {
    // collect reviews from productsService if available
    try {
      // Try to collect reviews if the productsService supports it.
      let sample = '';
      const svc = this.productsService as unknown as {
        getReviewsForProduct?: (productId: number) => Promise<Array<{ text?: string }>>;
      };

      if (typeof svc.getReviewsForProduct === 'function') {
        const reviews = await svc.getReviewsForProduct(payload.productId);
        if (Array.isArray(reviews) && reviews.length) {
          sample = reviews
            .slice(0, 40)
            .map((r) => (typeof r === 'object' && typeof r.text === 'string' ? r.text.trim() : ''))
            .filter((s) => s.length > 0)
            .join('\n');
        }
      }

      if (!sample) {
        this.logger.debug(
          `No reviews sample available for product ${payload.productId}; skipping reviews summary.`,
        );
        return { summary: null };
      }

      const prompt = `Tóm tắt ngắn gọn các review sau: ${sample}\nHãy nhấn mạnh điểm mạnh/điểm yếu lặp lại và tóm tắt cảm nhận chung (2-3 câu). Chỉ trả về plain text.`;

      const text = await this.geminiService.generateStructuredContent(prompt, {
        temperature: 0.25,
        maxOutputTokens: 300,
      });

      return { summary: typeof text === 'string' ? text.trim() : null };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`generateReviewsSummary failed for ${payload.productId}: ${msg}`);
      return { summary: null };
    }
  }

  private prepareStylistCatalogue(
    focusProduct: ProductSnapshot,
    catalogue: StylistCandidateProduct[],
  ): StylistCandidateSummary[] {
    const focusId = focusProduct.id;
    const seen = new Set<number>();
    const result: StylistCandidateSummary[] = [];

    const pushCandidate = (candidate: StylistCandidateSummary) => {
      if (seen.has(candidate.id)) {
        return;
      }
      seen.add(candidate.id);
      result.push(candidate);
    };

    for (const item of catalogue) {
      const priceRange = this.formatPriceRange(item.minPrice, item.maxPrice);
      pushCandidate({
        id: item.id,
        name: item.name,
        brand: item.brand ?? null,
        category: item.category ?? null,
        priceRange: priceRange ?? (item.id === focusId ? focusProduct.priceRange : null),
        tags: item.attributes.slice(0, 6),
        image: item.image ?? null,
        score: item.score,
        isFocus: item.id === focusId,
      });
    }

    if (!seen.has(focusId)) {
      pushCandidate({
        id: focusProduct.id,
        name: focusProduct.name,
        brand: focusProduct.brand,
        category: focusProduct.category,
        priceRange: focusProduct.priceRange,
        tags: [],
        image: focusProduct.image,
        score: 1,
        isFocus: true,
      });
    }

    return result;
  }

  private renderProactiveStylistPrompt(
    product: ProductSnapshot,
    payload: ProactiveStylistRequestDto,
    catalogue: StylistCandidateSummary[],
  ): string {
    const signals = payload.signals?.length
      ? payload.signals
          .map((signal) => {
            const duration = signal.durationMs ?? 'n/a';
            const intensity = signal.intensity ?? 'n/a';
            return `  - type: ${signal.type}, durationMs: ${duration}, intensity: ${intensity}`;
          })
          .join('\n')
      : '  - none captured';

    const focusDescriptor = {
      id: product.id,
      name: product.name,
      brand: product.brand ?? 'Fashia',
      category: product.category ?? 'Không rõ',
      priceRange: product.priceRange ?? 'Không rõ',
      selectedVariant: product.selectedVariant?.attributeSummary ?? null,
    };

    const catalogueLines = catalogue
      .filter((item) => !item.isFocus)
      .slice(0, 40)
      .map((item, index) => {
        const tags = item.tags.slice(0, 5).join(', ') || 'không rõ';
        const price = item.priceRange ?? 'không rõ';
        const brand = item.brand ?? 'không rõ';
        const category = item.category ?? 'không rõ';
        const similarity = item.score ? item.score.toFixed(2) : '0.00';
        return `${index + 1}. id=${item.id}; tên="${item.name}"; danh_mục=${category}; thương_hiệu=${brand}; giá=${price}; tags=${tags}; similarity=${similarity}`;
      })
      .join('\n');

    const catalogueSection = catalogueLines.length
      ? catalogueLines
      : '- Không có sản phẩm phụ trợ phù hợp, hãy ưu tiên layer/phụ kiện cơ bản dễ phối.';

    return `Bạn là Stylist AI của Fashia. Hãy tạo ra 1 đến 3 outfit hoàn chỉnh dựa trên nguồn dữ liệu dưới đây.

Sản phẩm trung tâm (focus_item):
${JSON.stringify(focusDescriptor, null, 2)}

Danh sách sản phẩm tương đồng (catalogue, chỉ dùng các productId trong danh sách này):
${catalogueSection}

Tín hiệu hành vi:
${signals}

Nhiệm vụ:
- Mỗi outfit phải bao gồm sản phẩm focus có id=${product.id}.
- Chỉ chọn thêm 2-4 sản phẩm từ catalogue; không bịa thêm sản phẩm mới.
- Giữ văn phong ngắn gọn, nêu rõ lý do phối và dịp phù hợp.
- Không lặp lại cùng một sản phẩm ở nhiều outfit trừ khi thực sự cần thiết.

Schema JSON bắt buộc:
{
  "headline": string,
  "outfits": [
    {
      "title": string,
      "summary": string,
      "occasion": string | null,
      "items": [
        {
          "productId": number,
          "role": "focus" | "top" | "bottom" | "layer" | "footwear" | "accessory",
          "reason": string
        }
      ]
    }
  ],
  "notes": string | null
}

Quan trọng: chỉ xuất JSON hợp lệ, không thêm lời dẫn hoặc giải thích ngoài JSON.`;
  }

  private renderCartAnalysisPrompt(
    payload: CartAnalysisRequestDto,
    catalogue: ProductSnapshot[],
  ): string {
    const cartSummary = payload.items
      .map(
        (item) =>
          `- productId=${item.productId}, variantId=${item.variantId ?? 'n/a'}, quantity=${item.quantity ?? 1}`,
      )
      .join('\n');

    return `Bạn là trợ lý giỏ hàng thông minh của Fashia. Phân tích giỏ hàng và đưa ra duy nhất 1 gợi ý hữu ích (hoặc null nếu không cần).

Dữ liệu sản phẩm (catalogue):
${JSON.stringify(catalogue, null, 2)}

Giỏ hàng hiện tại:
${cartSummary}

Trả về JSON với schema:
{
  "suggestion": null | {
    "category": "duplicates" | "comparison" | "cross-sell" | "promotion" | "shipping" | "styling" | "none",
    "title": string,
    "message": string,
    "recommendation": string | null
  }
}

Không viết thêm mô tả, chỉ xuất JSON.`;
  }

  private parseProactiveStylistResponse(
    raw: string | null,
    candidates: Map<number, StylistCandidateSummary>,
    focusProductId: number,
  ): { headline?: string; suggestions: ProactiveStylistSuggestion[] } | null {
    const json = this.extractJson(raw);
    if (!json) {
      return null;
    }

    const plan = json as GeminiStylistPlanPayload;
    const outfits = this.extractOutfitPlans(plan);
    const focusCandidate = candidates.get(focusProductId);

    const suggestions = outfits
      .map((outfit, index) => this.convertGeminiOutfit(outfit, candidates, focusCandidate, index))
      .filter((entry): entry is ProactiveStylistSuggestion => Boolean(entry))
      .slice(0, 3);

    if (suggestions.length) {
      const headline = this.extractPlanHeadline(plan) ?? undefined;
      return { headline, suggestions };
    }

    return this.parseLegacyProactiveStylistResponse(json);
  }

  private extractOutfitPlans(plan: GeminiStylistPlanPayload): GeminiStylistPlanOutfit[] {
    const raw = Array.isArray(plan.outfits)
      ? plan.outfits
      : Array.isArray(plan.suggestions)
        ? plan.suggestions
        : [];

    const outfits: GeminiStylistPlanOutfit[] = [];

    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const record = entry as Record<string, unknown>;

      outfits.push({
        title: typeof record.title === 'string' ? record.title : undefined,
        name: typeof record.name === 'string' ? record.name : undefined,
        summary: typeof record.summary === 'string' ? record.summary : undefined,
        overview: typeof record.overview === 'string' ? record.overview : undefined,
        description: typeof record.description === 'string' ? record.description : undefined,
        occasion:
          typeof record.occasion === 'string' && record.occasion.trim().length
            ? record.occasion
            : null,
        items: record.items,
      });
    }

    return outfits;
  }

  private convertGeminiOutfit(
    outfit: GeminiStylistPlanOutfit,
    candidates: Map<number, StylistCandidateSummary>,
    focusCandidate: StylistCandidateSummary | undefined,
    index: number,
  ): ProactiveStylistSuggestion | null {
    const itemsRaw = Array.isArray(outfit.items) ? outfit.items : [];
    const items: ProactiveStylistOutfitItemSuggestion[] = [];

    for (const entry of itemsRaw) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const record = entry as Record<string, unknown>;
      const productId = this.toNumberOrNull(
        record.productId ?? record.id ?? record.product_id ?? record.productID,
      );

      if (!productId) {
        continue;
      }

      const candidate = candidates.get(productId);
      if (!candidate) {
        continue;
      }

      const reason = this.extractPlanItemReason(record);
      const role = this.extractPlanItemRole(record);
      items.push(this.buildStylistItem(candidate, reason, role));
    }

    const ensuredItems = this.ensureFocusItem(items, focusCandidate);
    if (ensuredItems.length < 2) {
      return null;
    }

    const titleCandidates = [outfit.title, outfit.name];
    const summaryCandidates = [outfit.summary, outfit.overview, outfit.description];

    const title = titleCandidates
      .find((item): item is string => typeof item === 'string' && item.trim().length > 0)
      ?.trim();

    const summary = summaryCandidates
      .find((item): item is string => typeof item === 'string' && item.trim().length > 0)
      ?.trim();

    const occasion =
      typeof outfit.occasion === 'string' && outfit.occasion.trim().length
        ? outfit.occasion.trim()
        : undefined;

    return {
      title: title ?? `Gợi ý phối đồ ${index + 1}`,
      summary: summary ?? this.composeSummaryFromItems(ensuredItems),
      items: ensuredItems,
      occasionHint: occasion,
    };
  }

  private ensureFocusItem(
    items: ProactiveStylistOutfitItemSuggestion[],
    focusCandidate?: StylistCandidateSummary,
  ): ProactiveStylistOutfitItemSuggestion[] {
    if (!focusCandidate) {
      return items.slice(0, 5);
    }

    if (items.some((item) => item.productId === focusCandidate.id)) {
      return items.slice(0, 5);
    }

    const focusItem: ProactiveStylistOutfitItemSuggestion = {
      name: focusCandidate.name,
      description: this.composeCandidateDescription(focusCandidate),
      categoryHint: 'focus',
      pairingReason: 'Sản phẩm chủ đạo làm điểm nhấn cho outfit.',
      image: focusCandidate.image ?? undefined,
      productId: focusCandidate.id,
    };

    return [focusItem, ...items].slice(0, 5);
  }

  private buildStylistItem(
    candidate: StylistCandidateSummary,
    reason: string | undefined,
    role: string | undefined,
  ): ProactiveStylistOutfitItemSuggestion {
    return {
      name: candidate.name,
      description: this.composeCandidateDescription(candidate),
      categoryHint: role ?? candidate.category ?? undefined,
      pairingReason: reason,
      image: candidate.image ?? undefined,
      productId: candidate.id,
    };
  }

  private composeCandidateDescription(candidate: StylistCandidateSummary): string | undefined {
    const fragments: string[] = [];

    if (candidate.brand) {
      fragments.push(candidate.brand);
    }

    if (candidate.category) {
      fragments.push(candidate.category);
    }

    if (candidate.priceRange) {
      fragments.push(candidate.priceRange);
    }

    if (!fragments.length && candidate.tags.length) {
      fragments.push(candidate.tags.slice(0, 2).join(', '));
    }

    if (!fragments.length) {
      return undefined;
    }

    return fragments.join(' • ');
  }

  private composeSummaryFromItems(items: ProactiveStylistOutfitItemSuggestion[]): string {
    const reasons = items
      .map((item) => item.pairingReason)
      .filter((reason): reason is string => Boolean(reason))
      .slice(0, 2);

    if (reasons.length) {
      return reasons.join(' ');
    }

    if (items.length >= 2) {
      return `Phối ${items[0].name} cùng ${items[1].name} để tạo tổng thể hài hòa.`;
    }

    return `Phối ${items[0].name} thành điểm nhấn cho outfit.`;
  }

  private extractPlanHeadline(plan: GeminiStylistPlanPayload): string | null {
    const candidates = [plan.headline, plan.title];
    for (const entry of candidates) {
      if (typeof entry === 'string' && entry.trim().length) {
        return entry.trim();
      }
    }
    return null;
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private extractPlanItemReason(record: Record<string, unknown>): string | undefined {
    const candidates = ['reason', 'pairingReason', 'rationale', 'note', 'why'];
    for (const key of candidates) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length) {
        return value.trim();
      }
    }
    return undefined;
  }

  private extractPlanItemRole(record: Record<string, unknown>): string | undefined {
    const value = record.role ?? record.category ?? record.position;
    if (typeof value === 'string' && value.trim().length) {
      return value.trim();
    }
    return undefined;
  }

  private parseLegacyProactiveStylistResponse(
    json: Record<string, unknown>,
  ): { headline?: string; suggestions: ProactiveStylistSuggestion[] } | null {
    const suggestionsRaw = Array.isArray(json.suggestions) ? json.suggestions : [];
    const suggestions = suggestionsRaw
      .map((entry) => this.normalizeLegacyStylistSuggestion(entry))
      .filter((entry): entry is ProactiveStylistSuggestion => Boolean(entry));

    const headline = typeof json.headline === 'string' ? json.headline : undefined;

    if (!headline && suggestions.length === 0) {
      return null;
    }

    return { headline, suggestions };
  }

  private normalizeLegacyStylistSuggestion(entry: unknown): ProactiveStylistSuggestion | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const candidate = entry as Record<string, unknown>;
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
    const summary = typeof candidate.summary === 'string' ? candidate.summary.trim() : '';
    const occasionHint =
      typeof candidate.occasionHint === 'string' && candidate.occasionHint.trim().length
        ? candidate.occasionHint.trim()
        : undefined;

    const itemsRaw = Array.isArray(candidate.items) ? candidate.items : [];
    const items = itemsRaw
      .map((item) => this.normalizeLegacyStylistItem(item))
      .filter((item): item is ProactiveStylistOutfitItemSuggestion => Boolean(item));

    if (!title || !summary || items.length === 0) {
      return null;
    }

    return {
      title,
      summary,
      items,
      occasionHint,
    };
  }

  private normalizeLegacyStylistItem(entry: unknown): ProactiveStylistOutfitItemSuggestion | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const candidate = entry as Record<string, unknown>;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    if (!name) {
      return null;
    }

    const item: ProactiveStylistOutfitItemSuggestion = {
      name,
    };

    if (typeof candidate.description === 'string') {
      item.description = candidate.description.trim();
    }

    if (typeof candidate.categoryHint === 'string') {
      item.categoryHint = candidate.categoryHint.trim();
    }

    if (typeof candidate.pairingReason === 'string') {
      item.pairingReason = candidate.pairingReason.trim();
    }

    if (typeof candidate.image === 'string') {
      item.image = candidate.image.trim();
    }

    if (typeof candidate.productId === 'number') {
      item.productId = candidate.productId;
    }

    return item;
  }

  private parseCartAnalysisResponse(
    raw?: string | null,
  ): { suggestion: CartAnalysisSuggestion | null } | null {
    const json = this.extractJson(raw);
    if (!json) {
      return null;
    }

    if (json.suggestion === null) {
      return { suggestion: null };
    }

    const suggestion = this.normalizeCartSuggestion(json.suggestion);
    if (!suggestion) {
      return null;
    }

    return { suggestion };
  }

  private normalizeCartSuggestion(entry: unknown): CartAnalysisSuggestion | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const candidate = entry as Record<string, unknown>;
    const category = this.normalizeCartCategory(candidate.category);
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
    const message = typeof candidate.message === 'string' ? candidate.message.trim() : '';

    if (!category || !title || !message) {
      return null;
    }

    const suggestion: CartAnalysisSuggestion = {
      category,
      title,
      message,
    };

    if (typeof candidate.recommendation === 'string') {
      const trimmed = candidate.recommendation.trim();
      if (trimmed.length) {
        suggestion.recommendation = trimmed;
      }
    }

    return suggestion;
  }

  private normalizeCartCategory(category: unknown): CartInsightCategory | null {
    const allowed: CartInsightCategory[] = [
      'duplicates',
      'comparison',
      'cross-sell',
      'promotion',
      'shipping',
      'styling',
      'none',
    ];

    if (typeof category === 'string' && allowed.includes(category as CartInsightCategory)) {
      return category as CartInsightCategory;
    }

    return null;
  }

  private extractJson(raw?: string | null): Record<string, unknown> | null {
    if (!raw) {
      return null;
    }

    const trimmed = raw.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    const candidate = trimmed.slice(start, end + 1);

    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to parse Gemini JSON payload: ${message}`);
      this.logger.debug(`Gemini raw payload: ${raw}`);
      return null;
    }
  }

  private buildFallbackStylistSuggestions(product: ProductSnapshot): ProactiveStylistSuggestion[] {
    const baseName = product.name;
    return [
      {
        title: 'Phong cách công sở tinh gọn',
        summary: `Phối ${baseName} cùng quần âu và blazer sáng màu để tạo cảm giác chuyên nghiệp nhưng vẫn nhẹ nhàng.`,
        items: [
          {
            name: 'Quần âu ống suông',
            description: 'Tông trung tính giúp chiếc áo trở thành điểm nhấn.',
            categoryHint: 'bottom',
            pairingReason: 'Giữ tổng thể thanh lịch, phù hợp văn phòng.',
          },
          {
            name: 'Blazer màu be',
            description: 'Tạo chiều sâu layer và cân bằng màu sắc.',
            categoryHint: 'outerwear',
            pairingReason: 'Mang lại cảm giác chuyên nghiệp, dễ phối nhiều dịp.',
          },
          {
            name: 'Giày loafer tối màu',
            description: 'Hoàn thiện tổng thể chỉn chu, thoải mái di chuyển.',
            categoryHint: 'footwear',
            pairingReason: 'Phong cách công sở hiện đại.',
          },
        ],
        occasionHint: 'Đi làm, gặp gỡ đối tác',
      },
      {
        title: 'Phong cách dạo phố năng động',
        summary: `Nhấn mạnh sự trẻ trung của ${baseName} bằng denim và sneaker trắng.`,
        items: [
          {
            name: 'Quần jean ống đứng wash nhạt',
            description: 'Tạo độ tương phản vừa phải cho phần thân trên.',
            categoryHint: 'bottom',
            pairingReason: 'Giúp outfit cân đối, dễ mặc cuối tuần.',
          },
          {
            name: 'Áo khoác denim mỏng',
            description: 'Layer nhẹ nhàng, tăng chiều sâu khi thời tiết se lạnh.',
            categoryHint: 'outerwear',
            pairingReason: 'Mang lại vibe trẻ trung đường phố.',
          },
          {
            name: 'Sneaker trắng tối giản',
            description: 'Giữ outfit nhẹ nhàng nhưng nổi bật.',
            categoryHint: 'footwear',
            pairingReason: 'Dễ phối, tiện lợi cho nhiều hoạt động.',
          },
        ],
        occasionHint: 'Cafe cuối tuần, dạo phố',
      },
      {
        title: 'Phong cách tiệc tối tinh tế',
        summary: `Biến ${baseName} thành điểm nhấn sang trọng với chân váy midi và phụ kiện ánh kim.`,
        items: [
          {
            name: 'Chân váy midi satin',
            description: 'Chất liệu bắt sáng, tôn dáng nữ tính.',
            categoryHint: 'bottom',
            pairingReason: 'Tăng độ sang trọng, phù hợp sự kiện.',
          },
          {
            name: 'Áo khoác dạ dáng lửng',
            description: 'Giữ ấm vừa phải mà vẫn thanh lịch.',
            categoryHint: 'outerwear',
            pairingReason: 'Cân bằng tỷ lệ trang phục khi về đêm.',
          },
          {
            name: 'Giày cao gót mũi nhọn ánh kim',
            description: 'Hoàn thiện tổng thể nổi bật.',
            categoryHint: 'footwear',
            pairingReason: 'Tạo cảm giác sang trọng, nữ tính.',
          },
        ],
        occasionHint: 'Tiệc tối, sự kiện thân mật',
      },
    ];
  }

  private composeProductSnapshot(
    product: ProductDetailHydrated,
    selectedVariantId?: number,
  ): ProductSnapshot {
    const images = Array.isArray(product.images)
      ? product.images.filter((image): image is string => typeof image === 'string')
      : [];

    const variants = Array.isArray(product.variants)
      ? product.variants.filter((variant): variant is ProductVariantHydrated => Boolean(variant))
      : [];

    const numericPrices = variants
      .map((variant) => Number(variant.price))
      .filter((price) => Number.isFinite(price));

    const minPrice = numericPrices.length ? Math.min(...numericPrices) : null;
    const maxPrice = numericPrices.length ? Math.max(...numericPrices) : null;
    const priceRange = this.formatPriceRange(minPrice, maxPrice);

    return {
      id: product.id,
      name: product.name,
      category: product.category?.name ?? null,
      brand: product.brand?.name ?? null,
      priceRange,
      image: images.length ? images[0] : null,
      selectedVariant: selectedVariantId
        ? this.extractVariantSnapshot(product, selectedVariantId)
        : null,
    };
  }

  private extractVariantSnapshot(
    product: ProductDetailHydrated,
    variantId: number,
  ): VariantSnapshot | null {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const variant = variants.find((entry) => entry?.id === variantId);

    if (!variant) {
      return null;
    }

    const attributeEntries = Array.isArray(variant.attributeValues) ? variant.attributeValues : [];

    const attributes = attributeEntries.map((entry) => ({
      attribute: entry?.attribute?.name ?? undefined,
      value: entry?.attributeValue?.value ?? undefined,
    }));

    const attributeSummary = attributes
      .filter((attr) => attr.attribute && attr.value)
      .map((attr) => `${attr.attribute}: ${attr.value}`)
      .join(', ');

    return {
      id: variant.id,
      price: Number(variant.price) || 0,
      image: variant.image ?? null,
      attributes,
      attributeSummary: attributeSummary || null,
    };
  }

  private formatPriceRange(minPrice: number | null, maxPrice: number | null): string | null {
    if (minPrice === null || Number.isNaN(minPrice)) {
      return null;
    }

    const formatter = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    });

    if (maxPrice === null || Number.isNaN(maxPrice) || maxPrice === minPrice) {
      return formatter.format(minPrice);
    }

    return `${formatter.format(minPrice)} - ${formatter.format(maxPrice)}`;
  }
}

interface ProductVariantAttributeValueHydrated {
  attribute?: { name?: string | null } | null;
  attributeValue?: { value?: string | null } | null;
}

interface ProductVariantHydrated {
  id: number;
  price: number | string;
  image?: string | null;
  attributeValues?: ProductVariantAttributeValueHydrated[] | null;
}

interface ProductDetailHydrated {
  id: number;
  name: string;
  images?: string[] | null;
  category?: { name?: string | null } | null;
  brand?: { name?: string | null } | null;
  variants?: ProductVariantHydrated[] | null;
}

interface VariantSnapshot {
  id: number;
  price: number;
  image: string | null;
  attributes: Array<{ attribute?: string; value?: string }>;
  attributeSummary: string | null;
}

interface ProductSnapshot {
  id: number;
  name: string;
  category: string | null;
  brand: string | null;
  priceRange: string | null;
  image: string | null;
  selectedVariant: VariantSnapshot | null;
}

interface StylistCandidateSummary {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  priceRange: string | null;
  tags: string[];
  image: string | null;
  score: number;
  isFocus: boolean;
}

interface GeminiStylistPlanOutfit {
  title?: string;
  name?: string;
  summary?: string;
  overview?: string;
  description?: string;
  occasion?: string | null;
  items?: unknown;
}

interface GeminiStylistPlanPayload {
  headline?: string;
  title?: string;
  suggestions?: unknown;
  outfits?: unknown;
}
