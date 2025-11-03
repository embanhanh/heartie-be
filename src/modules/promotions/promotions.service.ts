import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion, DiscountType, ApplyScope } from './entities/promotion.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@Injectable()
export class PromotionsService {
  private readonly defaultRelations = {
    conditions: { product: true },
    branches: { branch: true },
    customerGroups: { customerGroup: true },
  } as const;

  constructor(
    @InjectRepository(Promotion)
    private readonly repo: Repository<Promotion>,
  ) {}

  async create(dto: CreatePromotionDto) {
    const promotion = this.repo.create({
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

    return this.repo.save(promotion);
  }

  findAll() {
    return this.repo.find({
      relations: this.defaultRelations,
      order: { createdAt: 'DESC' },
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
    const promotion = await this.repo.findOne({ where: { id } });

    if (!promotion) {
      throw new NotFoundException(`Promotion ${id} not found`);
    }

    const merged = this.repo.merge(promotion, {
      name: dto.name !== undefined ? dto.name.trim() : promotion.name,
      code: dto.code !== undefined ? (dto.code?.trim() ?? null) : promotion.code,
      description:
        dto.description !== undefined ? (dto.description?.trim() ?? null) : promotion.description,
      type: dto.type ?? promotion.type,
      comboType: dto.comboType ?? promotion.comboType,
      couponType: dto.couponType ?? promotion.couponType,
      discountValue:
        dto.discountValue !== undefined
          ? this.normalizeNumber(dto.discountValue, promotion.discountValue)
          : promotion.discountValue,
      discountType: dto.discountType ?? promotion.discountType,
      startDate: dto.startDate ? new Date(dto.startDate) : promotion.startDate,
      endDate: dto.endDate ? new Date(dto.endDate) : promotion.endDate,
      minOrderValue:
        dto.minOrderValue !== undefined
          ? this.normalizeNumber(dto.minOrderValue, promotion.minOrderValue)
          : promotion.minOrderValue,
      maxDiscount:
        dto.maxDiscount !== undefined
          ? this.normalizeNullableNumber(dto.maxDiscount)
          : promotion.maxDiscount,
      usageLimit: dto.usageLimit ?? promotion.usageLimit,
      usedCount: dto.usedCount ?? promotion.usedCount,
      applyScope: dto.applyScope ?? promotion.applyScope,
      isActive: dto.isActive ?? promotion.isActive,
    });

    await this.repo.save(merged);

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
}
