import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UploadedFile } from 'src/common/types/uploaded-file.type';
import { resolveModuleUploadPath } from 'src/common/utils/upload.util';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private repo: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryDto, file?: UploadedFile) {
    await this.ensureValidParent(dto.parentId);

    const imagePath =
      resolveModuleUploadPath('categories', file) ?? this.normalizeImageInput(dto.image) ?? null;

    const category = this.repo.create({
      name: dto.name,
      parentId: dto.parentId ?? null,
      image: imagePath,
    });

    const saved = await this.repo.save(category);
    return this.findOne(saved.id);
  }

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findRootCategories() {
    return this.repo.find({ where: { parentId: IsNull() }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: number) {
    const category = await this.repo.findOne({
      where: { id },
      relations: { parent: true },
    });

    if (!category) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    return category;
  }

  async update(id: number, dto: UpdateCategoryDto, file?: UploadedFile) {
    const category = await this.repo.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    if (dto.name !== undefined) {
      category.name = dto.name;
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      await this.ensureValidParent(dto.parentId);
      category.parentId = dto.parentId ?? null;
    }

    const normalizedImageInput = this.normalizeImageInput(dto.image);

    if (file) {
      await this.deleteImageIfExists(category.image);
      category.image = resolveModuleUploadPath('categories', file) ?? null;
    } else if (normalizedImageInput !== undefined) {
      if (normalizedImageInput === null) {
        await this.deleteImageIfExists(category.image);
        category.image = null;
      } else {
        category.image = normalizedImageInput;
      }
    }

    await this.repo.save(category);

    return this.findOne(id);
  }

  async remove(id: number) {
    const category = await this.repo.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    await this.deleteImageIfExists(category.image);

    await this.repo.remove(category);

    return { id };
  }

  private async ensureValidParent(parentId?: number | null) {
    if (parentId === undefined || parentId === null) {
      return;
    }

    const exists = await this.repo.exist({ where: { id: parentId } });

    if (!exists) {
      throw new BadRequestException(`Parent category not found: ${parentId}`);
    }
  }

  private async deleteImageIfExists(image?: string | null) {
    if (!image) {
      return;
    }

    const normalized = image.replace(/^upload\//, 'uploads/');

    if (!normalized.startsWith('uploads/')) {
      return;
    }

    const absolutePath = join(process.cwd(), normalized);

    try {
      await fs.unlink(absolutePath);
    } catch {
      // ignore if file does not exist
    }
  }

  private normalizeImageInput(value?: string | null): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();

    if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
      return null;
    }

    const normalized = trimmed.replace(/^upload\//, 'uploads/');

    return normalized;
  }
}
