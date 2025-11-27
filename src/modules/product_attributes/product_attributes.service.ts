import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Attribute } from '../attributes/entities/attribute.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
import { CreateProductAttributeDto } from './dto/create-product_attribute.dto';
import { UpdateProductAttributeDto } from './dto/update-product_attribute.dto';

@Injectable()
export class ProductAttributesService {
  constructor(
    @InjectRepository(ProductAttribute)
    private readonly repo: Repository<ProductAttribute>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Attribute)
    private readonly attributeRepo: Repository<Attribute>,
  ) {}

  async create(dto: CreateProductAttributeDto) {
    const product = await this.productRepo.findOne({ where: { id: dto.productId } });

    if (!product) {
      throw new NotFoundException(`Product not found: ${dto.productId}`);
    }

    const attribute = await this.attributeRepo.findOne({ where: { id: dto.attributeId } });

    if (!attribute) {
      throw new NotFoundException(`Attribute not found: ${dto.attributeId}`);
    }

    const duplicate = await this.repo.findOne({
      where: {
        productId: dto.productId,
        attributeId: dto.attributeId,
      },
    });

    if (duplicate) {
      throw new BadRequestException('Attribute already linked to this product.');
    }

    const entity = this.repo.create({
      productId: dto.productId,
      attributeId: dto.attributeId,
      isRequired: dto.isRequired ?? true,
    });

    return this.repo.save(entity);
  }

  findAll() {
    return this.repo.find({ order: { productId: 'ASC', attributeId: 'ASC' } });
  }

  async findOne(id: number) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Product attribute not found: ${id}`);
    }

    return entity;
  }

  async update(id: number, dto: UpdateProductAttributeDto) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Product attribute not found: ${id}`);
    }

    let productId = entity.productId;
    let attributeId = entity.attributeId;

    if (dto.productId && dto.productId !== entity.productId) {
      const product = await this.productRepo.findOne({ where: { id: dto.productId } });

      if (!product) {
        throw new NotFoundException(`Product not found: ${dto.productId}`);
      }

      productId = dto.productId;
      entity.productId = dto.productId;
    }

    if (dto.attributeId && dto.attributeId !== entity.attributeId) {
      const attribute = await this.attributeRepo.findOne({ where: { id: dto.attributeId } });

      if (!attribute) {
        throw new NotFoundException(`Attribute not found: ${dto.attributeId}`);
      }

      attributeId = dto.attributeId;
      entity.attributeId = dto.attributeId;
    }

    if (dto.productId || dto.attributeId) {
      const duplicate = await this.repo.findOne({
        where: { productId, attributeId },
      });

      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('Attribute already linked to this product.');
      }
    }

    if (dto.isRequired !== undefined) {
      entity.isRequired = dto.isRequired;
    }

    return this.repo.save(entity);
  }

  async remove(id: number) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Product attribute not found: ${id}`);
    }

    await this.repo.remove(entity);

    return { id };
  }
}
