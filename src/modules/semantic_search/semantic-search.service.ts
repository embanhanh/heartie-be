import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { SemanticSearchQueryDto } from './dto/semantic-search-query.dto';
import { SemanticSearchResultDto, SemanticVariantSummary } from './dto/semantic-search-result.dto';
import { GeminiService } from '../gemini/gemini.service';
import { formatVectorLiteral } from 'src/common/transformers/vector.transformer';

export interface RankedProductRow {
  id: number;
  score: number;
}

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);
  private readonly embeddingRelations = [
    'brand',
    'category',
    'variants',
    'variants.attributeValues',
    'variants.attributeValues.attribute',
    'variants.attributeValues.attributeValue',
    'productAttributes',
    'productAttributes.attribute',
  ];

  constructor(
    private readonly geminiService: GeminiService,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
  ) {}

  async search(query: SemanticSearchQueryDto): Promise<SemanticSearchResultDto[]> {
    const trimmed = query.query?.trim();
    if (!trimmed) {
      return [];
    }

    this.logger.debug(
      `Semantic search invoked with query="${trimmed}" (limit=${query.limit ?? 10})`,
    );

    const limit = query.limit ?? 10;
    const embedding = await this.geminiService.embedText(trimmed);

    if (!embedding || !embedding.length) {
      this.logger.warn('Gemini returned empty embedding vector');
      return [];
    }

    const ranked = await this.rankProducts(embedding, limit);
    if (!ranked.length) {
      this.logger.debug('Semantic search ranking returned no products');
      return [];
    }

    const products = await this.productRepository.find({
      where: { id: In(ranked.map((row) => row.id)) },
      relations: this.embeddingRelations,
    });

    const productMap = new Map(products.map((product) => [product.id, product]));
    const scoreMap = new Map(ranked.map((row) => [row.id, row.score]));

    const results: SemanticSearchResultDto[] = [];

    for (const row of ranked) {
      const product = productMap.get(row.id);
      if (!product) {
        continue;
      }

      const variants: SemanticVariantSummary[] = (product.variants ?? []).map((variant) => ({
        id: variant.id,
        price: Number(variant.price ?? 0),
        status: variant.status,
        attributes: (variant.attributeValues ?? [])
          .map((value) => ({
            name: value.attribute?.name ?? '',
            value: value.attributeValue?.value ?? '',
          }))
          .filter((item) => item.name && item.value),
      }));

      const attributeNames = (product.productAttributes ?? [])
        .map((productAttribute) => productAttribute.attribute?.name ?? null)
        .filter((name): name is string => Boolean(name));

      results.push({
        id: product.id,
        name: product.name,
        description: product.description ?? null,
        image: product.image ?? null,
        brand: product.brand?.name ?? null,
        category: product.category?.name ?? null,
        score: scoreMap.get(product.id) ?? 0,
        variants,
        attributes: attributeNames,
      });
    }

    return results;
  }

  async reindexAllProducts(): Promise<{
    indexed: number;
    skipped: number;
    failures: Array<{ id: number; reason: string }>;
  }> {
    const [products, total] = await this.productRepository.findAndCount({
      relations: this.embeddingRelations,
    });

    let processed = 0;
    let skipped = 0;
    const failures: Array<{ id: number; reason: string }> = [];

    for (const product of products) {
      try {
        const status = await this.generateAndStoreEmbedding(product);
        if (status === 'indexed') {
          processed += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to embed product ${product.id}: ${reason}`);
        failures.push({ id: product.id, reason });
      }
    }

    this.logger.log(
      `Reindex products completed. Indexed=${processed}, skipped=${skipped}, failures=${failures.length}, total=${total}`,
    );

    return { indexed: processed, skipped, failures };
  }

  async refreshProductEmbedding(productId: number): Promise<'indexed' | 'skipped'> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: this.embeddingRelations,
    });

    if (!product) {
      this.logger.warn(`Product ${productId} not found when refreshing embedding`);
      return 'skipped';
    }

    return this.generateAndStoreEmbedding(product);
  }

  async findSimilarProductsByProduct(productId: number, limit = 20): Promise<RankedProductRow[]> {
    const clampedLimit = Math.max(1, Math.min(limit, 100));

    this.logger.debug(
      `Computing stylist similarity for product ${productId} (limit=${clampedLimit})`,
    );

    const product = await this.productRepository.findOne({
      where: { id: productId },
      select: { id: true, embedding: true },
    });

    if (!product) {
      this.logger.warn(`Product ${productId} not found when ranking stylist candidates`);
      return [];
    }

    let embedding = this.normalizeEmbeddingVector(product.embedding);

    if (!embedding?.length) {
      const refreshed = await this.refreshProductEmbedding(productId);
      if (refreshed === 'indexed') {
        const reloaded = await this.productRepository.findOne({
          where: { id: productId },
          select: { embedding: true },
        });
        embedding = this.normalizeEmbeddingVector(reloaded?.embedding ?? null);
        this.logger.debug(
          `Embedding refreshed for product ${productId}; vector ${embedding ? 'available' : 'still missing'}`,
        );
      }
    }

    if (!embedding || !embedding.length) {
      this.logger.warn(`Product ${productId} has no embedding vector available`);
      return [];
    }

    return this.rankProducts(embedding, clampedLimit, { excludeIds: [productId] });
  }

  private async rankProducts(
    embedding: number[],
    limit: number,
    options?: { excludeIds?: number[] },
  ): Promise<RankedProductRow[]> {
    this.logger.debug(
      `Ranking ${limit} product(s) using embedding vector length=${embedding.length} (excludeIds=${options?.excludeIds?.length ?? 0})`,
    );

    let literal: string;
    try {
      literal = formatVectorLiteral(embedding);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Skipping vector ranking due to invalid embedding: ${message}`);
      return [];
    }

    const vectorComponents = literal.slice(1, -1);
    const vectorSql = `ARRAY[${vectorComponents}]::vector`;
    this.logger.debug(
      `Vector literal prepared for ranking (length=${embedding.length}): ${vectorComponents.slice(0, 120)}${
        vectorComponents.length > 120 ? '…' : ''
      }`,
    );

    const qb = this.productRepository
      .createQueryBuilder('product')
      .select('product.id', 'id')
      .addSelect(`GREATEST(0, 1 - (product.embedding <=> ${vectorSql}))`, 'score')
      .where('product.embedding IS NOT NULL')
      .orderBy(`product.embedding <=> ${vectorSql}`, 'ASC')
      .limit(limit);

    if (options?.excludeIds?.length) {
      qb.andWhere('product.id NOT IN (:...excludeIds)', {
        excludeIds: options.excludeIds.map((value) => Number(value)),
      });
    }

    const rows = await qb.getRawMany<RankedProductRow>();

    this.logger.debug(
      `Vector ranking produced ${rows.length} row(s)${options?.excludeIds?.length ? ` (excluded ${options.excludeIds.length} id(s))` : ''}`,
    );

    return rows.map((row) => ({ id: Number(row.id), score: Number(row.score) }));
  }

  private normalizeEmbeddingVector(values?: number[] | null): number[] | null {
    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }

    const sanitized: number[] = [];

    for (let index = 0; index < values.length; index++) {
      const numeric = typeof values[index] === 'number' ? values[index] : Number(values[index]);

      if (!Number.isFinite(numeric)) {
        return null;
      }

      sanitized.push(numeric);
    }

    return sanitized;
  }

  private async generateAndStoreEmbedding(product: Product): Promise<'indexed' | 'skipped'> {
    const payload = this.buildEmbeddingPrompt(product);

    if (!payload) {
      await this.productRepository.update(product.id, { embedding: null });
      return 'skipped';
    }

    const vector = await this.geminiService.embedText(payload);

    console.log('vector:', vector);

    if (!vector?.length) {
      await this.persistEmbedding(product.id, null);
      this.logger.warn(`Gemini returned empty embedding for product ${product.id}`);
      return 'skipped';
    }

    await this.persistEmbedding(product.id, vector);
    this.logger.debug(`Product ${product.id} embedding vector generated and stored`);
    return 'indexed';
  }

  private async persistEmbedding(productId: number, embedding: number[] | null): Promise<void> {
    const entity = this.productRepository.create({ id: productId, embedding });
    await this.productRepository.save(entity);
  }

  private buildEmbeddingPrompt(product: Product): string | null {
    const parts: string[] = [];

    if (product.name) {
      parts.push(`Tên sản phẩm: ${product.name}`);
    }

    if (product.description) {
      parts.push(`Mô tả: ${product.description}`);
    }

    if (product.brand?.name) {
      parts.push(`Thương hiệu: ${product.brand.name}`);
    }

    if (product.category?.name) {
      parts.push(`Danh mục: ${product.category.name}`);
    }

    const attributes = (product.productAttributes ?? [])
      .map((productAttribute) => productAttribute.attribute?.name)
      .filter((name): name is string => Boolean(name));

    if (attributes.length) {
      parts.push(`Đặc điểm: ${attributes.join(', ')}`);
    }

    const variantSummaries = (product.variants ?? [])
      .map((variant) => {
        const variantAttributes = (variant.attributeValues ?? [])
          .map((value) => {
            const attributeName = value.attribute?.name;
            const attributeValue = value.attributeValue?.value;
            if (!attributeName || !attributeValue) {
              return null;
            }
            return `${attributeName}: ${attributeValue}`;
          })
          .filter((entry): entry is string => Boolean(entry));

        if (!variantAttributes.length) {
          return null;
        }

        return `Biến thể ${variant.id}: ${variantAttributes.join(', ')}`;
      })
      .filter((entry): entry is string => Boolean(entry));

    if (variantSummaries.length) {
      parts.push(...variantSummaries);
    }

    if (!parts.length) {
      return null;
    }

    return parts.join('\n');
  }
}
