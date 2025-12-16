import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slugify from 'slugify';
import { Collection, CollectionStatus } from './entities/collection.entity';
import { BaseService } from '../../common/services/base.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CollectionsQueryDto } from './dto/collections-query.dto';
import { PaginatedResult, SortParam } from '../../common/dto/pagination.dto';
import { normalizeString } from '../../common/utils/data-normalization.util';
import { UploadedFile } from '../../common/types/uploaded-file.type';
import { resolveModuleUploadPath } from '../../common/utils/upload.util';

@Injectable()
export class CollectionsService extends BaseService<Collection> {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
  ) {
    super(collectionRepository, 'collection');
  }

  protected override getDefaultSorts(): SortParam[] {
    return [
      { field: 'createdAt', direction: 'desc' },
      { field: 'id', direction: 'desc' },
    ];
  }

  async create(dto: CreateCollectionDto, imageFile?: UploadedFile): Promise<Collection> {
    const slug = await this.generateSlugOrFail(dto.name);

    const entity = this.collectionRepository.create({
      name: dto.name.trim(),
      slug,
      description: this.normalizeNullableString(dto.description),
      image: this.resolveImagePath(imageFile, dto.imageUrl),
      status: dto.status ?? CollectionStatus.ACTIVE,
    });

    return this.collectionRepository.save(entity);
  }

  async findAll(query: CollectionsQueryDto): Promise<PaginatedResult<Collection>> {
    return this.paginate(query, (qb) => {
      if (query.status) {
        qb.andWhere('collection.status = :status', { status: query.status });
      }

      const search = normalizeString(query.search);
      if (search) {
        const like = `%${search.replace(/%/g, '\\%')}%`;
        qb.andWhere('collection.name ILIKE :search OR collection.slug ILIKE :search', {
          search: like,
        });
      }
    });
  }

  async findOne(id: number): Promise<Collection> {
    const collection = await this.collectionRepository.findOne({
      where: { id },
      relations: { collectionProducts: true },
    });

    if (!collection) {
      throw new NotFoundException(`Collection ${id} not found`);
    }

    return collection;
  }

  async findBySlug(slug: string): Promise<Collection> {
    const normalizedSlug = slug?.trim().toLowerCase();
    if (!normalizedSlug) {
      throw new NotFoundException('Collection slug is required');
    }

    const collection = await this.collectionRepository
      .createQueryBuilder('collection')
      .leftJoinAndSelect('collection.collectionProducts', 'collectionProducts')
      .where('LOWER(collection.slug) = :slug', { slug: normalizedSlug })
      .getOne();

    if (!collection) {
      throw new NotFoundException(`Collection ${slug} not found`);
    }

    return collection;
  }

  async update(
    id: number,
    dto: UpdateCollectionDto,
    imageFile?: UploadedFile,
  ): Promise<Collection> {
    const existing = await this.collectionRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Collection ${id} not found`);
    }

    const nextName = dto.name?.trim() ?? existing.name;
    let slug = existing.slug ?? null;

    if (!slug || (dto.name && dto.name.trim() && dto.name.trim() !== existing.name)) {
      slug = await this.generateSlugOrFail(nextName, id);
    }

    const requestedImageUrl = dto.imageUrl !== undefined ? dto.imageUrl : (existing.image ?? null);

    const merged = this.collectionRepository.merge(existing, {
      ...dto,
      name: nextName,
      slug,
      description:
        dto.description !== undefined
          ? this.normalizeNullableString(dto.description)
          : existing.description,
      image: this.resolveImagePath(imageFile, requestedImageUrl),
      status: dto.status ?? existing.status,
    });

    await this.collectionRepository.save(merged);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const existing = await this.collectionRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Collection ${id} not found`);
    }

    await this.collectionRepository.delete(id);
  }

  private normalizeNullableString(value?: string | null): string | null {
    const normalized = normalizeString(value ?? undefined);
    return normalized ?? null;
  }

  private async resolveSlug(source?: string, ignoreId?: number): Promise<string | null> {
    const normalizedSource = normalizeString(source);
    if (!normalizedSource) {
      return null;
    }

    const base = slugify(normalizedSource, { lower: true, strict: true });
    if (!base) {
      return null;
    }

    if (await this.isSlugFree(base, ignoreId)) {
      return base;
    }

    let suffix = 1;
    let candidate = `${base}-${suffix}`;
    while (!(await this.isSlugFree(candidate, ignoreId))) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }

  private async generateSlugOrFail(source: string, ignoreId?: number): Promise<string> {
    const slug = await this.resolveSlug(source, ignoreId);
    if (!slug) {
      throw new BadRequestException('Không thể tạo slug hợp lệ từ tên bộ sưu tập');
    }

    return slug;
  }

  private async isSlugFree(slug: string, ignoreId?: number): Promise<boolean> {
    const existing = await this.collectionRepository.findOne({ where: { slug } });
    return !existing || existing.id === ignoreId;
  }

  private resolveImagePath(file?: UploadedFile, fallback?: string | null): string | null {
    const normalizedFallback = this.normalizeNullableString(fallback ?? undefined);
    return resolveModuleUploadPath('collections', file, normalizedFallback ?? null) ?? null;
  }
}
