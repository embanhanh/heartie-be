import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { PaginatedResult } from 'src/common/dto/pagination.dto';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

import { ReviewInsight } from './entities/review-insight.entity';
import { Rating } from '../ratings/entities/rating.entity';
import { RatingsService } from '../ratings/ratings.service';
import { AnalyzeReviewJobPayload } from './dto/analyze-review-job.dto';
import { ReviewInsightQueryDto } from './dto/review-insight-query.dto';
import { ReviewInsightResponseDto } from './dto/review-insight-response.dto';

import { REVIEW_ANALYSIS_QUEUE } from './review-analysis.constants';
import { AnalyzeProductReviewResult } from '../gemini/interfaces/review-analysis.interface';
import { I18nService, I18nContext } from 'nestjs-i18n';
import { I18nTranslations } from 'src/common/i18n/generated/i18n.generated';

type ReviewAnalysisResult = AnalyzeProductReviewResult;

@Injectable()
export class ReviewAnalysisService {
  private readonly logger = new Logger(ReviewAnalysisService.name);
  private geminiClient?: GoogleGenerativeAI;
  private readonly geminiModels = new Map<string, GenerativeModel>();

  constructor(
    @InjectRepository(ReviewInsight)
    private readonly insightRepository: Repository<ReviewInsight>,
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,

    @Inject(forwardRef(() => RatingsService))
    private readonly ratingsService: RatingsService,

    private readonly configService: ConfigService,
    @InjectQueue(REVIEW_ANALYSIS_QUEUE)
    private readonly reviewAnalysisQueue: Queue<AnalyzeReviewJobPayload>,
    private readonly i18n: I18nService<I18nTranslations>,
  ) {}

