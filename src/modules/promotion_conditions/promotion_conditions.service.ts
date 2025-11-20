import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromotionCondition } from './entities/promotion-condition.entity';
import { CreatePromotionConditionDto } from './dto/create-promotion-condition.dto';
import { UpdatePromotionConditionDto } from './dto/update-promotion-condition.dto';

@Injectable()
export class PromotionConditionsService {
  private readonly defaultRelations = {
    promotion: true,
    product: true,
  } as const;

  constructor(
    @InjectRepository(PromotionCondition)
    private readonly repo: Repository<PromotionCondition>,
  ) {}

  async create(dto: CreatePromotionConditionDto) {
    const entity = this.repo.create({
      promotionId: dto.promotionId,
      productId: dto.productId,
      quantity: this.normalizeQuantity(dto.quantity),
      role: dto.role,
    });

    return this.repo.save(entity);
  }

  findAll() {
    return this.repo.find({
      relations: this.defaultRelations,
      order: { promotionId: 'ASC', id: 'ASC' },
    });
  }

  async findOne(id: number) {
    const entity = await this.repo.findOne({
      where: { id },
      relations: this.defaultRelations,
    });

    if (!entity) {
      throw new NotFoundException(`Promotion condition ${id} not found`);
    }

    return entity;
  }

  async update(id: number, dto: UpdatePromotionConditionDto) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Promotion condition ${id} not found`);
    }

    const payload: Partial<PromotionCondition> = {};

    if (dto.promotionId !== undefined) {
      payload.promotionId = dto.promotionId;
    }

    if (dto.productId !== undefined) {
      payload.productId = dto.productId;
    }

    if (dto.quantity !== undefined) {
      payload.quantity = this.normalizeQuantity(dto.quantity);
    }

    if (dto.role !== undefined) {
      payload.role = dto.role;
    }

    const merged = this.repo.merge(entity, payload);
    await this.repo.save(merged);

    return this.findOne(id);
  }

  async remove(id: number) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Promotion condition ${id} not found`);
    }

    await this.repo.remove(entity);

    return { success: true };
  }

  private normalizeQuantity(quantity?: number) {
    if (quantity === undefined || quantity === null) {
      return 1;
    }

    return Math.max(1, Math.floor(quantity));
  }
}
