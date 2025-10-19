import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attribute } from '../attributes/entities/attribute.entity';
import { AttributeValue } from './entities/attribute-value.entity';
import { CreateAttributeValueDto } from './dto/create-attribute_value.dto';
import { UpdateAttributeValueDto } from './dto/update-attribute_value.dto';

@Injectable()
export class AttributeValuesService {
  constructor(
    @InjectRepository(AttributeValue)
    private readonly repo: Repository<AttributeValue>,
    @InjectRepository(Attribute)
    private readonly attributeRepo: Repository<Attribute>,
  ) {}

  async create(dto: CreateAttributeValueDto) {
    const attribute = await this.attributeRepo.findOne({ where: { id: dto.attributeId } });

    if (!attribute) {
      throw new NotFoundException(`Attribute not found: ${dto.attributeId}`);
    }

    const normalizedValue = dto.value.trim();

    const duplicate = await this.repo.findOne({
      where: { attributeId: dto.attributeId, value: normalizedValue },
    });

    if (duplicate) {
      throw new BadRequestException('Value already exists for this attribute.');
    }

    const entity = this.repo.create({
      attributeId: dto.attributeId,
      value: normalizedValue,
      meta: dto.meta ?? {},
    });

    return this.repo.save(entity);
  }

  findAll() {
    return this.repo.find({ order: { attributeId: 'ASC', value: 'ASC' } });
  }

  async findOne(id: number) {
    const value = await this.repo.findOne({ where: { id } });

    if (!value) {
      throw new NotFoundException(`Attribute value not found: ${id}`);
    }

    return value;
  }

  async update(id: number, dto: UpdateAttributeValueDto) {
    const value = await this.repo.findOne({ where: { id } });

    if (!value) {
      throw new NotFoundException(`Attribute value not found: ${id}`);
    }

    let attributeChanged = false;
    let valueChanged = false;

    if (dto.attributeId && dto.attributeId !== value.attributeId) {
      const attribute = await this.attributeRepo.findOne({ where: { id: dto.attributeId } });

      if (!attribute) {
        throw new NotFoundException(`Attribute not found: ${dto.attributeId}`);
      }

      value.attributeId = dto.attributeId;
      attributeChanged = true;
    }

    if (dto.value) {
      const normalizedValue = dto.value.trim();
      value.value = normalizedValue;
      valueChanged = true;
    }

    if (dto.meta !== undefined) {
      value.meta = dto.meta ?? {};
    }

    if (attributeChanged || valueChanged) {
      const duplicate = await this.repo.findOne({
        where: { attributeId: value.attributeId, value: value.value },
      });

      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('Value already exists for this attribute.');
      }
    }

    return this.repo.save(value);
  }

  async remove(id: number) {
    const value = await this.repo.findOne({ where: { id } });

    if (!value) {
      throw new NotFoundException(`Attribute value not found: ${id}`);
    }

    await this.repo.remove(value);

    return { id };
  }
}
