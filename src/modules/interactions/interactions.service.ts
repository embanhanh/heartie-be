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
}
