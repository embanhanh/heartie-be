import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { Product, ProductStatus } from './entities/product.entity';
import { Category } from 'src/modules/categories/entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { Brand } from '../brands/entities/brand.entity';
import { PaginatedResult, SortParam } from 'src/common/dto/pagination.dto';
import { BaseService } from 'src/common/services/base.service';
import {
  ProductVariant,
  ProductVariantStatus,
} from '../product_variants/entities/product_variant.entity';
import { ProductVariantInventory } from '../inventory/entities/product-variant-inventory.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Attribute, AttributeType } from '../attributes/entities/attribute.entity';
import { AttributeValue } from '../attribute_values/entities/attribute-value.entity';
import { ProductAttribute } from '../product_attributes/entities/product-attribute.entity';
import { VariantAttributeValue } from '../variant_attribute_values/entities/variant-attribute-value.entity';
import { ProductFormPayloadDto } from './dto/product-form.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UploadedFile } from 'src/common/types/uploaded-file.type';
import { resolveModuleUploadPath } from 'src/common/utils/upload.util';

type VariantSummary = {
  id: number;
  price: number;
  status: ProductVariantStatus;
  image?: string | null;
};

type ProductListItem = Product & {
  priceList: number[];
  variants: VariantSummary[];
};

type AttributeValueSummary = Pick<AttributeValue, 'id' | 'value' | 'meta'>;
type ProductAttributeSummary = Pick<Attribute, 'id' | 'name' | 'type'> & {
  isRequired: boolean;
  values: AttributeValueSummary[];
};
type ProductDetail = Omit<Product, 'productAttributes'> & {
  attributes: ProductAttributeSummary[];
  images: string[];
};

