import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './entities/rating.entity';
import { CreateRatingDto } from './dto/create-rating.dto';
// import { UpdateRatingDto } from './dto/update-rating.dto';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { PaginatedResult } from 'src/common/dto/pagination.dto';
import { RatingsQueryDto } from './dto/query-rating.dto';
import { ReviewAnalysisService } from '../review_analysis/review-analysis.service';

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(
    @InjectRepository(Rating)
    private ratingRepository: Repository<Rating>,

    @InjectRepository(Product)
    private productRepository: Repository<Product>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly reviewAnalysisService: ReviewAnalysisService,
  ) {}

  async create(createDto: CreateRatingDto, userId: number): Promise<Rating> {
    // Validate Product exists
    const product = await this.productRepository.findOne({
      where: { id: createDto.productId },
    });

    if (!product) {
      throw new BadRequestException(`Product with ID ${createDto.productId} does not exist`);
    }

    // Validate User exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException(`User with ID ${userId} does not exist`);
    }

    // Check if user already rated this product
    const existingRating = await this.ratingRepository.findOne({
      where: {
        productId: createDto.productId,
        userId: userId,
      },
    });

    if (existingRating) {
      throw new ConflictException(
        `User ${userId} has already rated product ${createDto.productId}`,
      );
    }

    // Validate rating value
    if (createDto.rating < 1.0 || createDto.rating > 5.0) {
      throw new BadRequestException('Rating must be between 1.0 and 5.0');
    }

    // Round rating to 1 decimal place
    const roundedRating = Math.round(createDto.rating * 10) / 10;

    // Create rating
    const rating = this.ratingRepository.create({
      productId: createDto.productId,
      userId: userId,
      rating: roundedRating,
      comment: createDto.comment?.trim() || null,
    });

    const savedRating = await this.ratingRepository.save(rating);

    try {
      await this.reviewAnalysisService.enqueueAnalysis(savedRating.id);
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue review analysis for rating ${savedRating.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }

    // Update product average rating (optional - có thể làm bằng trigger DB)
    // await this.updateProductAverageRating(createDto.productId);

    return savedRating;
  }

  async findAll(query: RatingsQueryDto): Promise<PaginatedResult<Rating>> {
    const limit = Math.max(1, query.limit ?? 20);
    const offset = Math.max(
      0,
      query.skip !== undefined && query.skip !== null
        ? query.skip
        : ((query.page ?? 1) - 1) * limit,
    );

    const createdAtFrom = query.createdAtFrom ? new Date(query.createdAtFrom) : undefined;
    const createdAtTo = query.createdAtTo ? new Date(query.createdAtTo) : undefined;

    if (createdAtFrom && Number.isNaN(createdAtFrom.getTime())) {
      throw new BadRequestException('createdAtFrom must be a valid ISO date string');
    }

    if (createdAtTo && Number.isNaN(createdAtTo.getTime())) {
      throw new BadRequestException('createdAtTo must be a valid ISO date string');
    }

    if (createdAtFrom && createdAtTo && createdAtFrom > createdAtTo) {
      throw new BadRequestException('createdAtFrom must be earlier than or equal to createdAtTo');
    }

    const qb = this.ratingRepository
      .createQueryBuilder('rating')
      .orderBy('rating.createdAt', 'DESC');

    if (query.productId) {
      qb.andWhere('rating.productId = :productId', { productId: query.productId });
    }

    if (query.userId) {
      qb.andWhere('rating.userId = :userId', { userId: query.userId });
    }

    if (createdAtFrom) {
      qb.andWhere('rating.createdAt >= :createdAtFrom', {
        createdAtFrom: createdAtFrom.toISOString(),
      });
    }

    if (createdAtTo) {
      qb.andWhere('rating.createdAt <= :createdAtTo', {
        createdAtTo: createdAtTo.toISOString(),
      });
    }

    const [data, total] = await qb.skip(offset).take(limit).getManyAndCount();

    const derivedPage =
      query.skip !== undefined && query.skip !== null
        ? Math.floor(offset / limit) + 1
        : (query.page ?? 1);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data,
      meta: {
        total,
        page: Math.min(derivedPage, totalPages),
        limit,
        totalPages,
      },
    };
  }

  findOne(id: number) {
    return this.ratingRepository.findOneBy({ id });
  }

  // update(id: number, dto: UpdateRatingDto) {
  //   return this.repo.update(id, dto);
  // }

  // remove(id: number) {
  //   return this.repo.delete(id);
  // }
}
