import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ProductsService, StylistCandidateProduct } from '../products/products.service';
import { RatingsService } from '../ratings/ratings.service';
import {
  PRODUCT_COMPARISON_SYSTEM_PROMPT,
  PROACTIVE_STYLIST_SYSTEM_PROMPT,
} from './constants/prompts';
import type {
  AiCustomerManifestResponse,
  GeminiStylistPlanOutfit,
  GeminiStylistPlanPayload,
  ProductDetailHydrated,
  ProductSnapshot,
  ProductVariantHydrated,
  StylistCandidateSummary,
  VariantSnapshot,
} from './types/internal.types';
import type { AiCustomerFeatureManifestItem } from './types/internal.types';
export type {
  AiCustomerFeatureManifestItem,
  AiCustomerManifestResponse,
} from './types/internal.types';
import {
  ProactiveStylistRequestDto,
  ProactiveStylistResponse,
  ProactiveStylistSuggestion,
  ProactiveStylistOutfitItemSuggestion,
} from './dto/proactive-stylist.dto';
import { CartAnalysisRequestDto, CartAnalysisResponse } from './dto/cart-analysis.dto';
import {
  ProductComparisonRequestDto,
  ProductComparisonResponse,
} from './dto/product-comparison.dto';
import { CartInsightsService } from './services/cart-insights.service';

const manifestFeatures: AiCustomerFeatureManifestItem[] = [
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
        description: 'Generates three mix-and-match outfit ideas when shoppers pause on a product.',
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
];

@Injectable()
export class AiCustomerService {
  private readonly logger = new Logger(AiCustomerService.name);
  private geminiClient?: GoogleGenerativeAI;
  private readonly geminiModels = new Map<string, GenerativeModel>();

  constructor(
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
    private readonly cartInsightsService: CartInsightsService,
    private readonly ratingsService: RatingsService,
  ) {}

