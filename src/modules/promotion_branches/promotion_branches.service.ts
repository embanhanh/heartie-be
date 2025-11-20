import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromotionBranch } from './entities/promotion-branch.entity';
import { CreatePromotionBranchDto } from './dto/create-promotion-branch.dto';
import { UpdatePromotionBranchDto } from './dto/update-promotion-branch.dto';

@Injectable()
export class PromotionBranchesService {
  private readonly defaultRelations = {
    promotion: true,
    branch: true,
  } as const;

  constructor(
    @InjectRepository(PromotionBranch)
    private readonly repo: Repository<PromotionBranch>,
  ) {}

  async create(dto: CreatePromotionBranchDto) {
    const entity = this.repo.create({
      promotionId: dto.promotionId,
      branchId: dto.branchId,
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
      throw new NotFoundException(`Promotion branch ${id} not found`);
    }

    return entity;
  }

  async update(id: number, dto: UpdatePromotionBranchDto) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Promotion branch ${id} not found`);
    }

    const payload: Partial<PromotionBranch> = {};

    if (dto.promotionId !== undefined) {
      payload.promotionId = dto.promotionId;
    }

    if (dto.branchId !== undefined) {
      payload.branchId = dto.branchId;
    }

    const merged = this.repo.merge(entity, payload);
    await this.repo.save(merged);

    return this.findOne(id);
  }

  async remove(id: number) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Promotion branch ${id} not found`);
    }

    await this.repo.remove(entity);

    return { success: true };
  }
}
