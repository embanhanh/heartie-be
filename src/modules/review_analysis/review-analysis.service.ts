import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { PaginatedResult } from 'src/common/dto/pagination.dto';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { ReviewInsight } from './entities/review-insight.entity';
import { Rating } from '../ratings/entities/rating.entity';
import { AnalyzeReviewJobPayload } from './dto/analyze-review-job.dto';
import { ReviewInsightQueryDto } from './dto/review-insight-query.dto';
import { ReviewInsightResponseDto } from './dto/review-insight-response.dto';
import { GeminiService } from '../gemini/gemini.service';
import { REVIEW_ANALYSIS_QUEUE } from './review-analysis.constants';
import { AnalyzeProductReviewResult } from '../gemini/interfaces/review-analysis.interface';

type ReviewAnalysisResult = AnalyzeProductReviewResult;

@Injectable()
export class ReviewAnalysisService {
  private readonly logger = new Logger(ReviewAnalysisService.name);

  constructor(
    @InjectRepository(ReviewInsight)
    private readonly insightRepository: Repository<ReviewInsight>,
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
    private readonly geminiService: GeminiService,
    @InjectQueue(REVIEW_ANALYSIS_QUEUE)
    private readonly reviewAnalysisQueue: Queue<AnalyzeReviewJobPayload>,
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
      return this.ensureInsightRecord(ratingId, {
        sentiment: 'neutral',
        keyTopics: [],
        summary: 'Đánh giá không có nội dung văn bản.',
        raw: null,
      });
    }

    const analysis = await this.callGeminiAnalysis({
      comment: rating.comment,
      ratingValue: rating.rating,
      productId: rating.productId,
      userId: rating.userId,
    });

    return this.ensureInsightRecord(ratingId, analysis);
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
    try {
      const response = await this.geminiService.analyzeProductReview({
        comment: params.comment,
        ratingValue: params.ratingValue,
        productId: params.productId,
        userId: params.userId,
      });

      return {
        sentiment: response.sentiment,
        keyTopics: response.keyTopics,
        summary: response.summary,
        raw: response.raw,
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
}
