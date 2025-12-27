import axios from 'axios';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariant, ProductVariantStatus } from './entities/product_variant.entity';
import { CreateProductVariantDto } from './dto/create-product_variant.dto';
import { UpdateProductVariantDto } from './dto/update-product_variant.dto';
import { VisionService } from '../vision/vision.service';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';

@Injectable()
export class ProductVariantsService {
  private readonly logger = new Logger(ProductVariantsService.name);

  constructor(
    @InjectRepository(ProductVariant)
    private repo: Repository<ProductVariant>,
    private readonly visionService: VisionService,
  ) {}

  async create(dto: CreateProductVariantDto) {
    const entity = this.repo.create({
      ...dto,
      status: dto.status ?? ProductVariantStatus.ACTIVE,
      extra: dto.extra ?? {},
    });

    const saved = await this.repo.save(entity);
    await this.refreshVariantEmbeddingSafely(saved.id);
    return saved;
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

    const saved = await this.repo.save(merged);
    await this.refreshVariantEmbeddingSafely(saved.id);
    return saved;
  }

  private async refreshVariantEmbeddingSafely(variantId: number) {
    try {
      const variant = await this.repo.findOne({
        where: { id: variantId },
        select: { id: true, image: true },
      });

      if (variant?.image) {
        let buffer: Buffer | null = null;

        if (variant.image.startsWith('http')) {
          try {
            const response = await axios.get(variant.image, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);
            this.logger.debug(`Fetched remote image for variant ${variantId}`);
          } catch (e) {
            this.logger.warn(`Failed to fetch remote image ${variant.image}: ${e}`);
          }
        } else {
          const fullPath = path.join(process.cwd(), variant.image);
          if (fs.existsSync(fullPath)) {
            buffer = fs.readFileSync(fullPath);
          } else {
            this.logger.warn(`Local image file not found: ${fullPath}`);
          }
        }

        if (buffer) {
          const visualEmbedding = await this.visionService.generateEmbedding(buffer);
          await this.repo.update(variantId, { visualEmbedding });
          this.logger.debug(`Generated image embedding for variant ${variantId}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to refresh embedding for variant ${variantId}: ${message}`);
    }
  }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
