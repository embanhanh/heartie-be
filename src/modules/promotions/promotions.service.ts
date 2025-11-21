import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Promotion, DiscountType, ApplyScope } from './entities/promotion.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionCondition } from '../promotion_conditions/entities/promotion-condition.entity';
import { PromotionBranch } from '../promotion_branches/entities/promotion-branch.entity';
import { BaseService } from 'src/common/services/base.service';
import { PaginatedResult, SortParam } from 'src/common/dto/pagination.dto';
import { PromotionQueryDto } from './dto/promotion-query.dto';

@Injectable()
export class PromotionsService extends BaseService<Promotion> {
  private readonly defaultRelations = {
    conditions: { product: true },
    branches: { branch: true },
    customerGroups: { customerGroup: true },
  } as const;

  constructor(
    @InjectRepository(Promotion)
    private readonly repo: Repository<Promotion>,
  ) {
    super(repo, 'promotion');
  }

  async create(dto: CreatePromotionDto) {
    const promotionId = await this.repo.manager.transaction(async (manager) => {
      const promotion = manager.create(Promotion, {
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        description: dto.description?.trim() || null,
        type: dto.type,
        comboType: dto.comboType ?? null,
        couponType: dto.couponType ?? null,
        discountValue: this.normalizeNumber(dto.discountValue, 0),
        discountType: dto.discountType ?? DiscountType.PERCENT,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        minOrderValue: this.normalizeNumber(dto.minOrderValue, 0),
        maxDiscount: this.normalizeNullableNumber(dto.maxDiscount),
        usageLimit: dto.usageLimit ?? null,
        usedCount: dto.usedCount ?? 0,
        applyScope: dto.applyScope ?? ApplyScope.GLOBAL,
        isActive: dto.isActive ?? true,
      });

      const saved = await manager.save(promotion);

      await this.applyRelationChanges(manager, saved.id, dto.conditions, dto.branchIds);

      return saved.id;
    });

    return this.findOne(promotionId);
  }

  async findAll(options: PromotionQueryDto): Promise<PaginatedResult<Promotion>> {
    return this.paginate(options, (qb) => {
      qb.leftJoinAndSelect('promotion.conditions', 'conditions');
      qb.leftJoinAndSelect('conditions.product', 'conditionProduct');
      qb.leftJoinAndSelect('promotion.branches', 'promotionBranch');
      qb.leftJoinAndSelect('promotionBranch.branch', 'branch');
      qb.leftJoinAndSelect('promotion.customerGroups', 'promotionCustomerGroup');
      qb.leftJoinAndSelect('promotionCustomerGroup.customerGroup', 'customerGroup');

      const search = options.search?.trim();
      if (search) {
        const keyword = `%${search.toLowerCase()}%`;
        qb.andWhere(
          '(LOWER(promotion.name) LIKE :keyword OR LOWER(promotion.code) LIKE :keyword)',
          { keyword },
        );
      }

      if (options.type) {
        qb.andWhere('promotion.type = :type', { type: options.type });
      }

      if (options.applyScope) {
        qb.andWhere('promotion.applyScope = :applyScope', { applyScope: options.applyScope });
      }

      if (typeof options.isActive === 'boolean') {
        qb.andWhere('promotion.isActive = :isActive', { isActive: options.isActive });
      }

      this.applyDateFilter(qb, 'startDate', options.startDateFrom, options.startDateTo);
      this.applyDateFilter(qb, 'endDate', options.endDateFrom, options.endDateTo);
    });
  }

