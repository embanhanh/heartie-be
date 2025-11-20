import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromotionCustomerGroup } from './entities/promotion-customer-group.entity';
import { CreatePromotionCustomerGroupDto } from './dto/create-promotion-customer-group.dto';
import { UpdatePromotionCustomerGroupDto } from './dto/update-promotion-customer-group.dto';

@Injectable()
export class PromotionCustomerGroupsService {
  private readonly defaultRelations = {
    promotion: true,
    customerGroup: true,
  } as const;

  constructor(
    @InjectRepository(PromotionCustomerGroup)
    private readonly repo: Repository<PromotionCustomerGroup>,
  ) {}

  async create(dto: CreatePromotionCustomerGroupDto) {
    const entity = this.repo.create({
      promotionId: dto.promotionId,
      customerGroupId: dto.customerGroupId ?? null,
    });

    return this.repo.save(entity);
  }

  findAll() {
    return this.repo.find({
      relations: this.defaultRelations,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const entity = await this.repo.findOne({
      where: { id },
      relations: this.defaultRelations,
    });

    if (!entity) {
      throw new NotFoundException(`Promotion customer group ${id} not found`);
    }

    return entity;
  }

  async update(id: number, dto: UpdatePromotionCustomerGroupDto) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Promotion customer group ${id} not found`);
    }

    const payload: Partial<PromotionCustomerGroup> = {};

    if (dto.promotionId !== undefined) {
      payload.promotionId = dto.promotionId;
    }

    if (dto.customerGroupId !== undefined) {
      payload.customerGroupId = dto.customerGroupId ?? null;
    }

    const merged = this.repo.merge(entity, payload);
    await this.repo.save(merged);

    return this.findOne(id);
  }

  async remove(id: number) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Promotion customer group ${id} not found`);
    }

    await this.repo.remove(entity);

    return { success: true };
  }
}
