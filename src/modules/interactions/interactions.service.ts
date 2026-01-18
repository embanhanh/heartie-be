// interaction.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, FindOptionsWhere } from 'typeorm';
import { Interaction, InteractionType } from './entities/interaction.entity';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { User } from '../users/entities/user.entity';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { AnalyticsService } from '../analytics/analytics.service';

interface FindAllOptions {
  page?: number;
  limit?: number;
  userId?: number;
  type?: string;
}

@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(Interaction)
    private interactionRepository: Repository<Interaction>,

    @InjectRepository(ProductVariant)
    private productVariantRepository: Repository<ProductVariant>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async findAll(options: FindAllOptions = {}) {
    const { page = 1, limit = 20, userId, type } = options;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Interaction> = {};

    if (userId) {
      where.idUser = userId;
    }

    if (type && Object.values(InteractionType).includes(type as InteractionType)) {
      where.type = type as InteractionType;
    }

    const [data, total] = await this.interactionRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['productVariant', 'user'],
    });

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number): Promise<Interaction> {
    const interaction = await this.interactionRepository.findOne({
      where: { id },
      relations: ['productVariant', 'user'],
    });

    if (!interaction) {
      throw new NotFoundException(`Interaction with ID ${id} not found`);
    }

    return interaction;
  }

  async create(createDto: CreateInteractionDto): Promise<Interaction> {
    // Validate ProductVariant exists
    const productVariant = await this.productVariantRepository.findOne({
      where: { id: createDto.idProduct },
    });

    if (!productVariant) {
      throw new BadRequestException(
        `Product variant with ID ${createDto.idProduct} does not exist`,
      );
    }

    // Validate User exists
    const user = await this.userRepository.findOne({
      where: { id: createDto.idUser },
    });

    if (!user) {
      throw new BadRequestException(`User with ID ${createDto.idUser} does not exist`);
    }

    // For certain interaction types, check for duplicates within a time window
    if (
      [InteractionType.LIKE, InteractionType.ADD_TO_CART, InteractionType.ADD_TO_WISHLIST].includes(
        createDto.type,
      )
    ) {
      const recentInteraction = await this.interactionRepository.findOne({
        where: {
          idProduct: createDto.idProduct,
          idUser: createDto.idUser,
          type: createDto.type,
          createdAt: MoreThanOrEqual(new Date(Date.now() - 60000)), // Within last minute
        },
      });

      if (recentInteraction) {
        console.warn(`Duplicate ${createDto.type} interaction prevented`);
        return recentInteraction;
      }
    }

    // Create interaction
    const interaction = this.interactionRepository.create({ ...createDto });

    const savedInteraction = await this.interactionRepository.save(interaction);

    await this.analyticsService.recordInteraction(createDto.idProduct, createDto.type, {
      occurredAt: savedInteraction.createdAt,
    });

    // // Update product popularity score (async)
    // this.updateProductPopularityScore(createDto.idProductVariant).catch(console.error);

    return savedInteraction;
  }

  async logInteraction(userId: number, productId: number, type: InteractionType): Promise<void> {
    try {
      // Basic validation handled by create's DB constraints/checks,
      // but we wrap in try-catch to ensure tracking doesn't block main flow

      // Get a product variant ID if needed, or if productId refers to the main product.
      // The Interaction entity links to Product (via idProduct column, mapped as product property).
      // NOTE: CreateInteractionDto expects 'idProduct', which seems to map to 'product' relation in entity?
      // Let's check entity. idProduct is bigInt.
      // Relations says @ManyToOne(() => Product ...
      // So 'idProduct' should be the Product ID.

      // Prevent duplicate logging (debounce/spam check)
      // If same user, same product, same type, within last 60 seconds -> ignore
      const timeThreshold = new Date(Date.now() - 60 * 1000); // 60 seconds ago

      const existing = await this.interactionRepository.findOne({
        where: {
          idUser: userId,
          idProduct: productId,
          type: type,
          createdAt: MoreThanOrEqual(timeThreshold),
        },
      });

      if (existing) {
        // Skip logging if recently interacted
        return;
      }

      const interaction = this.interactionRepository.create({
        idUser: userId,
        idProduct: productId,
        type: type,
        // metadata not in entity currently
      });

      await this.interactionRepository.save(interaction);

      // Also record analytics
      this.analyticsService
        .recordInteraction(productId, type, {
          occurredAt: interaction.createdAt,
        })
        .catch((err) => console.error('Analytics error:', err));
    } catch (error) {
      console.warn(
        `Failed to log interaction ${type} for user ${userId} on product ${productId}:`,
        error,
      );
      // Don't throw, we don't want to break the user experience for logging failures
    }
  }
}