@Injectable()
export class ProductsService extends BaseService<Product> {
  private readonly logger = new Logger(ProductsService.name);
  private similarityAvailable = true;
  constructor(
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Brand)
    private readonly brandRepo: Repository<Brand>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
  ) {
    super(productRepo, 'product');
  }

  async create(dto: CreateProductDto) {
    if (dto.categoryId) {
      const categoryExists = await this.categoryRepo.exist({ where: { id: dto.categoryId } });

      if (!categoryExists) {
        throw new BadRequestException(`Category not found: ${dto.categoryId}`);
      }
    }

    if (dto.brandId) {
      const brandExists = await this.brandRepo.exist({ where: { id: dto.brandId } });

      if (!brandExists) {
        throw new BadRequestException(`Brand not found: ${dto.brandId}`);
      }
    }

    const product = this.productRepo.create({
      ...dto,
      status: dto.status ?? ProductStatus.ACTIVE,
      stock: dto.stock ?? 0,
      originalPrice: this.resolveOriginalPrice(dto.originalPrice, undefined),
    });

    return this.productRepo.save(product);
  }

  async createFromForm(payload: ProductFormPayloadDto, files: UploadedFile[] = []) {
    this.logger.debug('createFromForm called');
    this.logger.debug(`payloadSummary: branchId=${payload.branchId}, name=${payload.name ?? ''}`);

    const explicitOriginalPrice = payload.originalPrice ?? null;
    const { branchId, attributes, variants, ...productPayload } = payload;
    const normalizedBrandId = this.normalizeOptionalId(productPayload.brandId);
    const normalizedCategoryId = this.normalizeOptionalId(productPayload.categoryId);

    if (normalizedCategoryId) {
      const categoryExists = await this.categoryRepo.exist({
        where: { id: normalizedCategoryId },
      });

      if (!categoryExists) {
        this.logger.warn(`Category not found: ${normalizedCategoryId}`);
        throw new BadRequestException(`Category not found: ${normalizedCategoryId}`);
      }
    }

    if (normalizedBrandId) {
      const brandExists = await this.brandRepo.exist({
        where: { id: normalizedBrandId },
      });

      if (!brandExists) {
        throw new BadRequestException(`Brand not found: ${normalizedBrandId}`);
      }
    }

    const branchExists = await this.branchRepo.exist({
      where: { id: branchId },
    });

    if (!branchExists) {
      this.logger.warn(`Branch not found: ${branchId}`);
      throw new BadRequestException(`Branch not found: ${branchId}`);
    }

    this.logger.debug(`Received ${files.length} uploaded file(s)`);
    const { productImage, variantImages } = this.extractFormFiles(files);
    this.logger.debug(
      `productImage=${productImage?.fieldname ?? 'none'}, variantImagesCount=${variantImages.size}`,
    );

    const resolvedOriginalPrice = this.resolveOriginalPrice(explicitOriginalPrice, variants);

    const productId = await this.productRepo.manager.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const attributeRepo = manager.getRepository(Attribute);
      const attributeValueRepo = manager.getRepository(AttributeValue);
      const productAttributeRepo = manager.getRepository(ProductAttribute);
      const variantRepo = manager.getRepository(ProductVariant);
      const variantAttributeRepo = manager.getRepository(VariantAttributeValue);
      const inventoryRepo = manager.getRepository(ProductVariantInventory);

      const productEntity = productRepo.create();
      productEntity.name = productPayload.name;
      productEntity.brandId = normalizedBrandId;
      productEntity.categoryId = normalizedCategoryId;
      productEntity.description = productPayload.description ?? undefined;
      const fallbackProductImage = this.sanitizeExistingAsset(productPayload.image);

      productEntity.image = productImage
        ? this.resolveStoredPath(productImage)
        : fallbackProductImage;
      productEntity.status = productPayload.status ?? ProductStatus.ACTIVE;
      productEntity.originalPrice = resolvedOriginalPrice;
      productEntity.stock = 0;

      const savedProduct = await productRepo.save(productEntity);

      const attributeById = new Map<number, Attribute>();
      const attributeByName = new Map<string, Attribute>();
      const attributeValueById = new Map<number, AttributeValue>();
      const attributeValueByAttrAndValue = new Map<string, AttributeValue>();
      const linkedProductAttributeIds = new Set<number>();

      for (const attributePayload of attributes) {
        let attributeEntity: Attribute | null = null;

        if (attributePayload.id) {
          attributeEntity = await attributeRepo.findOne({ where: { id: attributePayload.id } });
        }

        if (!attributeEntity) {
          attributeEntity = await attributeRepo.findOne({ where: { name: attributePayload.name } });
        }

        if (!attributeEntity) {
          attributeEntity = attributeRepo.create({
            name: attributePayload.name,
            type: attributePayload.type ?? AttributeType.COMMON,
          });
        } else if (attributePayload.type && attributeEntity.type !== attributePayload.type) {
          attributeEntity.type = attributePayload.type;
        }

        attributeEntity = await attributeRepo.save(attributeEntity);
        this.logger.debug(`Saved attribute: ${attributeEntity.name} (id=${attributeEntity.id})`);

        attributeById.set(attributeEntity.id, attributeEntity);
        attributeByName.set(attributeEntity.name.toLowerCase(), attributeEntity);

        if (!linkedProductAttributeIds.has(attributeEntity.id)) {
          const productAttribute = productAttributeRepo.create({
            productId: savedProduct.id,
            attributeId: attributeEntity.id,
            isRequired: true,
          });

          await productAttributeRepo.save(productAttribute);
          linkedProductAttributeIds.add(attributeEntity.id);
        }

        for (const valuePayload of attributePayload.values) {
          const normalizedValue = valuePayload.value.trim();
          let valueEntity: AttributeValue | null = null;

          if (valuePayload.id) {
            valueEntity = await attributeValueRepo.findOne({ where: { id: valuePayload.id } });
          }

          if (!valueEntity) {
            valueEntity = await attributeValueRepo.findOne({
              where: { attributeId: attributeEntity.id, value: normalizedValue },
            });
          }

          if (!valueEntity) {
            valueEntity = attributeValueRepo.create({
              attributeId: attributeEntity.id,
              value: normalizedValue,
              meta: valuePayload.meta ?? {},
            });
          } else if (valuePayload.meta) {
            valueEntity.meta = valuePayload.meta;
          }

          valueEntity = await attributeValueRepo.save(valueEntity);
          this.logger.debug(
            `Saved attribute value: ${valueEntity.value} (id=${valueEntity.id}) for attributeId=${valueEntity.attributeId}`,
          );

          attributeValueById.set(valueEntity.id, valueEntity);
          attributeValueByAttrAndValue.set(
            this.getAttributeValueKey(attributeEntity.id, valueEntity.value),
            valueEntity,
          );
        }
      }

      let totalStock = 0;

      for (const [index, variantPayload] of variants.entries()) {
        const variantImage = variantImages.get(index);

        const variantEntity = variantRepo.create();
        variantEntity.productId = savedProduct.id;
        variantEntity.price = variantPayload.price;
        variantEntity.weight = variantPayload.weight ?? undefined;
        variantEntity.status = variantPayload.status ?? ProductVariantStatus.ACTIVE;
        const fallbackVariantImage = this.sanitizeExistingAsset(variantPayload.image ?? undefined);

        variantEntity.image = variantImage
          ? this.resolveStoredPath(variantImage)
          : fallbackVariantImage;

        const savedVariant = await variantRepo.save(variantEntity);
        this.logger.debug(`Saved variant id=${savedVariant.id} for product id=${savedProduct.id}`);

        const variantStock = variantPayload.stock ?? 0;
        if (variantStock > 0) {
          const inventoryRecord = inventoryRepo.create({
            variantId: savedVariant.id,
            branchId,
            stock: variantStock,
          });

          await inventoryRepo.save(inventoryRecord);
          this.logger.debug(
            `Saved inventory for variant ${savedVariant.id}: stock=${variantStock} branchId=${branchId}`,
          );
        }

        totalStock += variantStock;

        for (const attributeRef of variantPayload.attributes) {
          const attributeEntity =
            (attributeRef.attributeId ? attributeById.get(attributeRef.attributeId) : undefined) ??
            (attributeRef.attributeName
              ? attributeByName.get(attributeRef.attributeName.toLowerCase())
              : undefined);

          if (!attributeEntity) {
            this.logger.warn(
              `Attribute not found for variant: ${attributeRef.attributeName ?? attributeRef.attributeId}`,
            );
            throw new BadRequestException(
              `Attribute not found for variant: ${attributeRef.attributeName ?? attributeRef.attributeId}`,
            );
          }

          const normalizedVariantValue = attributeRef.attributeValue.trim();
          let valueEntity = attributeRef.attributeValueId
            ? attributeValueById.get(attributeRef.attributeValueId)
            : undefined;

          if (!valueEntity) {
            valueEntity = attributeValueByAttrAndValue.get(
              this.getAttributeValueKey(attributeEntity.id, normalizedVariantValue),
            );
          }

          if (!valueEntity) {
            valueEntity = attributeValueRepo.create({
              attributeId: attributeEntity.id,
              value: normalizedVariantValue,
              meta: {},
            });

            valueEntity = await attributeValueRepo.save(valueEntity);
            this.logger.debug(
              `Created attribute value id=${valueEntity.id} for attributeId=${attributeEntity.id}`,
            );

            attributeValueById.set(valueEntity.id, valueEntity);
            attributeValueByAttrAndValue.set(
              this.getAttributeValueKey(attributeEntity.id, valueEntity.value),
              valueEntity,
            );
          }

          const variantAttribute = variantAttributeRepo.create({
            variantId: savedVariant.id,
            attributeId: attributeEntity.id,
            attributeValueId: valueEntity.id,
          });

          await variantAttributeRepo.save(variantAttribute);
          this.logger.debug(
            `Linked variant ${savedVariant.id} -> attribute ${attributeEntity.id} = value ${valueEntity.id}`,
          );
        }
      }

      if (totalStock !== savedProduct.stock) {
        savedProduct.stock = totalStock;
        await productRepo.save(savedProduct);
      }

      this.logger.log(`Product created: id=${savedProduct.id}, totalStock=${totalStock}`);
      return savedProduct.id;
    });

    return this.findOne(productId);
  }

  async findAll(options: ProductQueryDto): Promise<PaginatedResult<ProductListItem>> {
    const searchTerm = options.search?.trim() ?? '';
    const shouldApplySearch = Boolean(searchTerm);
    if (shouldApplySearch && !this.similarityAvailable) {
      await this.ensureSimilaritySupport();
    }

    const useSimilarity = shouldApplySearch && this.similarityAvailable;

    try {
      const result = await this.paginate(options, (qb) => {
        qb.leftJoinAndSelect('product.brand', 'brand');
        qb.leftJoinAndSelect('product.category', 'category');

        if (options.categoryIds?.length) {
          qb.andWhere('product.categoryId IN (:...categoryIds)', {
            categoryIds: options.categoryIds,
          });
        }

        // Price range filter via variants
        if (typeof options.priceMin === 'number') {
          qb.andWhere(
            `EXISTS (
              SELECT 1 FROM product_variants vmin
              WHERE vmin."productId" = product.id
                AND vmin.price >= :priceMin
            )`,
            { priceMin: options.priceMin },
          );
        }

        if (typeof options.priceMax === 'number') {
          qb.andWhere(
            `EXISTS (
              SELECT 1 FROM product_variants vmax
              WHERE vmax."productId" = product.id
                AND vmax.price <= :priceMax
            )`,
            { priceMax: options.priceMax },
          );
        }

        // Colors filter: match any variant attribute value against provided colors
        if (options.colors?.length) {
          const colorAttrNames = ['color', 'mau', 'màu', 'mau sac', 'màu sắc', 'colorway'];

          qb.andWhere(
            `EXISTS (
              SELECT 1
              FROM product_variants v
              JOIN variant_attribute_values vav ON vav."variantId" = v.id
              JOIN attributes a ON a.id = vav."attributeId"
              JOIN attribute_values av ON av.id = vav."attributeValueId"
              WHERE v."productId" = product.id
                AND (
                  LOWER(av.value) IN (:...colors)
                  OR LOWER(a.name) IN (:...colorAttrNames) AND LOWER(av.value) IN (:...colors)
                )
            )`,
            {
              colors: options.colors.map((c) => c.toLowerCase()),
              colorAttrNames,
            },
          );
        }

        // Sizes filter: match any variant attribute value against provided sizes
        if (options.sizes?.length) {
          const sizeAttrNames = ['size', 'kich thuoc', 'kích thước', 'kich co', 'kích cỡ'];

          qb.andWhere(
            `EXISTS (
              SELECT 1
              FROM product_variants v
              JOIN variant_attribute_values vav ON vav."variantId" = v.id
              JOIN attributes a ON a.id = vav."attributeId"
              JOIN attribute_values av ON av.id = vav."attributeValueId"
              WHERE v."productId" = product.id
                AND (
                  LOWER(av.value) IN (:...sizes)
                  OR LOWER(a.name) IN (:...sizeAttrNames) AND LOWER(av.value) IN (:...sizes)
                )
            )`,
            {
              sizes: options.sizes.map((s) => s.toLowerCase()),
              sizeAttrNames,
            },
          );
        }

        if (shouldApplySearch) {
          this.applySearch(qb, searchTerm, useSimilarity);
        }
      });
      const data = await this.attachSummary(result.data);

      return { ...result, data };
    } catch (error) {
      if (useSimilarity && this.isMissingSimilarityError(error)) {
        if (this.similarityAvailable) {
          this.logger.warn(
            'pg_trgm similarity function is unavailable; falling back to LIKE-based search',
          );
        }

        this.similarityAvailable = false;
        return this.findAll(options);
      }

      throw error;
    }
  }

  private async ensureSimilaritySupport(): Promise<void> {
    try {
      await this.productRepo.query(`SELECT similarity('probe', 'probe') AS ok`);
      this.similarityAvailable = true;
    } catch (error) {
      if (this.isMissingSimilarityError(error)) {
        this.similarityAvailable = false;
      } else {
        this.logger.warn(`Failed to probe pg_trgm similarity support: ${String(error)}`);
      }
    }
  }

  async findOne(id: number): Promise<ProductDetail | null> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: {
        brand: true,
        category: true,
        productAttributes: { attribute: true },
        variants: {
          attributeValues: { attribute: true, attributeValue: true },
          inventories: { branch: true },
        },
        ratings: true,
      },
    });

    if (!product) {
      return null;
    }

    const { productAttributes = [], ...rest } = product;

    const attributeValueMap = new Map<number, Map<number, AttributeValueSummary>>();
    for (const variant of rest.variants ?? []) {
      for (const variantAttribute of variant.attributeValues ?? []) {
        const attributeEntity = variantAttribute.attribute as Attribute | undefined;
        const attributeValueEntity = variantAttribute.attributeValue as AttributeValue | undefined;

        if (!attributeEntity || !attributeValueEntity) {
          continue;
        }

        let valueMap = attributeValueMap.get(attributeEntity.id);
        if (!valueMap) {
          valueMap = new Map<number, AttributeValueSummary>();
          attributeValueMap.set(attributeEntity.id, valueMap);
        }

        if (!valueMap.has(attributeValueEntity.id)) {
          valueMap.set(attributeValueEntity.id, {
            id: attributeValueEntity.id,
            value: attributeValueEntity.value,
            meta:
              attributeValueEntity.meta && typeof attributeValueEntity.meta === 'object'
                ? attributeValueEntity.meta
                : {},
          });
        }
      }
    }

    const attributes = productAttributes
      .filter((item): item is ProductAttribute & { attribute: Attribute } =>
        Boolean(item.attribute),
      )
      .map<ProductAttributeSummary>((item) => {
        const attribute = item.attribute;
        const valueMap = attributeValueMap.get(attribute.id);
        const values = valueMap ? Array.from(valueMap.values()) : [];

        return {
          id: attribute.id,
          name: attribute.name,
          type: attribute.type,
          isRequired: item.isRequired,
          values,
        };
      });

    const normalizedVariants = (rest.variants ?? []).map((variant) => ({
      ...variant,
      price: this.asNumber(variant.price),
      weight: this.asNullableNumber(variant.weight) ?? undefined,
      image: variant.image ?? undefined,
      inventories: (variant.inventories ?? []).map((inventory) => ({
        ...inventory,
        stock: this.asNumber(inventory.stock),
      })),
    }));

    const images: string[] = [];
    const imageSet = new Set<string>();
    const pushImage = (candidate?: string | null) => {
      if (!candidate) {
        return;
      }

      const trimmed = candidate.trim();
      if (!trimmed || imageSet.has(trimmed)) {
        return;
      }

      imageSet.add(trimmed);
      images.push(trimmed);
    };

    pushImage(rest.image ?? undefined);
    for (const variant of normalizedVariants) {
      pushImage(variant.image ?? undefined);
    }

    return {
      ...(rest as Omit<Product, 'productAttributes'>),
      image: rest.image ?? undefined,
      originalPrice: this.asNumber(rest.originalPrice),
      variants: normalizedVariants,
      attributes,
      images,
    };
  }

  async updateFromForm(id: number, payload: ProductFormPayloadDto, files: UploadedFile[] = []) {
    this.logger.debug(`updateFromForm called for product id=${id}`);

    const { id: payloadId, ...payloadWithoutId } = payload;

    if (payloadId && payloadId !== id) {
      throw new BadRequestException(`Payload id (${payloadId}) does not match param id (${id})`);
    }

    const explicitOriginalPrice = payloadWithoutId.originalPrice ?? null;
    const { branchId, attributes, variants, ...productPayload } = payloadWithoutId;
    const normalizedBrandId = this.normalizeOptionalId(productPayload.brandId);
    const normalizedCategoryId = this.normalizeOptionalId(productPayload.categoryId);

    if (normalizedCategoryId) {
      const categoryExists = await this.categoryRepo.exist({
        where: { id: normalizedCategoryId },
      });

      if (!categoryExists) {
        this.logger.warn(`Category not found for update: ${normalizedCategoryId}`);
        throw new BadRequestException(`Category not found: ${normalizedCategoryId}`);
      }
    }

    if (normalizedBrandId) {
      const brandExists = await this.brandRepo.exist({
        where: { id: normalizedBrandId },
      });

      if (!brandExists) {
        throw new BadRequestException(`Brand not found: ${normalizedBrandId}`);
      }
    }

    const branchExists = await this.branchRepo.exist({
      where: { id: branchId },
    });

    if (!branchExists) {
      this.logger.warn(`Branch not found for update: ${branchId}`);
      throw new BadRequestException(`Branch not found: ${branchId}`);
    }

    this.logger.debug(`Received ${files.length} uploaded file(s) for update`);
    const { productImage, variantImages } = this.extractFormFiles(files);
    this.logger.debug(
      `updateFromForm images summary -> productImage=${productImage?.fieldname ?? 'none'}, variantImagesCount=${variantImages.size}`,
    );

    await this.productRepo.manager.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const attributeRepo = manager.getRepository(Attribute);
      const attributeValueRepo = manager.getRepository(AttributeValue);
      const productAttributeRepo = manager.getRepository(ProductAttribute);
      const variantRepo = manager.getRepository(ProductVariant);
      const variantAttributeRepo = manager.getRepository(VariantAttributeValue);
      const inventoryRepo = manager.getRepository(ProductVariantInventory);

      const productEntity = await productRepo.findOne({ where: { id } });

      if (!productEntity) {
        throw new NotFoundException(`Product not found: ${id}`);
      }

      productEntity.name = productPayload.name;
      productEntity.brandId = normalizedBrandId;
      productEntity.categoryId = normalizedCategoryId;

      if (Object.prototype.hasOwnProperty.call(productPayload, 'description')) {
        productEntity.description = productPayload.description ?? undefined;
      }

      if (productImage) {
        productEntity.image = this.resolveStoredPath(productImage);
      } else if (Object.prototype.hasOwnProperty.call(productPayload, 'image')) {
        productEntity.image = this.sanitizeExistingAsset(productPayload.image ?? undefined);
      }

      productEntity.status = productPayload.status ?? productEntity.status ?? ProductStatus.ACTIVE;
      productEntity.originalPrice = this.resolveOriginalPrice(
        explicitOriginalPrice,
        variants,
        productEntity.originalPrice,
      );
      productEntity.stock = 0;

      const savedProduct = await productRepo.save(productEntity);

      const existingVariants = await variantRepo.find({ where: { productId: savedProduct.id } });
      const existingVariantIds = existingVariants.map((variant) => variant.id);

      if (existingVariantIds.length) {
        await variantAttributeRepo.delete({ variantId: In(existingVariantIds) });
        await inventoryRepo.delete({ variantId: In(existingVariantIds) });
      }

      await variantRepo.delete({ productId: savedProduct.id });
      await productAttributeRepo.delete({ productId: savedProduct.id });

      const attributeById = new Map<number, Attribute>();
      const attributeByName = new Map<string, Attribute>();
      const attributeValueById = new Map<number, AttributeValue>();
      const attributeValueByAttrAndValue = new Map<string, AttributeValue>();
      const linkedProductAttributeIds = new Set<number>();

      for (const attributePayload of attributes) {
        let attributeEntity: Attribute | null = null;

        if (attributePayload.id) {
          attributeEntity = await attributeRepo.findOne({ where: { id: attributePayload.id } });
        }

        if (!attributeEntity) {
          attributeEntity = await attributeRepo.findOne({ where: { name: attributePayload.name } });
        }

        if (!attributeEntity) {
          attributeEntity = attributeRepo.create({
            name: attributePayload.name,
            type: attributePayload.type ?? AttributeType.COMMON,
          });
        } else if (attributePayload.type && attributeEntity.type !== attributePayload.type) {
          attributeEntity.type = attributePayload.type;
        }

        attributeEntity = await attributeRepo.save(attributeEntity);
        this.logger.debug(
          `Update saved attribute: ${attributeEntity.name} (id=${attributeEntity.id})`,
        );

        attributeById.set(attributeEntity.id, attributeEntity);
        attributeByName.set(attributeEntity.name.toLowerCase(), attributeEntity);

        if (!linkedProductAttributeIds.has(attributeEntity.id)) {
          const productAttribute = productAttributeRepo.create({
            productId: savedProduct.id,
            attributeId: attributeEntity.id,
            isRequired: true,
          });

          await productAttributeRepo.save(productAttribute);
          linkedProductAttributeIds.add(attributeEntity.id);
        }

        for (const valuePayload of attributePayload.values) {
          const normalizedValue = valuePayload.value.trim();
          let valueEntity: AttributeValue | null = null;

          if (valuePayload.id) {
            valueEntity = await attributeValueRepo.findOne({ where: { id: valuePayload.id } });
          }

          if (!valueEntity) {
            valueEntity = await attributeValueRepo.findOne({
              where: { attributeId: attributeEntity.id, value: normalizedValue },
            });
          }

          if (!valueEntity) {
            valueEntity = attributeValueRepo.create({
              attributeId: attributeEntity.id,
              value: normalizedValue,
              meta: valuePayload.meta ?? {},
            });
          } else if (valuePayload.meta) {
            valueEntity.meta = valuePayload.meta;
          }

          valueEntity = await attributeValueRepo.save(valueEntity);
          this.logger.debug(
            `Update saved attribute value: ${valueEntity.value} (id=${valueEntity.id}) for attributeId=${valueEntity.attributeId}`,
          );

          attributeValueById.set(valueEntity.id, valueEntity);
          attributeValueByAttrAndValue.set(
            this.getAttributeValueKey(attributeEntity.id, valueEntity.value),
            valueEntity,
          );
        }
      }

      let totalStock = 0;

      for (const [index, variantPayload] of variants.entries()) {
        const variantImage = variantImages.get(index);

        const variantEntity = variantRepo.create();
        variantEntity.productId = savedProduct.id;
        variantEntity.price = variantPayload.price;
        variantEntity.weight = variantPayload.weight ?? undefined;
        variantEntity.status = variantPayload.status ?? ProductVariantStatus.ACTIVE;
        variantEntity.image = variantImage
          ? this.resolveStoredPath(variantImage)
          : this.sanitizeExistingAsset(variantPayload.image ?? undefined);

        const savedVariant = await variantRepo.save(variantEntity);
        this.logger.debug(
          `Update saved variant id=${savedVariant.id} for product id=${savedProduct.id}`,
        );

        const variantStock = variantPayload.stock ?? 0;
        if (variantStock > 0) {
          const inventoryRecord = inventoryRepo.create({
            variantId: savedVariant.id,
            branchId,
            stock: variantStock,
          });

          await inventoryRepo.save(inventoryRecord);
          this.logger.debug(
            `Update saved inventory for variant ${savedVariant.id}: stock=${variantStock} branchId=${branchId}`,
          );
        }

        totalStock += variantStock;

        for (const attributeRef of variantPayload.attributes) {
          const attributeEntity =
            (attributeRef.attributeId ? attributeById.get(attributeRef.attributeId) : undefined) ??
            (attributeRef.attributeName
              ? attributeByName.get(attributeRef.attributeName.toLowerCase())
              : undefined);

          if (!attributeEntity) {
            this.logger.warn(
              `Attribute not found for variant during update: ${
                attributeRef.attributeName ?? attributeRef.attributeId
              }`,
            );
            throw new BadRequestException(
              `Attribute not found for variant: ${
                attributeRef.attributeName ?? attributeRef.attributeId
              }`,
            );
          }

          const normalizedVariantValue = attributeRef.attributeValue.trim();
          let valueEntity = attributeRef.attributeValueId
            ? attributeValueById.get(attributeRef.attributeValueId)
            : undefined;

          if (!valueEntity) {
            valueEntity = attributeValueByAttrAndValue.get(
              this.getAttributeValueKey(attributeEntity.id, normalizedVariantValue),
            );
          }

          if (!valueEntity) {
            valueEntity = attributeValueRepo.create({
              attributeId: attributeEntity.id,
              value: normalizedVariantValue,
              meta: {},
            });

            valueEntity = await attributeValueRepo.save(valueEntity);
            this.logger.debug(
              `Update created attribute value id=${valueEntity.id} for attributeId=${attributeEntity.id}`,
            );

            attributeValueById.set(valueEntity.id, valueEntity);
            attributeValueByAttrAndValue.set(
              this.getAttributeValueKey(attributeEntity.id, valueEntity.value),
              valueEntity,
            );
          }

          const variantAttribute = variantAttributeRepo.create({
            variantId: savedVariant.id,
            attributeId: attributeEntity.id,
            attributeValueId: valueEntity.id,
          });

          await variantAttributeRepo.save(variantAttribute);
          this.logger.debug(
            `Update linked variant ${savedVariant.id} -> attribute ${attributeEntity.id} = value ${valueEntity.id}`,
          );
        }
      }

      if (totalStock !== savedProduct.stock) {
        savedProduct.stock = totalStock;
        await productRepo.save(savedProduct);
      }

      this.logger.log(`Product updated: id=${savedProduct.id}, totalStock=${totalStock}`);
    });

    return this.findOne(id);
  }

  async suggestKeywords(keyword: string, limit = 10): Promise<string[]> {
    const normalized = keyword.trim();

    if (!normalized.length) {
      return [];
    }

    if (!this.similarityAvailable) {
      await this.ensureSimilaritySupport();
    }

    const useSimilarity = this.similarityAvailable;

    const prefixPattern = `${normalized}%`;
    const anywherePattern = `%${normalized}%`;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const searchTerm = normalized.toLowerCase();
    const minScore = this.computeSuggestionMinScore(tokens.length || 1);

    const rankExpression = `CASE
          WHEN product.name ILIKE :prefix THEN 0
          WHEN product.name ILIKE :anywhere THEN 1
          WHEN category.name ILIKE :prefix THEN 2
          WHEN category.name ILIKE :anywhere THEN 3
          ELSE 4
        END`;

    const qb = this.productRepo
      .createQueryBuilder('product')
      .select('product.name', 'keyword')
      .addSelect(rankExpression, 'rank_bucket')
      .addSelect('product.createdAt', 'createdAt')
      .addSelect('category.name', 'categoryName')
      .leftJoin('product.category', 'category')
      .where('product.status = :activeStatus', { activeStatus: ProductStatus.ACTIVE })
      .andWhere(
        new Brackets((inner) => {
          inner.where('product.name ILIKE :anywhere').orWhere('category.name ILIKE :anywhere');

          if (useSimilarity) {
            inner
              .orWhere('similarity(lower(product.name), :searchTerm) >= :minScore')
              .orWhere("similarity(lower(COALESCE(category.name, '')), :searchTerm) >= :minScore");
          }
        }),
      )
      .distinct(true)
      .orderBy('rank_bucket', 'ASC');

    if (useSimilarity) {
      qb.addSelect('similarity(lower(product.name), :searchTerm)', 'name_score');
      qb.addSelect("similarity(lower(COALESCE(category.name, '')), :searchTerm)", 'category_score');
      qb.addOrderBy('name_score', 'DESC');
    }

    qb.addOrderBy('product.createdAt', 'DESC');
    qb.take(Math.max(limit * 2, limit + 5));
    qb.setParameters({ prefix: prefixPattern, anywhere: anywherePattern });

    if (useSimilarity) {
      qb.setParameter('searchTerm', searchTerm);
      qb.setParameter('minScore', minScore);
    }

    const productRows = await qb.getRawMany<{ keyword: string | null }>();

    const keywords = new Set<string>();

    for (const row of productRows) {
      const value = row.keyword?.trim();

      if (value) {
        keywords.add(value);
      }

      if (keywords.size >= limit) {
        break;
      }
    }

    if (keywords.size < limit) {
      const categoryQb = this.categoryRepo
        .createQueryBuilder('category')
        .select('category.name', 'keyword')
        .addSelect('category.createdAt', 'createdAt')
        .where('category.name ILIKE :anywhere', { anywhere: anywherePattern })
        .orderBy(`CASE WHEN category.name ILIKE :prefix THEN 0 ELSE 1 END`, 'ASC')
        .addOrderBy('category.createdAt', 'DESC')
        .setParameters({ prefix: prefixPattern })
        .take(limit);

      if (useSimilarity) {
        categoryQb
          .addSelect('similarity(lower(category.name), :searchTerm)', 'name_score')
          .andWhere('similarity(lower(category.name), :searchTerm) >= :minScore')
          .addOrderBy('name_score', 'DESC');
        categoryQb.setParameter('searchTerm', searchTerm);
        categoryQb.setParameter('minScore', minScore);
      }

      const categoryRows = await categoryQb.getRawMany<{ keyword: string | null }>();

      for (const row of categoryRows) {
        const value = row.keyword?.trim();

        if (value) {
          keywords.add(value);
        }

        if (keywords.size >= limit) {
          break;
        }
      }
    }

    return Array.from(keywords).slice(0, limit);
  }

  remove(id: number) {
    return this.productRepo.delete(id);
  }

  private extractFormFiles(files: UploadedFile[]) {
    this.logger.debug(`extractFormFiles called with ${files?.length ?? 0} file(s)`);
    let productImage: UploadedFile | undefined;
    const variantImages = new Map<number, UploadedFile>();

    for (const file of files) {
      if (!file) {
        this.logger.warn('Encountered undefined file entry in uploaded files, skipping');
        continue;
      }

      if (file.fieldname === 'productImage') {
        productImage = file;
        this.logger.debug(`Found productImage file: ${file.originalname}`);
        continue;
      }

      const match = file.fieldname.match(/^variants\[(\d+)\]\.image$/);

      if (match) {
        variantImages.set(Number(match[1]), file);
        this.logger.debug(`Found variant image for index ${match[1]}: ${file.originalname}`);
      }
    }

    return { productImage, variantImages };
  }

  private resolveStoredPath(file: UploadedFile): string {
    this.logger.debug(`resolveStoredPath called for file: ${file.originalname}`);
    const storedPath = resolveModuleUploadPath('products', file);

    if (!storedPath) {
      this.logger.warn(
        `Could not determine stored path for ${file.originalname}; falling back to original name`,
      );
      return file.originalname;
    }

    this.logger.debug(`Resolved stored path for ${file.originalname}: ${storedPath}`);
    return storedPath;
  }

  private sanitizeExistingAsset(value?: string | null): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    return trimmed.replace(/^upload\//, 'uploads/');
  }

  private asNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return fallback;
  }

  private asNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = this.asNumber(value, Number.NaN);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private getAttributeValueKey(attributeId: number, value: string): string {
    return `${attributeId}::${value.trim().toLowerCase()}`;
  }

  private normalizeOptionalId(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    return Math.trunc(value);
  }

  private resolveOriginalPrice(
    explicitValue: unknown,
    variants: Array<{ price: unknown }> | undefined,
    fallback?: unknown,
  ): number {
    const explicit = this.asNumber(explicitValue, Number.NaN);
    if (Number.isFinite(explicit)) {
      return explicit;
    }

    const variantPrices = (variants ?? [])
      .map((variant) => this.asNumber(variant.price, Number.NaN))
      .filter((price): price is number => Number.isFinite(price));

    if (variantPrices.length) {
      return Math.min(...variantPrices);
    }

    const fallbackValue = this.asNumber(fallback, Number.NaN);
    if (Number.isFinite(fallbackValue)) {
      return fallbackValue;
    }

    return 0;
  }

  protected override getDefaultSorts(): SortParam[] {
    return [{ field: 'createdAt', direction: 'desc' }];
  }

  private async attachSummary(products: Product[]): Promise<ProductListItem[]> {
    if (!products.length) {
      return [];
    }

    const productIds = products.map((product) => product.id);

    const variantRepo = this.productRepo.manager.getRepository(ProductVariant);

    const priceRows = await variantRepo
      .createQueryBuilder('variant')
      .select('variant.productId', 'productId')
      .addSelect('json_agg(variant.price)', 'prices')
      .where('variant.productId IN (:...ids)', { ids: productIds })
      .groupBy('variant.productId')
      .getRawMany<{ productId: number; prices: string | null }>();

    const priceMap = new Map<number, number[]>();
    for (const row of priceRows) {
      const pricesRawValue = this.normalizeAggregateArray(row.prices);
      const prices = pricesRawValue
        .map((price) => this.asNumber(price, Number.NaN))
        .filter((price) => Number.isFinite(price))
        .sort((a, b) => a - b);
      priceMap.set(Number(row.productId), prices);
    }

    const variantRepoEntries = await variantRepo.find({
      where: { productId: In(productIds) },
      select: {
        id: true,
        productId: true,
        price: true,
        status: true,
        image: true,
      },
      order: { productId: 'ASC', id: 'ASC' },
    });

    const variantMap = new Map<number, VariantSummary[]>();
    for (const variant of variantRepoEntries) {
      const list = variantMap.get(variant.productId) ?? [];
      list.push({
        id: variant.id,
        price: this.asNumber(variant.price),
        status: variant.status,
        image: variant.image ?? null,
      });
      variantMap.set(variant.productId, list);
    }

    return products.map((product) => ({
      ...product,
      image: product.image ?? undefined,
      originalPrice: this.asNumber(product.originalPrice),
      priceList: priceMap.get(product.id) ?? [],
      variants: variantMap.get(product.id) ?? [],
    })) as ProductListItem[];
  }

  private applySearch(
    qb: SelectQueryBuilder<Product>,
    rawSearch: string,
    useSimilarity: boolean,
  ): void {
    const normalizedSearch = rawSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return;
    }

    const tokens = normalizedSearch.split(/\s+/).filter(Boolean);

    if (!tokens.length) {
      return;
    }

    qb.distinct(true);

    const likePattern = `%${tokens.join('%')}%`;
    const parameters: Record<string, unknown> = { likePattern };

    if (useSimilarity) {
      const minScore = Math.max(0.1, Math.min(0.3, 0.35 - tokens.length * 0.05));

      qb.addSelect(
        `GREATEST(
        similarity(lower(product.name), :searchTerm),
        similarity(lower(COALESCE(product.description, '')), :searchTerm),
        similarity(lower(COALESCE(brand.name, '')), :searchTerm),
        similarity(lower(COALESCE(category.name, '')), :searchTerm)
      )`,
        'product_search_score',
      );

      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where('LOWER(product.name) LIKE :likePattern')
            .orWhere("LOWER(COALESCE(product.description, '')) LIKE :likePattern")
            .orWhere("LOWER(COALESCE(brand.name, '')) LIKE :likePattern")
            .orWhere("LOWER(COALESCE(category.name, '')) LIKE :likePattern")
            .orWhere('similarity(lower(product.name), :searchTerm) >= :minScore')
            .orWhere("similarity(lower(COALESCE(brand.name, '')), :searchTerm) >= :minScore")
            .orWhere("similarity(lower(COALESCE(category.name, '')), :searchTerm) >= :minScore");
        }),
      );

      parameters.searchTerm = normalizedSearch;
      parameters.minScore = minScore;

      qb.orderBy('product_search_score', 'DESC');
      qb.addOrderBy('product.createdAt', 'DESC');
    } else {
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where('LOWER(product.name) LIKE :likePattern')
            .orWhere("LOWER(COALESCE(product.description, '')) LIKE :likePattern")
            .orWhere("LOWER(COALESCE(brand.name, '')) LIKE :likePattern")
            .orWhere("LOWER(COALESCE(category.name, '')) LIKE :likePattern");
        }),
      );

      qb.orderBy('product.createdAt', 'DESC');
    }

    qb.setParameters(parameters);
  }

  private isMissingSimilarityError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string } | undefined;
    return driverError?.code === '42883';
  }

  private normalizeAggregateArray(value: unknown): Array<number | string> {
    if (value === null || value === undefined) {
      return [];
    }

    if (Array.isArray(value)) {
      return value as Array<number | string>;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;

        if (Array.isArray(parsed)) {
          return parsed as Array<number | string>;
        }

        return parsed === null || parsed === undefined ? [] : [parsed as number | string];
      } catch {
        return value.length ? [value] : [];
      }
    }

    return [value as number | string];
  }

  private computeSuggestionMinScore(tokenCount: number): number {
    return Math.max(0.1, Math.min(0.35, 0.45 - tokenCount * 0.05));
  }
}