  /**
   * Provide a static manifest describing the ambient AI touchpoints for the storefront.
   * This gives the frontend a single place to learn what proactive assistants are available.
   * Later iterations can hydrate this manifest dynamically from configuration or persistence.
   */
  getManifest(): AiCustomerManifestResponse {
    return {
      features: manifestFeatures,
      updatedAt: new Date().toISOString(),
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

    try {
      const text = await this.generateGeminiContent({
        modelName: this.resolveModelName('GEMINI_STYLIST_MODEL'),
        prompt,
        systemInstruction: PROACTIVE_STYLIST_SYSTEM_PROMPT,
        temperature: 0.35,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        retryAttempts: 3,
      });

      parsed = this.parseProactiveStylistResponse(text, candidateMap, productSnapshot.id);
    } catch (error) {
      const structuredError = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Gemini structured stylist generation failed for product ${productSnapshot.id}: ${structuredError}`,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadRequestException('Không tạo được gợi ý phối đồ. Vui lòng thử lại sau.');
    }

    if (!parsed?.suggestions?.length) {
      this.logger.error(
        `Gemini returned empty stylist suggestions for product ${productSnapshot.id}.`,
      );
      throw new BadRequestException('Không tạo được gợi ý phối đồ. Vui lòng thử lại sau.');
    }

    this.logger.debug(
      `Stylist structured response parsed with ${parsed.suggestions.length} suggestion(s)`,
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
      headline: parsed.headline ?? `Fia gợi ý phối đồ cùng ${productSnapshot.name}`,
      suggestions: parsed.suggestions,
      fallbackApplied: false,
      productSnapshot: responseSnapshot,
    };
  }

  analyzeCart(payload: CartAnalysisRequestDto): Promise<CartAnalysisResponse> {
    return this.cartInsightsService.analyzeCart(payload);
  }

  async compareProducts(payload: ProductComparisonRequestDto): Promise<ProductComparisonResponse> {
    // 1. Get base comparison (data + feature matrix) from CartInsights
    const baseResponse = await this.cartInsightsService.compareProducts(payload);

    try {
      // 2. Prepare payload for AI
      const context = {
        products: baseResponse.comparedProducts,
        feature_matrix: baseResponse.featureMatrix,
      };

      const prompt = `Dữ liệu so sánh:\n${JSON.stringify(context, null, 2)}`;

      // 3. Generate "Behavioral Verdict"
      const text = await this.generateGeminiContent({
        modelName: this.resolveModelName('GEMINI_PRODUCT_SUMMARY_MODEL'),
        prompt,
        systemInstruction: PRODUCT_COMPARISON_SYSTEM_PROMPT,
        temperature: 0.4,
        maxOutputTokens: 800,
        responseMimeType: 'application/json',
      });

      // 4. Parse and merge
      interface AiComparisonResult {
        headline?: string;
        summary?: string;
        featureMatrix?: unknown[];
      }

      const aiResult = JSON.parse(text) as AiComparisonResult;

      if (aiResult.headline) baseResponse.headline = aiResult.headline;
      if (aiResult.summary) baseResponse.summary = aiResult.summary;
      // Optional: Update matrix insights if AI provides better ones
      if (Array.isArray(aiResult.featureMatrix)) {
        // Simple merge strategy: If AI returns matrix items, try to match and update insights
        // For now, we rely on the base matrix structure but trust the AI's "Insight" text if it matches
      }

      this.logger.debug(`[compareProducts] AI enrichment success: ${baseResponse.headline}`);
    } catch (error) {
      this.logger.warn(
        `[compareProducts] AI enrichment failed, returning base response. Error: ${error}`,
      );
    }

    return baseResponse;
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
      const text = await this.generateGeminiContent({
        modelName: this.resolveModelName('GEMINI_PRODUCT_SUMMARY_MODEL'),
        prompt,
        temperature: 0.2,
        // maxOutputTokens: 200,
        retryAttempts: 2,
      });

      const summary = text.trim();
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
    const start = Date.now();
    this.logger.debug(`generateReviewsSummary: starting for product ${payload.productId}`);

    try {
      // Try to collect reviews using RatingsService
      let sample = '';
      try {
        const reviewsResult = await this.ratingsService.findAll({
          productId: payload.productId,
          limit: 50, // Get enough for a summary
          page: 1,
          sorts: [],
          filters: [],
        });

        const reviews = reviewsResult.data || [];

        if (reviews.length > 0) {
          sample = reviews
            .map((r) => (r.comment ? r.comment.trim() : ''))
            .filter((s) => s.length > 0)
            .join('\n');

          this.logger.debug(
            `generateReviewsSummary: fetched ${reviews.length} reviews from RatingsService (total ${reviewsResult.meta?.total}), sample (${sample.length} chars)`,
          );
        } else {
          this.logger.debug(
            `generateReviewsSummary: No reviews found for product ${payload.productId}`,
          );
        }
      } catch (err) {
        this.logger.warn(`generateReviewsSummary: Failed to fetch ratings: ${err}`);
      }

      if (!sample) {
        this.logger.debug(
          `No reviews sample available for product ${payload.productId}; skipping reviews summary.`,
        );
        return { summary: null };
      }

      // Safety truncation to avoid huge payloads if individual reviews are very long
      if (sample.length > 30000) {
        sample = sample.slice(0, 30000);
        this.logger.debug(`generateReviewsSummary: truncated sample to 30000 chars`);
      }

      const prompt = `Tóm tắt ngắn gọn các review sau: ${sample}\nHãy nhấn mạnh điểm mạnh/điểm yếu lặp lại và tóm tắt cảm nhận chung (2-3 câu). Chỉ trả về plain text.`;

      const text = await this.generateGeminiContent({
        modelName: this.resolveModelName('GEMINI_REVIEWS_MODEL'),
        prompt,
        temperature: 0.25,
        maxOutputTokens: 500, // Increased from 300
        retryAttempts: 2,
      });

      const duration = Date.now() - start;
      this.logger.log(
        `generateReviewsSummary: success for ${payload.productId} in ${duration}ms. Summary length: ${text.length}`,
      );

      return { summary: text.trim() };
    } catch (error) {
      const duration = Date.now() - start;
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `generateReviewsSummary failed for ${payload.productId} after ${duration}ms: ${msg}`,
      );
      if (stack) {
        this.logger.error(stack);
      }
      return { summary: null };
    }
  }

  private async generateGeminiContent(options: {
    modelName: string;
    prompt: string;
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    retryAttempts?: number;
  }): Promise<string> {
    const trimmedPrompt = options.prompt?.trim();
    if (!trimmedPrompt) {
      throw new BadRequestException('Prompt is required for Gemini generation.');
    }

    const model = this.getGeminiModel(options.modelName);
    const generationConfig: Record<string, unknown> = {
      temperature: options.temperature ?? 0.6,
      // maxOutputTokens: options.maxOutputTokens ?? 1024,
    };

    if (options.responseMimeType?.trim()) {
      generationConfig.responseMimeType = options.responseMimeType;
    }

    const contents = [
      {
        role: 'user',
        parts: [{ text: trimmedPrompt }],
      },
    ];

    const systemInstruction =
      typeof options.systemInstruction === 'string' ? options.systemInstruction.trim() : undefined;

    const maxAttempts = Math.max(1, options.retryAttempts ?? 2);
    let attempt = 0;
    let lastFailure: { clientMessage: string; logMessage: string; stack?: string } | null = null;

    while (attempt < maxAttempts) {
      attempt += 1;

      try {
        console.log(
          `Generating Gemini content, payload: ${JSON.stringify({ contents, generationConfig, systemInstruction })}`,
        );

        const result = await model.generateContent({
          contents,
          generationConfig,
          systemInstruction:
            systemInstruction && systemInstruction.length ? systemInstruction : undefined,
        });

        console.log(`Gemini content generated successfully: ${JSON.stringify(result)}`);

        const text = this.extractResponseText(result?.response);
        if (text?.trim()) {
          if (attempt > 1) {
            this.logger.warn(`Gemini content succeeded after ${attempt} attempt(s).`);
          }
          return text.trim();
        }

        this.logger.warn(`Gemini returned empty content (attempt ${attempt}/${maxAttempts}).`);
        lastFailure = {
          clientMessage: 'Gemini không phản hồi nội dung phù hợp. Vui lòng thử lại.',
          logMessage: 'Gemini returned empty content body',
        };
      } catch (error) {
        const normalized = this.normalizeGeminiError(error);
        lastFailure = normalized;

        if (!this.isRetryableGeminiError(error) || attempt >= maxAttempts) {
          this.logger.error(`Gemini generateContent error: ${normalized.logMessage}`);
          if (normalized.stack) {
            this.logger.error(normalized.stack);
          }
          throw new BadRequestException(normalized.clientMessage);
        }

        this.logger.warn(
          `Gemini generateContent attempt ${attempt} failed (${normalized.logMessage}); retrying...`,
        );
      }

      if (attempt < maxAttempts) {
        await this.delay(this.getRetryDelay(attempt));
      }
    }

    const failureMessage =
      lastFailure?.clientMessage ?? 'Gemini không phản hồi nội dung phù hợp. Vui lòng thử lại.';
    if (lastFailure) {
      this.logger.error(`Gemini generateContent error: ${lastFailure.logMessage}`);
      if (lastFailure.stack) {
        this.logger.error(lastFailure.stack);
      }
    }

    throw new BadRequestException(failureMessage);
  }

  private resolveModelName(envKey: string): string {
    return (
      this.configService.get<string>(envKey) ??
      this.configService.get<string>('GEMINI_CHAT_MODEL') ??
      'gemini-2.5-flash'
    );
  }

  private getGeminiModel(modelName: string): GenerativeModel {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new BadRequestException('Chưa cấu hình GEMINI_API_KEY');
    }

    if (!this.geminiClient) {
      this.geminiClient = new GoogleGenerativeAI(apiKey);
    }

    if (!this.geminiModels.has(modelName)) {
      this.geminiModels.set(modelName, this.geminiClient.getGenerativeModel({ model: modelName }));
    }

    return this.geminiModels.get(modelName)!;
  }

  private extractResponseText(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const typedResponse = response as {
      text?: () => string | undefined | null;
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string | null }>;
        };
        parts?: Array<{ text?: string | null }>;
      }>;
    };

    try {
      const direct = typeof typedResponse.text === 'function' ? typedResponse.text()?.trim() : null;
      if (direct) {
        return direct;
      }
    } catch (error) {
      this.logger.debug(
        `Unable to read Gemini response text directly: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const candidates = Array.isArray(typedResponse.candidates) ? typedResponse.candidates : [];

    for (const candidate of candidates) {
      const contentParts = Array.isArray(candidate?.content?.parts)
        ? (candidate.content?.parts as Array<{ text?: string | null }>)
        : [];
      const fallbackParts = Array.isArray(candidate?.parts)
        ? (candidate.parts as Array<{ text?: string | null }>)
        : [];

      const parts = contentParts.length ? contentParts : fallbackParts;

      const collected = parts
        .map((part) => (typeof part?.text === 'string' ? part.text.trim() : ''))
        .filter((segment) => segment.length > 0);

      if (collected.length) {
        return collected.join('\n');
      }
    }

    return null;
  }

  private normalizeGeminiError(error: unknown): {
    clientMessage: string;
    logMessage: string;
    stack?: string;
  } {
    const defaultResponse = {
      clientMessage: 'Gemini không phản hồi nội dung phù hợp. Vui lòng thử lại.',
      logMessage: 'Lỗi khi gọi Gemini API',
      stack: error instanceof Error ? error.stack : undefined,
    };

    if (!error || typeof error !== 'object') {
      return defaultResponse;
    }

    if (error instanceof BadRequestException) {
      return {
        clientMessage: error.message,
        logMessage: error.message,
        stack: error.stack,
      };
    }

    const status = (error as { status?: number }).status;
    const code =
      (error as { statusText?: string }).statusText ??
      (error as { code?: string }).code ??
      (error as { error?: { code?: string } }).error?.code;
    const message =
      (error as { message?: string }).message ??
      (error as { error?: { message?: string } }).error?.message ??
      'Không xác định';

    if (status === 429 || code === 'RESOURCE_EXHAUSTED') {
      return {
        clientMessage: 'Gemini đang quá tải. Vui lòng thử lại sau ít phút.',
        logMessage: `Gemini rate limited the request: ${message}`,
        stack: error instanceof Error ? error.stack : undefined,
      };
    }

    if (status === 401 || status === 403 || code === 'PERMISSION_DENIED') {
      return {
        clientMessage: 'Không có quyền gọi Gemini API. Vui lòng kiểm tra lại cấu hình.',
        logMessage: `Gemini authentication failed: ${message}`,
        stack: error instanceof Error ? error.stack : undefined,
      };
    }

    if (status && status >= 500) {
      return {
        clientMessage: 'Gemini đang gặp sự cố. Vui lòng thử lại sau.',
        logMessage: `Gemini server error (${status}): ${message}`,
        stack: error instanceof Error ? error.stack : undefined,
      };
    }

    return {
      clientMessage: defaultResponse.clientMessage,
      logMessage: `${defaultResponse.logMessage}: ${message}`,
      stack: error instanceof Error ? error.stack : undefined,
    };
  }

  private isRetryableGeminiError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const status = (error as { status?: number }).status;
    if (status && [429, 500, 502, 503, 504].includes(status)) {
      return true;
    }

    const code =
      (error as { code?: string }).code ??
      (error as { statusText?: string }).statusText ??
      (error as { error?: { code?: string } }).error?.code;

    if (code && ['RESOURCE_EXHAUSTED', 'UNAVAILABLE', 'ABORTED'].includes(code)) {
      return true;
    }

    const message =
      (error as { message?: string }).message ??
      (error as { error?: { message?: string } }).error?.message ??
      '';

    if (typeof message === 'string') {
      return /temporarily unavailable|overloaded|timeout/i.test(message);
    }

    return false;
  }

  private getRetryDelay(attempt: number): number {
    const base = 250;
    const maxDelay = 2000;
    return Math.min(maxDelay, base * Math.max(1, attempt));
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, ms));
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
    const focusDescriptor = {
      id: product.id,
      name: product.name,
      brand: product.brand ?? null,
      category: product.category ?? null,
      priceRange: product.priceRange ?? null,
      selectedVariant: product.selectedVariant
        ? {
            id: product.selectedVariant.id,
            label: product.selectedVariant.attributeSummary ?? null,
            attributes: product.selectedVariant.attributes.map((attribute) => ({
              attribute: attribute.attribute ?? null,
              value: attribute.value ?? null,
            })),
          }
        : null,
    };

