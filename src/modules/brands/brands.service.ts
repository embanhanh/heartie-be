import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brand, BrandStatus } from './entities/brand.entity';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private readonly brandRepo: Repository<Brand>,
  ) {}

  async create(dto: CreateBrandDto) {
    const entity = this.brandRepo.create({
      name: dto.name,
      status: dto.status ?? BrandStatus.ACTIVE,
    });

    return this.brandRepo.save(entity);
  }

  findAll() {
    return this.brandRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number) {
    const brand = await this.brandRepo.findOne({ where: { id } });

    if (!brand) {
      throw new NotFoundException(`Brand not found: ${id}`);
    }

    return brand;
  }

  async update(id: number, dto: UpdateBrandDto) {
    const brand = await this.brandRepo.findOne({ where: { id } });

    if (!brand) {
      throw new NotFoundException(`Brand not found: ${id}`);
    }

    if (dto.name !== undefined) {
      brand.name = dto.name;
    }

    if (dto.status !== undefined) {
      brand.status = dto.status;
    }

    return this.brandRepo.save(brand);
  }

  async remove(id: number) {
    const brand = await this.brandRepo.findOne({ where: { id } });

    if (!brand) {
      throw new NotFoundException(`Brand not found: ${id}`);
    }

    await this.brandRepo.remove(brand);

    return { id };
  }
}
