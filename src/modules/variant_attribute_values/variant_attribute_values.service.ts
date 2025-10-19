import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VariantAttributeValue } from './entities/variant-attribute-value.entity';
import { ProductVariant } from '../product_variants/entities/product_variant.entity';
import { Attribute } from '../attributes/entities/attribute.entity';
import { AttributeValue } from '../attribute_values/entities/attribute-value.entity';
import { CreateVariantAttributeValueDto } from './dto/create-variant_attribute_value.dto';
import { UpdateVariantAttributeValueDto } from './dto/update-variant_attribute_value.dto';

@Injectable()
export class VariantAttributeValuesService {
  constructor(
    @InjectRepository(VariantAttributeValue)
    private readonly repo: Repository<VariantAttributeValue>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(Attribute)
    private readonly attributeRepo: Repository<Attribute>,
    @InjectRepository(AttributeValue)
    private readonly attributeValueRepo: Repository<AttributeValue>,
  ) {}

  async create(dto: CreateVariantAttributeValueDto) {
    await this.ensureVariantExists(dto.variantId);
    await this.ensureAttributeAndValueConsistency(dto.attributeId, dto.attributeValueId);

    const duplicate = await this.repo.findOne({
      where: { variantId: dto.variantId, attributeId: dto.attributeId },
    });

    if (duplicate) {
      throw new BadRequestException('Attribute already linked to this variant.');
    }

    const entity = this.repo.create({
      variantId: dto.variantId,
      attributeId: dto.attributeId,
      attributeValueId: dto.attributeValueId,
    });

    return this.repo.save(entity);
  }

  findAll() {
    return this.repo.find({ order: { variantId: 'ASC', attributeId: 'ASC' } });
  }

  async findOne(id: number) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Variant attribute value not found: ${id}`);
    }

    return entity;
  }

  async update(id: number, dto: UpdateVariantAttributeValueDto) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Variant attribute value not found: ${id}`);
    }

    const variantId = dto.variantId ?? entity.variantId;
    const attributeId = dto.attributeId ?? entity.attributeId;
    const attributeValueId = dto.attributeValueId ?? entity.attributeValueId;

    if (dto.variantId && dto.variantId !== entity.variantId) {
      await this.ensureVariantExists(dto.variantId);
      entity.variantId = dto.variantId;
    }

    if (dto.attributeId !== undefined || dto.attributeValueId !== undefined) {
      await this.ensureAttributeAndValueConsistency(attributeId, attributeValueId);
      entity.attributeId = attributeId;
      entity.attributeValueId = attributeValueId;
    }

    const duplicate = await this.repo.findOne({
      where: { variantId, attributeId },
    });

    if (duplicate && duplicate.id !== id) {
      throw new BadRequestException('Attribute already linked to this variant.');
    }

    return this.repo.save(entity);
  }

  async remove(id: number) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Variant attribute value not found: ${id}`);
    }

    await this.repo.remove(entity);

    return { id };
  }

  private async ensureVariantExists(variantId: number) {
    const variant = await this.variantRepo.findOne({ where: { id: variantId } });

    if (!variant) {
      throw new NotFoundException(`Product variant not found: ${variantId}`);
    }
  }

  private async ensureAttributeAndValueConsistency(attributeId: number, attributeValueId: number) {
    const attribute = await this.attributeRepo.findOne({ where: { id: attributeId } });

    if (!attribute) {
      throw new NotFoundException(`Attribute not found: ${attributeId}`);
    }

    const attributeValue = await this.attributeValueRepo.findOne({
      where: { id: attributeValueId },
    });

    if (!attributeValue) {
      throw new NotFoundException(`Attribute value not found: ${attributeValueId}`);
    }

    if (attributeValue.attributeId !== attributeId) {
      throw new BadRequestException('Attribute value does not belong to the specified attribute.');
    }
  }
}
