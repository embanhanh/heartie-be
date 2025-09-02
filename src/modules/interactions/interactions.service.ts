// interaction.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Interaction, InteractionType } from './entities/interaction.entity';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { User } from '../users/entities/user.entity';
import { CreateInteractionDto } from './dto/create-interaction.dto';

@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(Interaction)
    private interactionRepository: Repository<Interaction>,

    @InjectRepository(ProductVariant)
    private productVariantRepository: Repository<ProductVariant>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createDto: CreateInteractionDto): Promise<Interaction> {
    // Validate ProductVariant exists
    const productVariant = await this.productVariantRepository.findOne({
      where: { id: createDto.idProductVariant },
    });

    if (!productVariant) {
      throw new BadRequestException(
        `Product variant with ID ${createDto.idProductVariant} does not exist`,
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
          idProductVariant: createDto.idProductVariant,
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

    // // Update product popularity score (async)
    // this.updateProductPopularityScore(createDto.idProductVariant).catch(console.error);

    return savedInteraction;
  }
}
