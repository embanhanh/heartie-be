import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariant, ProductVariantStatus } from './entities/product_variant.entity';
import { CreateProductVariantDto } from './dto/create-product_variant.dto';
import { UpdateProductVariantDto } from './dto/update-product_variant.dto';

@Injectable()
export class ProductVariantsService {
  constructor(
    @InjectRepository(ProductVariant)
    private repo: Repository<ProductVariant>,
  ) {}

  create(dto: CreateProductVariantDto) {
    const entity = this.repo.create({
      ...dto,
      status: dto.status ?? ProductVariantStatus.ACTIVE,
      extra: dto.extra ?? {},
    });

    return this.repo.save(entity);
  }

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  async update(id: number, dto: UpdateProductVariantDto) {
    const existing = await this.repo.findOneBy({ id });
    const base = existing ?? this.repo.create({ id } as ProductVariant);
    const merged = this.repo.merge(base, dto);

    if (dto.extra === undefined) {
      merged.extra = existing?.extra ?? base.extra ?? {};
    }

    if (dto.status === undefined) {
      merged.status = existing?.status ?? ProductVariantStatus.ACTIVE;
    }

    return this.repo.save(merged);
  }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
