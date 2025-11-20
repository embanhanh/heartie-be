import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { CustomerGroup } from './entities/customer-group.entity';
import { CreateCustomerGroupDto } from './dto/create-customer-group.dto';
import { UpdateCustomerGroupDto } from './dto/update-customer-group.dto';

@Injectable()
export class CustomerGroupsService {
  private readonly defaultRelations = {
    userCustomerGroups: true,
    promotionCustomerGroups: true,
  } as const;

  constructor(
    @InjectRepository(CustomerGroup)
    private readonly repo: Repository<CustomerGroup>,
  ) {}

  async create(dto: CreateCustomerGroupDto) {
    const exists = await this.repo.exist({ where: { name: dto.name } });

    if (exists) {
      throw new ConflictException('Customer group name already exists');
    }

    const trimmedName = dto.name.trim();
    const descriptionInput = dto.description;
    const normalizedDescription = (() => {
      if (descriptionInput === undefined) {
        return null;
      }

      const trimmed = (descriptionInput ?? '').trim();
      return trimmed.length ? trimmed : null;
    })();

    const entity = this.repo.create({
      name: trimmedName,
      description: normalizedDescription,
    });

    const saved = await this.repo.save(entity);
    return this.findOne(saved.id);
  }

  findAll(): Promise<CustomerGroup[]> {
    const options: FindManyOptions<CustomerGroup> = {
      relations: this.defaultRelations,
      order: { createdAt: 'DESC' },
    };

    return this.repo.find(options);
  }

  async findOne(id: number): Promise<CustomerGroup> {
    const entity = await this.repo.findOne({
      where: { id },
      relations: this.defaultRelations,
    });

    if (!entity) {
      throw new NotFoundException(`Customer group not found: ${id}`);
    }

    return entity;
  }

  async update(id: number, dto: UpdateCustomerGroupDto) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Customer group not found: ${id}`);
    }

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();

      if (trimmedName !== entity.name) {
        const exists = await this.repo.exist({
          where: { name: trimmedName },
        });

        if (exists) {
          throw new ConflictException('Customer group name already exists');
        }
      }

      entity.name = trimmedName;
    }

    if (dto.description !== undefined) {
      const normalized = dto.description?.trim();
      entity.description = normalized ? normalized : null;
    }

    await this.repo.save(entity);

    return this.findOne(id);
  }

  async remove(id: number) {
    const entity = await this.repo.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Customer group not found: ${id}`);
    }

    await this.repo.remove(entity);

    return { id };
  }
}