  async enqueueAnalysis(ratingId: number): Promise<void> {
    await this.reviewAnalysisQueue.add(
      'analyze-review',
      { ratingId },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5_000,
        },
      },
    );
  }

  async analyzeAndPersist(ratingId: number): Promise<ReviewInsight> {
    const rating = await this.ratingRepository.findOne({ where: { id: ratingId } });

    if (!rating) {
      throw new NotFoundException(`Rating ${ratingId} not found`);
    }

    if (!rating.comment || !rating.comment.trim()) {
      this.logger.warn(`Rating ${ratingId} does not contain comment text. Skipping analysis.`);
      return this.ensureInsightRecord(
        ratingId,
        {
          sentiment: 'neutral',
          keyTopics: [],
          summary: 'Đánh giá không có nội dung văn bản.',
          raw: null,
        },
        rating.productId,
      );
    }

    const analysis = await this.callGeminiAnalysis({
      comment: rating.comment,
      ratingValue: rating.rating,
      productId: rating.productId,
      userId: rating.userId,
    });

    return this.ensureInsightRecord(ratingId, analysis, rating.productId);
  }

  async listInsights(
    query: ReviewInsightQueryDto,
  ): Promise<PaginatedResult<ReviewInsightResponseDto>> {
    const qb = this.insightRepository
      .createQueryBuilder('insight')
      .orderBy('insight.createdAt', 'DESC');

    if (query.ratingId) {
      qb.andWhere('insight.ratingId = :ratingId', { ratingId: query.ratingId });
    }

    if (query.sentiment) {
      qb.andWhere('insight.sentiment = :sentiment', { sentiment: query.sentiment });
    }

    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const offset = (page - 1) * limit;

    const [rows, total] = await qb.skip(offset).take(limit).getManyAndCount();

    const data: ReviewInsightResponseDto[] = rows.map((row) => this.mapToResponse(row));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getInsightByRatingId(ratingId: number): Promise<ReviewInsightResponseDto | null> {
    const record = await this.insightRepository.findOne({ where: { ratingId } });
    return record ? this.mapToResponse(record) : null;
  }

  private async ensureInsightRecord(
    ratingId: number,
    analysis: ReviewAnalysisResult,
    productId: number,
  ): Promise<ReviewInsight> {
    const existing = await this.insightRepository.findOne({ where: { ratingId } });

    const payload = {
      ratingId,
      sentiment: analysis.sentiment,
      keyTopics: analysis.keyTopics,
      summary: analysis.summary,
      rawResponse: analysis.raw ?? null,
    } satisfies Partial<ReviewInsight> & { ratingId: number };

    if (existing) {
      this.insightRepository.merge(existing, payload);
      return this.insightRepository.save(existing);
    }

    const created = this.insightRepository.create(payload);

    // Update Rating with sentiment and moderation result
    if (analysis.sentiment) {
      const isApproved = analysis.sentiment !== 'negative';

      await this.ratingRepository.update(ratingId, {
        sentiment: analysis.sentiment,
        isVisible: isApproved, // Auto-approve if not negative
      });

      if (isApproved) {
        // Recalculate product average rating
        await this.ratingsService.updateProductAverageRating(productId);
      } else {
        this.logger.warn(`Rating ${ratingId} flagged as negative sentiment. Kept hidden.`);
      }
    }

    return this.insightRepository.save(created);
  }

  private mapToResponse(entity: ReviewInsight): ReviewInsightResponseDto {
    return {
      id: entity.id,
      ratingId: entity.ratingId,
      sentiment: entity.sentiment,
      keyTopics: entity.keyTopics ?? [],
      summary: entity.summary,
      rawResponse: entity.rawResponse ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private async callGeminiAnalysis(params: {
    comment: string;
    ratingValue: number;
    productId: number;
    userId: number;
  }): Promise<ReviewAnalysisResult> {
    const systemPrompt =
      'Bạn là chuyên gia phân tích đánh giá (review) cho thương hiệu thời trang Fashia. ' +
      'Đọc kỹ nội dung review của khách hàng và trả về JSON với các trường bắt buộc: ' +
      '{ sentiment: one_of("positive","negative","neutral"), key_topics: string[], summary: string }.' +
      'Các key_topics phải là danh sách ngắn gọn (2-4 từ) mô tả chủ đề chính khách nhắc tới. ' +
      'Summary phải là tiếng Việt, tối đa 2 câu, phản ánh đúng nội dung review.';

    const requestPayload = {
      review_text: params.comment,
      rating: params.ratingValue,
      product_id: params.productId,
      user_id: params.userId,
    };

    try {
      const text = await this.generateGeminiContent({
        modelName: this.resolveModelName('GEMINI_REVIEW_MODEL'),
        prompt: JSON.stringify(requestPayload),
        systemInstruction: systemPrompt,
        temperature: 0.2,
        responseMimeType: 'application/json',
        retryAttempts: 2,
      });

      const parsed = this.safeParseJson(text);

      const sentiment = this.normalizeSentiment(parsed.sentiment);
      const keyTopics = this.normalizeKeyTopics(parsed.key_topics ?? parsed.keyTopics);
      const summary = this.normalizeSummary(parsed.summary);

      return {
        sentiment,
        keyTopics,
        summary,
        raw: parsed,
      };
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(`Unknown Gemini error: ${String(error)}`);

      this.logger.error(
        `Failed to analyze review ${params.comment.slice(0, 24)}...: ${normalizedError.message}`,
        normalizedError.stack,
      );

      return {
        sentiment: 'neutral',
        keyTopics: [],
        summary: 'Không thể phân tích đánh giá ở thời điểm hiện tại.',
        raw: null,
      };
    }
  }

  async validateReviewContent(comment: string): Promise<void> {
    // Skip empty comments
    if (!comment || !comment.trim()) {
      return;
    }

    const systemPrompt =
      'Bạn là hệ thống kiểm duyệt nội dung tự động. ' +
      'Nhiệm vụ: Phân tích bình luận của người dùng và phát hiện xem nó có chứa nội dung độc hại (toxic), xúc phạm, thô tục, hoặc spam quảng cáo không. ' +
      'Trả về JSON: { "isToxic": boolean, "isSpam": boolean, "reason": "string" }. ' +
      'Nếu isToxic hoặc isSpam là true, reason phải giải thích ngắn gọn bằng tiếng Việt.';

    try {
      const text = await this.generateGeminiContent({
        modelName: this.resolveModelName('GEMINI_REVIEW_MODEL'),
        prompt: JSON.stringify({ review_text: comment }),
        systemInstruction: systemPrompt,
        temperature: 0.0, // Strict deterministic check
        responseMimeType: 'application/json',
        retryAttempts: 1, // Fast fail
      });

      const result = this.safeParseJson(text) as {
        isToxic?: boolean;
        isSpam?: boolean;
        reason?: string;
      };

      if (result.isToxic) {
        throw new BadRequestException(
          this.i18n.t('errors.validation.toxicContent', {
            lang: I18nContext.current()?.lang,
          }),
        );
      }

      if (result.isSpam) {
        throw new BadRequestException(
          this.i18n.t('errors.validation.spamContent', {
            lang: I18nContext.current()?.lang,
          }),
        );
      }
    } catch (error) {
      // If validation fails (Gemini error), we log but allow broadly unless it's a known toxic error
      if (
        error instanceof BadRequestException &&
        (error.message.includes('inappropriate') || error.message.includes('spam'))
      ) {
        throw error;
      }

      // Re-throw if it IS our toxic/spam exception
      if (error instanceof BadRequestException) {
        // Check if message matches one of our i18n keys (roughly) or pass through if it was generated by i18n
        throw error;
      }

      this.logger.warn(`Content validation skipped due to AI error: ${error}`);
      // Fallback: Allow content if AI fails (to avoid blocking legitimate users during outages)
    }
  }

  // --- Gemini Helpers (Ported from AiCustomerService) ---

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
        const result = await model.generateContent({
          contents,
          generationConfig,
          systemInstruction:
            systemInstruction && systemInstruction.length ? systemInstruction : undefined,
        });

        const text = this.extractResponseText(result?.response);
        if (text?.trim()) {
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

  private safeParseJson(payload: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      throw new Error('Parsed JSON is not an object');
    } catch (error) {
      this.logger.error(
        'Failed to parse Gemini JSON response',
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException('Gemini trả về dữ liệu không hợp lệ');
    }
  }

  private normalizeSentiment(val: unknown): 'positive' | 'negative' | 'neutral' {
    if (typeof val !== 'string') return 'neutral';
    const v = val.toLowerCase().trim();
    if (v === 'positive' || v === 'negative' || v === 'neutral') return v;
    return 'neutral';
  }

  private normalizeKeyTopics(val: unknown): string[] {
    if (Array.isArray(val)) {
      return val.filter((item) => typeof item === 'string').map((s) => s.trim());
    }
    return [];
  }

  private normalizeSummary(val: unknown): string {
    return typeof val === 'string' ? val.trim() : '';
  }
}
