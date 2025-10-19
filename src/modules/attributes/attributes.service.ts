import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attribute, AttributeType } from './entities/attribute.entity';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { FindAttributesQueryDto } from './dto/find-attributes-query.dto';

@Injectable()
export class AttributesService {
  constructor(
    @InjectRepository(Attribute)
    private readonly repo: Repository<Attribute>,
  ) {}

  async create(dto: CreateAttributeDto) {
    const name = dto.name.trim();

    const existing = await this.repo.findOne({ where: { name } });

    if (existing) {
      throw new BadRequestException(`Attribute with name "${name}" already exists.`);
    }

    const entity = this.repo.create({
      name,
      type: dto.type ?? AttributeType.COMMON,
    });

    return this.repo.save(entity);
  }

  findAll(query: FindAttributesQueryDto = {}) {
    const where = query.type ? { type: query.type } : undefined;

    return this.repo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number) {
    const attribute = await this.repo.findOne({
      where: { id },
      relations: { values: true },
      order: { values: { value: 'ASC' } },
    });

    if (!attribute) {
      throw new NotFoundException(`Attribute not found: ${id}`);
    }

    return attribute;
  }

  async update(id: number, dto: UpdateAttributeDto) {
    const attribute = await this.repo.findOne({ where: { id } });

    if (!attribute) {
      throw new NotFoundException(`Attribute not found: ${id}`);
    }

    if (dto.name) {
      const name = dto.name.trim();
      const duplicate = await this.repo.findOne({ where: { name } });

      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException(`Attribute with name "${name}" already exists.`);
      }

      attribute.name = name;
    }

    if (dto.type) {
      attribute.type = dto.type;
    }

    return this.repo.save(attribute);
  }

  async remove(id: number) {
    const attribute = await this.repo.findOne({ where: { id } });

    if (!attribute) {
      throw new NotFoundException(`Attribute not found: ${id}`);
    }

    await this.repo.remove(attribute);

    return { id };
  }
}
