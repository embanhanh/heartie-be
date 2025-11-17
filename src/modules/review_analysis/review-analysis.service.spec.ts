import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ReviewAnalysisService } from './review-analysis.service';
import { ReviewInsight } from './entities/review-insight.entity';
import { Rating } from '../ratings/entities/rating.entity';
import { GeminiService } from '../gemini/gemini.service';
import { REVIEW_ANALYSIS_QUEUE } from './review-analysis.constants';
import { ReviewSentiment } from './entities/review-insight.entity';
import { AnalyzeReviewJobPayload } from './dto/analyze-review-job.dto';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  merge: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('ReviewAnalysisService', () => {
  let service: ReviewAnalysisService;
  const insightRepository = createRepositoryMock();
  const ratingRepository = createRepositoryMock();
  const analyzeProductReviewMock = jest.fn();
  const geminiService = {
    analyzeProductReview: analyzeProductReviewMock,
  } as unknown as GeminiService;
  const queueAddMock = jest.fn<
    ReturnType<Queue<AnalyzeReviewJobPayload>['add']>,
    Parameters<Queue<AnalyzeReviewJobPayload>['add']>
  >(() => Promise.resolve(null as any));
  const queueMock: Pick<Queue<AnalyzeReviewJobPayload>, 'add'> = {
    add: queueAddMock,
  };
  const queueToken = `BullQueue_${REVIEW_ANALYSIS_QUEUE}`;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewAnalysisService,
        {
          provide: getRepositoryToken(ReviewInsight),
          useValue: insightRepository,
        },
        {
          provide: getRepositoryToken(Rating),
          useValue: ratingRepository,
        },
        {
          provide: GeminiService,
          useValue: geminiService,
        },
        {
          provide: queueToken,
          useValue: queueMock,
        },
      ],
    }).compile();

    service = module.get<ReviewAnalysisService>(ReviewAnalysisService);
  });

  describe('enqueueAnalysis', () => {
    it('adds job to queue with retry policy', async () => {
      await service.enqueueAnalysis(42);

      expect(queueMock.add).toHaveBeenCalledWith(
        'analyze-review',
        { ratingId: 42 },
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
        }),
      );
    });
  });

  describe('analyzeAndPersist', () => {
    it('throws NotFoundException when rating is missing', async () => {
      ratingRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.analyzeAndPersist(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('skips Gemini call when comment is blank and stores fallback insight', async () => {
      ratingRepository.findOne.mockResolvedValueOnce({
        id: 1,
        comment: '   ',
        rating: 4,
        productId: 10,
        userId: 20,
      });

      insightRepository.findOne.mockResolvedValueOnce(null);
      const createdInsight: ReviewInsight = {
        id: 1,
        ratingId: 1,
        sentiment: 'neutral',
        keyTopics: [],
        summary: 'Đánh giá không có nội dung văn bản.',
        rawResponse: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        rating: {} as Rating,
      };

      insightRepository.create.mockReturnValueOnce(createdInsight);
      insightRepository.save.mockResolvedValueOnce(createdInsight);

      const result = await service.analyzeAndPersist(1);

      expect(analyzeProductReviewMock).not.toHaveBeenCalled();
      expect(result.summary).toEqual('Đánh giá không có nội dung văn bản.');
      expect(result.sentiment).toEqual('neutral');
    });

    it('calls Gemini and stores analysis when review contains text', async () => {
      const ratingRecord = {
        id: 2,
        comment: 'Sản phẩm chất lượng tuyệt vời',
        rating: 5,
        productId: 5,
        userId: 7,
      } as Rating;

      ratingRepository.findOne.mockResolvedValueOnce(ratingRecord);
      insightRepository.findOne.mockResolvedValueOnce(null);

      analyzeProductReviewMock.mockResolvedValueOnce({
        sentiment: 'positive' as ReviewSentiment,
        keyTopics: ['chất lượng', 'giá cả'],
        summary: 'Khách hàng rất hài lòng về chất lượng và giá.',
        raw: { sentimentScore: 0.92 },
      });

      const createdInsight: ReviewInsight = {
        id: 10,
        ratingId: 2,
        sentiment: 'positive',
        keyTopics: ['chất lượng', 'giá cả'],
        summary: 'Khách hàng rất hài lòng về chất lượng và giá.',
        rawResponse: { sentimentScore: 0.92 },
        createdAt: new Date(),
        updatedAt: new Date(),
        rating: ratingRecord,
      };

      insightRepository.create.mockReturnValueOnce(createdInsight);
      insightRepository.save.mockResolvedValueOnce(createdInsight);

      const result = await service.analyzeAndPersist(2);

      expect(analyzeProductReviewMock).toHaveBeenCalledWith({
        comment: ratingRecord.comment,
        ratingValue: ratingRecord.rating,
        productId: ratingRecord.productId,
        userId: ratingRecord.userId,
      });
      expect(result.sentiment).toEqual('positive');
      expect(result.keyTopics).toEqual(['chất lượng', 'giá cả']);
      expect(result.rawResponse).toEqual({ sentimentScore: 0.92 });
    });

    it('falls back to neutral when Gemini throws', async () => {
      const ratingRecord = {
        id: 3,
        comment: 'Không tốt lắm',
        rating: 2,
        productId: 99,
        userId: 100,
      } as Rating;

      ratingRepository.findOne.mockResolvedValueOnce(ratingRecord);
      insightRepository.findOne.mockResolvedValueOnce(null);
      analyzeProductReviewMock.mockRejectedValueOnce(new Error('API down'));

      const createdInsight: ReviewInsight = {
        id: 11,
        ratingId: 3,
        sentiment: 'neutral',
        keyTopics: [],
        summary: 'Không thể phân tích đánh giá ở thời điểm hiện tại.',
        rawResponse: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        rating: ratingRecord,
      };

      insightRepository.create.mockReturnValueOnce(createdInsight);
      insightRepository.save.mockResolvedValueOnce(createdInsight);

      const result = await service.analyzeAndPersist(3);

      expect(result.sentiment).toEqual('neutral');
      expect(result.summary).toContain('Không thể phân tích');
    });
  });

  describe('listInsights', () => {
    it('applies filters and returns paginated result', async () => {
      const qbMock = {
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValueOnce([
          [
            {
              id: 5,
              ratingId: 9,
              sentiment: 'positive',
              keyTopics: ['giao hàng'],
              summary: 'Giao hàng nhanh.',
              rawResponse: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          1,
        ]),
      };

      insightRepository.createQueryBuilder.mockReturnValueOnce(qbMock);

      const result = await service.listInsights({
        page: 1,
        limit: 10,
        sentiment: 'positive',
      });

      expect(qbMock.andWhere).toHaveBeenCalledWith('insight.sentiment = :sentiment', {
        sentiment: 'positive',
      });
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.data[0].sentiment).toBe('positive');
    });
  });
});
