import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../../common/services/base.service';
import { CollectionProduct } from './entities/collection-product.entity';
import { Collection } from '../collections/entities/collection.entity';
import { Product } from '../products/entities/product.entity';
import { CreateCollectionProductDto } from './dto/create-collection-product.dto';
import { UpdateCollectionProductDto } from './dto/update-collection-product.dto';
import { CollectionProductsQueryDto } from './dto/collection-products-query.dto';
import { PaginatedResult, SortParam } from '../../common/dto/pagination.dto';
import { normalizeString } from '../../common/utils/data-normalization.util';

@Injectable()
export class CollectionProductsService extends BaseService<CollectionProduct> {
  constructor(
    @InjectRepository(CollectionProduct)
    private readonly collectionProductRepository: Repository<CollectionProduct>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {
    super(collectionProductRepository, 'collectionProduct');
  }

  protected override getDefaultSorts(): SortParam[] {
    return [
      { field: 'displayOrder', direction: 'asc' },
      { field: 'id', direction: 'desc' },
    ];
  }

  async create(dto: CreateCollectionProductDto): Promise<CollectionProduct> {
    await this.ensureCollectionExists(dto.collectionId);
    await this.ensureProductExists(dto.productId);
    await this.ensureUniquePair(dto.collectionId, dto.productId);

    const entity = this.collectionProductRepository.create({
      collectionId: dto.collectionId,
      productId: dto.productId,
      displayOrder: dto.displayOrder ?? 0,
    });

    const saved = await this.collectionProductRepository.save(entity);
    return this.findOne(saved.id);
  }

  async findAll(query: CollectionProductsQueryDto): Promise<PaginatedResult<CollectionProduct>> {
    return this.paginate(query, (qb) => {
      qb.leftJoinAndSelect('collectionProduct.collection', 'collection').leftJoinAndSelect(
        'collectionProduct.product',
        'product',
      );

      if (query.collectionId) {
        qb.andWhere('collectionProduct.collectionId = :collectionId', {
          collectionId: query.collectionId,
        });
      }

      if (query.productId) {
        qb.andWhere('collectionProduct.productId = :productId', {
          productId: query.productId,
        });
      }

      const search = normalizeString(query.search);
      if (search) {
        const like = `%${search.replace(/%/g, '\\%')}%`;
        qb.andWhere(
          'collection.name ILIKE :search OR collection.slug ILIKE :search OR product.name ILIKE :search',
          { search: like },
        );
      }
    });
  }

  async findOne(id: number): Promise<CollectionProduct> {
    const entity = await this.collectionProductRepository.findOne({
      where: { id },
      relations: { collection: true, product: true },
    });

    if (!entity) {
      throw new NotFoundException(`Collection product ${id} not found`);
    }

    return entity;
  }

  async update(id: number, dto: UpdateCollectionProductDto): Promise<CollectionProduct> {
    const existing = await this.collectionProductRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Collection product ${id} not found`);
    }

    const nextCollectionId = dto.collectionId ?? existing.collectionId;
    const nextProductId = dto.productId ?? existing.productId;

    if (dto.collectionId) {
      await this.ensureCollectionExists(dto.collectionId);
    }

    if (dto.productId) {
      await this.ensureProductExists(dto.productId);
    }

    if (dto.collectionId || dto.productId) {
      await this.ensureUniquePair(nextCollectionId, nextProductId, id);
    }

    const merged = this.collectionProductRepository.merge(existing, {
      collectionId: nextCollectionId,
      productId: nextProductId,
      displayOrder: dto.displayOrder ?? existing.displayOrder,
    });

    await this.collectionProductRepository.save(merged);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const existing = await this.collectionProductRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Collection product ${id} not found`);
    }

    await this.collectionProductRepository.delete(id);
  }

  private async ensureCollectionExists(id: number): Promise<void> {
    const exists = await this.collectionRepository.findOne({ where: { id } });
    if (!exists) {
      throw new BadRequestException(`Collection ${id} không tồn tại`);
    }
  }

  private async ensureProductExists(id: number): Promise<void> {
    const exists = await this.productRepository.findOne({ where: { id } });
    if (!exists) {
      throw new BadRequestException(`Product ${id} không tồn tại`);
    }
  }

  private async ensureUniquePair(
    collectionId: number,
    productId: number,
    ignoreId?: number,
  ): Promise<void> {
    const existing = await this.collectionProductRepository.findOne({
      where: { collectionId, productId },
    });

    if (existing && existing.id !== ignoreId) {
      throw new ConflictException('Sản phẩm đã thuộc bộ sưu tập này');
    }
  }
}