  async findOne(id: number) {
    const promotion = await this.repo.findOne({
      where: { id },
      relations: this.defaultRelations,
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion ${id} not found`);
    }

    return promotion;
  }

  async update(id: number, dto: UpdatePromotionDto) {
    await this.repo.manager.transaction(async (manager) => {
      const promotion = await manager.findOne(Promotion, { where: { id } });

      if (!promotion) {
        throw new NotFoundException(`Promotion ${id} not found`);
      }

      promotion.name = dto.name !== undefined ? dto.name.trim() : promotion.name;
      promotion.code = dto.code !== undefined ? (dto.code?.trim() ?? null) : promotion.code;
      promotion.description =
        dto.description !== undefined ? (dto.description?.trim() ?? null) : promotion.description;
      promotion.type = dto.type ?? promotion.type;
      promotion.comboType = dto.comboType ?? promotion.comboType;
      promotion.couponType = dto.couponType ?? promotion.couponType;
      promotion.discountValue =
        dto.discountValue !== undefined
          ? this.normalizeNumber(dto.discountValue, promotion.discountValue)
          : promotion.discountValue;
      promotion.discountType = dto.discountType ?? promotion.discountType;
      promotion.startDate = dto.startDate ? new Date(dto.startDate) : promotion.startDate;
      promotion.endDate = dto.endDate ? new Date(dto.endDate) : promotion.endDate;
      promotion.minOrderValue =
        dto.minOrderValue !== undefined
          ? this.normalizeNumber(dto.minOrderValue, promotion.minOrderValue)
          : promotion.minOrderValue;
      promotion.maxDiscount =
        dto.maxDiscount !== undefined
          ? this.normalizeNullableNumber(dto.maxDiscount)
          : promotion.maxDiscount;
      promotion.usageLimit = dto.usageLimit ?? promotion.usageLimit;
      promotion.usedCount = dto.usedCount ?? promotion.usedCount;
      promotion.applyScope = dto.applyScope ?? promotion.applyScope;
      promotion.isActive = dto.isActive ?? promotion.isActive;

      await manager.save(promotion);

      await this.applyRelationChanges(manager, id, dto.conditions, dto.branchIds);
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    const promotion = await this.repo.findOne({ where: { id } });

    if (!promotion) {
      throw new NotFoundException(`Promotion ${id} not found`);
    }

    await this.repo.remove(promotion);

    return { success: true };
  }

  private async applyRelationChanges(
    manager: EntityManager,
    promotionId: number,
    conditions?: CreatePromotionDto['conditions'],
    branchIds?: number[],
  ) {
    if (conditions !== undefined) {
      await this.replacePromotionConditions(manager, promotionId, conditions);
    }

    if (branchIds !== undefined) {
      await this.replacePromotionBranches(manager, promotionId, branchIds);
    }
  }

  private async replacePromotionConditions(
    manager: EntityManager,
    promotionId: number,
    conditions: CreatePromotionDto['conditions'],
  ) {
    await manager.delete(PromotionCondition, { promotionId });

    if (!conditions?.length) {
      return;
    }

    const entities = conditions.map((condition) =>
      manager.create(PromotionCondition, {
        promotionId,
        productId: condition.productId,
        quantity: this.normalizeQuantity(condition.quantity),
        role: condition.role,
      }),
    );

    await manager.save(entities);
  }

  private async replacePromotionBranches(
    manager: EntityManager,
    promotionId: number,
    branchIds: number[],
  ) {
    await manager.delete(PromotionBranch, { promotionId });

    const uniqueBranchIds = this.deduplicatePositiveIds(branchIds);

    if (!uniqueBranchIds.length) {
      return;
    }

    const entities = uniqueBranchIds.map((branchId) =>
      manager.create(PromotionBranch, {
        promotionId,
        branchId,
      }),
    );

    await manager.save(entities);
  }

  private deduplicatePositiveIds(ids: number[] | undefined) {
    if (!ids?.length) {
      return [] as number[];
    }

    const unique: number[] = [];
    const seen = new Set<number>();

    ids.forEach((raw) => {
      const value = Math.trunc(raw);

      if (value > 0 && !seen.has(value)) {
        seen.add(value);
        unique.push(value);
      }
    });

    return unique;
  }

  private normalizeNumber(value: number | undefined, fallback: number) {
    const numberValue = value ?? fallback;
    return Math.round(numberValue * 100) / 100;
  }

  private normalizeNullableNumber(value?: number | null) {
    if (value === undefined || value === null) {
      return null;
    }

    return Math.round(value * 100) / 100;
  }

  private normalizeQuantity(quantity?: number) {
    if (quantity === undefined || quantity === null) {
      return 1;
    }

    return Math.max(1, Math.floor(quantity));
  }

  protected override getDefaultSorts(): SortParam[] {
    return [{ field: 'createdAt', direction: 'desc' }];
  }
}