    const behaviourSignals = (payload.signals ?? []).slice(0, 10).map((signal) => ({
      type: signal.type,
      durationMs:
        typeof signal.durationMs === 'number' && Number.isFinite(signal.durationMs)
          ? Math.round(signal.durationMs)
          : null,
      intensity: signal.intensity ?? null,
    }));

    const candidateCatalogue = catalogue
      .filter((item) => !item.isFocus)
      .slice(0, 20)
      .map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category ?? null,
        brand: item.brand ?? null,
        priceRange: item.priceRange ?? null,
        tags: item.tags.filter((tag) => Boolean(tag)).slice(0, 4),
        similarityScore:
          typeof item.score === 'number' && Number.isFinite(item.score)
            ? Number(item.score.toFixed(3))
            : null,
        image: item.image ?? null,
      }));

    const inputPayload = {
      locale: payload.locale ?? 'vi',
      surface: payload.surface ?? null,
      focus_item: focusDescriptor,
      behaviour_signals: behaviourSignals,
      candidate_catalogue: candidateCatalogue,
    };

    const schema = {
      headline: 'string',
      outfits: [
        {
          title: 'string',
          summary: 'string',
          occasion: 'string | null',
          items: [
            {
              productId: 'number',
              role: 'focus | top | bottom | layer | footwear | accessory',
              reason: 'string',
            },
          ],
        },
      ],
      notes: 'string | null',
    };

    return [
      'Bạn là Stylist AI của Fashia. Hãy tạo ra 1 đến 3 outfit hoàn chỉnh dựa trên dữ liệu sau.',
      'Dữ liệu đầu vào:',
      JSON.stringify(inputPayload, null, 2),
      'Yêu cầu bắt buộc:\n- Mỗi outfit phải bao gồm sản phẩm focus có id=' +
        product.id +
        '.\n- Chỉ chọn thêm 2-4 sản phẩm từ candidate_catalogue; không bịa sản phẩm mới.\n- Tập trung vào lý do phối, dịp sử dụng và văn phong ngắn gọn.\n- Không lặp cùng một sản phẩm ở nhiều outfit trừ khi thực sự cần thiết. \n- Nếu Không đủ sản phẩm để tạo outfit hợp lý, hãy trả về ít outfit hơn.\n- Nếu không có outfit hợp lý nào, hãy trả về một mảng outfits rỗng.',
      'Schema JSON bắt buộc:',
      JSON.stringify(schema, null, 2),
      'Quan trọng: chỉ xuất JSON hợp lệ, không thêm lời dẫn hoặc giải thích ngoài JSON.',
    ].join('\n\n');
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
