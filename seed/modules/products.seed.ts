import { NestFactory } from '@nestjs/core';
import { DataSource, EntityManager } from 'typeorm';
import { Product, ProductStatus } from '../../src/modules/products/entities/product.entity';
import {
  ProductVariant,
  ProductVariantStatus,
} from '../../src/modules/product_variants/entities/product_variant.entity';
import { ProductVariantInventory } from '../../src/modules/inventory/entities/product-variant-inventory.entity';
import { VariantAttributeValue } from '../../src/modules/variant_attribute_values/entities/variant-attribute-value.entity';
import { ProductAttribute } from '../../src/modules/product_attributes/entities/product-attribute.entity';
import { Attribute, AttributeType } from '../../src/modules/attributes/entities/attribute.entity';
import { AttributeValue } from '../../src/modules/attribute_values/entities/attribute-value.entity';
import { Branch } from '../../src/modules/branches/entities/branch.entity';
import { Brand } from '../../src/modules/brands/entities/brand.entity';
import { Category } from '../../src/modules/categories/entities/category.entity';
import { AppModule } from '../../src/app.module';
import { SemanticSearchService } from '../../src/modules/semantic_search/semantic-search.service';

const TARGET_PRODUCT_COUNT = 100;

const collectionNames = [
  'Urban Luxe',
  'Heritage Line',
  'City Explorer',
  'Midnight Glow',
  'Weekend Escape',
  'Cozy Studio',
  'Premium Tailor',
  'Street Legend',
  'Everyday Essential',
  'Modern Muse',
  'Sunset Wander',
  'Ocean Breeze',
  'Mountain Peak',
  'Velvet Dream',
  'Aurora Chic',
  'Nomad Spirit',
  'Lunar Voyage',
  'Floral Whisper',
  'Silk Route',
  'Amber Horizon',
];

const styleDescriptors = [
  'Tối Giản',
  'Thanh Lịch',
  'Năng Động',
  'Cá Tính',
  'Cao Cấp',
  'Vintage',
  'Boho',
  'Outdoor',
  'Athleisure',
  'Công Sở',
  'Đương Đại',
  'Tinh Tế',
  'Phóng Khoáng',
  'Trẻ Trung',
  'Bản Lĩnh',
];

const productKinds = [
  'Áo sơ mi',
  'Áo phông',
  'Áo khoác',
  'Áo len',
  'Áo blazer',
  'Áo hoodie',
  'Áo polo',
  'Quần jeans',
  'Quần tây',
  'Quần short',
  'Váy midi',
  'Đầm maxi',
  'Set thể thao',
  'Giày sneaker',
  'Giày boots',
  'Túi xách',
  'Áo cardigan',
  'Áo gió',
  'Jumpsuit',
  'Áo khoác da',
];

const materials = [
  'cotton hữu cơ',
  'linen tự nhiên',
  'lụa mềm mại',
  'denim co giãn',
  'nỉ cao cấp',
  'len merino',
  'cashmere',
  'polyester tái chế',
  'da thuộc mềm',
  'viscose thoáng mát',
];

const colors = [
  'đen tuyền',
  'beige cổ điển',
  'trắng ngọc trai',
  'xanh navy',
  'nâu caramel',
  'xám tro',
  'xanh olive',
  'đỏ burgundy',
  'xanh pastel',
  'vàng đồng',
];

const colorHexTable: Record<string, string> = {
  'đen tuyền': '#0a0a0a',
  'beige cổ điển': '#f5f5dc',
  'trắng ngọc trai': '#f8f8ff',
  'xanh navy': '#001f3f',
  'nâu caramel': '#af6f40',
  'xám tro': '#7d7d7d',
  'xanh olive': '#556b2f',
  'đỏ burgundy': '#800020',
  'xanh pastel': '#77b5fe',
  'vàng đồng': '#b8860b',
};

const occasions = [
  'đi làm',
  'dạo phố',
  'dự tiệc nhẹ',
  'du lịch cuối tuần',
  'gặp gỡ bạn bè',
  'tập luyện thể thao nhẹ nhàng',
  'buổi hẹn hò',
  'sự kiện doanh nghiệp',
  'chụp ảnh lookbook',
  'ngày thường năng động',
];

const keyFeatures = [
  'phom dáng chuẩn',
  'đường may tỉ mỉ',
  'thiết kế giới hạn',
  'chi tiết phối màu thông minh',
  'công nghệ khử mùi',
  'khả năng giữ nhiệt tốt',
  'chống nhăn hiệu quả',
  'công nghệ làm mát nhanh',
  'chống tia UV',
  'độ bền cao',
];

const imagePool = [
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1520962944511-6c703d0770cc?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1521335629791-ce4aec67dd47?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1521572163475-25631b6be0f7?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1490480128137-45f33fec2e1d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1521572275903-6fdc9c1d5c8b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1490481652000-33d87c53ead4?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1487412947146-3628bddd6703?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1475180098004-ca77a66827be?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1525171254930-643fc658b64e?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80',
];

const sizeOptions = ['XS', 'S', 'M', 'L', 'XL'];

const titleize = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const normalizeSize = (value: string): string => value.trim().toUpperCase();

const normalizeAttributeKey = (value: string): string => value.trim().toLowerCase();

const computeDeterministicHex = (input: string): string => {
  if (!input) {
    return '#000000';
  }

  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index);
    hash |= 0;
  }

  const hex = ((hash >>> 0) & 0xffffff).toString(16).padStart(6, '0');
  return `#${hex}`;
};

const resolveColorHex = (value: string): string => {
  const key = normalizeAttributeKey(value);
  return colorHexTable[key] ?? computeDeterministicHex(key);
};

const distributeStock = (totalStock: number, count: number, randomSeed: number): number[] => {
  if (count <= 1) {
    return [Math.max(totalStock, 1)];
  }

  const result: number[] = [];
  let remaining = totalStock;

  for (let index = 0; index < count; index += 1) {
    const slotsLeft = count - index;

    if (slotsLeft === 1) {
      result.push(remaining);
      break;
    }

    const minAllocation = 1;
    const maxAllocation = remaining - (slotsLeft - 1) * minAllocation;
    const randomFactor = pseudoRandom(randomSeed + index);
    const allocation = Math.max(
      minAllocation,
      Math.min(
        maxAllocation,
        Math.round(minAllocation + randomFactor * (maxAllocation - minAllocation)),
      ),
    );

    result.push(allocation);
    remaining -= allocation;
  }

  return result;
};

const colorAttributeValues = Array.from(new Set(colors.map((value) => titleize(value))));
const materialAttributeValues = Array.from(new Set(materials.map((value) => titleize(value))));

type AttributeConfig = {
  name: string;
  values: string[];
  normalize: (value: string) => string;
  resolveMeta?: (normalized: string) => Record<string, unknown>;
};

type ProductSeed = {
  name: string;
  description: string;
  originalPrice: number;
  stock: number;
  image: string;
  status: ProductStatus;
  rating: number;
  material: string;
  primaryColor: string;
};

type VariantBlueprint = {
  price: number;
  stock: number;
  image: string;
  color: string;
  size: string;
  material: string;
};

const toNicePrice = (value: number): number => Math.round(value / 1000) * 1000;

const pseudoRandom = (seed: number): number => {
  const mod = 233280;
  return ((seed * 9301 + 49297) % mod) / mod;
};

const buildProductSeeds = (count: number): ProductSeed[] => {
  const seeds: ProductSeed[] = [];

  for (let index = 0; index < count; index += 1) {
    const collection = collectionNames[index % collectionNames.length];
    const descriptor = styleDescriptors[(index * 3) % styleDescriptors.length];
    const kind = productKinds[(index * 5) % productKinds.length];
    const material = materials[(index * 7) % materials.length];
    const materialLabel = titleize(material);
    const color = colors[(index * 11) % colors.length];
    const colorLabel = titleize(color);
    const occasion = occasions[(index * 13) % occasions.length];
    const feature = keyFeatures[(index * 17) % keyFeatures.length];
    const image = imagePool[index % imagePool.length];

    const priceRandom = pseudoRandom(index + 1);
    const stockRandom = pseudoRandom(index + 37);
    const ratingRandom = pseudoRandom(index + 73);
    const statusRandom = pseudoRandom(index + 113);

    const originalPrice = toNicePrice(299000 + priceRandom * 3200000);
    const stock = 12 + Math.round(stockRandom * 188);
    const rating = Number((3 + ratingRandom * 1.8).toFixed(1));
    const status = statusRandom > 0.9 ? ProductStatus.INACTIVE : ProductStatus.ACTIVE;

    const name = `${collection} ${descriptor} ${kind} ${index + 1}`;

    const description = `Thiết kế ${descriptor.toLowerCase()} thuộc bộ sưu tập ${collection}, sử dụng chất liệu ${material} tông ${color}. ${
      feature.charAt(0).toUpperCase() + feature.slice(1)
    } cùng phom dáng linh hoạt giúp bạn tự tin trong những dịp ${occasion}.`;

    seeds.push({
      name,
      description,
      originalPrice,
      stock,
      image,
      status,
      rating,
      material: materialLabel,
      primaryColor: colorLabel,
    });
  }

  return seeds;
};

const generateVariantBlueprints = (seed: ProductSeed, productIndex: number): VariantBlueprint[] => {
  const variantCount = 3 + (productIndex % 3);
  const stocks = distributeStock(seed.stock, variantCount, productIndex * 97 + 13);
  const blueprints: VariantBlueprint[] = [];

  for (let variantIndex = 0; variantIndex < variantCount; variantIndex += 1) {
    const priceVariance = 0.85 + pseudoRandom(productIndex * 17 + variantIndex) * 0.35;
    const price = toNicePrice(Math.max(99000, seed.originalPrice * priceVariance));
    const color =
      colorAttributeValues[(productIndex * 2 + variantIndex) % colorAttributeValues.length] ??
      seed.primaryColor;
    const size = sizeOptions[(productIndex + variantIndex) % sizeOptions.length];
    const image = imagePool[(productIndex + variantIndex) % imagePool.length];

    blueprints.push({
      price,
      stock: stocks[variantIndex] ?? 1,
      image,
      color,
      size,
      material: seed.material,
    });
  }

  if (blueprints.length) {
    blueprints[0].color = seed.primaryColor;
    blueprints[0].image = imagePool[productIndex % imagePool.length];
  }

  return blueprints;
};

const refreshProductEmbeddings = async (productIds: number[]) => {
  try {
    const appContext = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });

    try {
      const semanticSearchService = appContext.get(SemanticSearchService);

      if (!productIds.length) {
        const result = await semanticSearchService.reindexAllProducts();
        console.log(
          `✨ Semantic embeddings refreshed: indexed=${result.indexed}, skipped=${result.skipped}, failures=${result.failures.length}.`,
        );
        if (result.failures.length) {
          console.warn('⚠️  Embedding failures detail:', result.failures);
        }
        return;
      }

      let indexed = 0;
      let skipped = 0;

      for (const productId of productIds) {
        try {
          const status = await semanticSearchService.refreshProductEmbedding(productId);

          if (status === 'indexed') {
            indexed += 1;
          } else {
            skipped += 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`⚠️  Failed to refresh embedding for product ${productId}: ${message}`);
        }
      }

      console.log(
        `✨ Semantic embeddings refreshed for new products: indexed=${indexed}, skipped=${skipped}.`,
      );
    } finally {
      await appContext.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Skipped embedding refresh: ${message}`);
  }
};

export async function seedProducts(dataSource: DataSource) {
  const productRepo = dataSource.getRepository(Product);
  const brandRepo = dataSource.getRepository(Brand);
  const categoryRepo = dataSource.getRepository(Category);
  const attributeRepo = dataSource.getRepository(Attribute);
  const attributeValueRepo = dataSource.getRepository(AttributeValue);
  const branchRepo = dataSource.getRepository(Branch);

  const brands = await brandRepo.find();
  const categories = await categoryRepo.find();
  const branches = await branchRepo.find({ order: { isMainBranch: 'DESC', id: 'ASC' } });
  const branchIds = branches.map((branch) => branch.id);

  if (!categories.length) {
    console.warn('⚠️  Skipping product seeds: no categories found.');
    return;
  }

  if (!branchIds.length) {
    console.warn(
      '⚠️  Product seeds: no branches found. Variant inventory records will be skipped.',
    );
  }

  const attributeConfigs: AttributeConfig[] = [
    {
      name: 'Màu sắc',
      values: colorAttributeValues,
      normalize: titleize,
      resolveMeta: (normalized) => ({ hex: resolveColorHex(normalized) }),
    },
    { name: 'Kích thước', values: sizeOptions, normalize: normalizeSize },
    { name: 'Chất liệu', values: materialAttributeValues, normalize: titleize },
  ];

  type AttributeInfo = {
    attribute: Attribute;
    normalize: (value: string) => string;
    resolveMeta?: (normalized: string) => Record<string, unknown>;
    values: Map<string, AttributeValue>;
  };

  const attributeInfos = new Map<string, AttributeInfo>();

  for (const config of attributeConfigs) {
    let attribute = await attributeRepo.findOne({ where: { name: config.name } });

    if (!attribute) {
      attribute = attributeRepo.create({
        name: config.name,
        type: AttributeType.COMMON,
      });
      attribute = await attributeRepo.save(attribute);
    }

    const existingValues = await attributeValueRepo.find({ where: { attributeId: attribute.id } });
    const valueMap = new Map<string, AttributeValue>();

    for (let value of existingValues) {
      const expectedMeta = config.resolveMeta?.(value.value);

      if (expectedMeta) {
        const mergedMeta = { ...(value.meta ?? {}) } as Record<string, unknown>;
        let needsUpdate = false;

        for (const [metaKey, metaValue] of Object.entries(expectedMeta)) {
          if (mergedMeta[metaKey] !== metaValue) {
            mergedMeta[metaKey] = metaValue;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          value.meta = mergedMeta;
          value = await attributeValueRepo.save(value);
        }
      }

      valueMap.set(value.value.toLowerCase(), value);
    }

    for (const rawValue of config.values) {
      const normalized = config.normalize(rawValue);
      const key = normalized.toLowerCase();
      const expectedMeta = config.resolveMeta?.(normalized);
      let cachedValue = valueMap.get(key);

      if (cachedValue) {
        if (expectedMeta) {
          const mergedMeta = { ...(cachedValue.meta ?? {}) } as Record<string, unknown>;
          let needsUpdate = false;

          for (const [metaKey, metaValue] of Object.entries(expectedMeta)) {
            if (mergedMeta[metaKey] !== metaValue) {
              mergedMeta[metaKey] = metaValue;
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            cachedValue.meta = mergedMeta;
            cachedValue = await attributeValueRepo.save(cachedValue);
          }
        }

        valueMap.set(key, cachedValue);
        continue;
      }

      let value = attributeValueRepo.create({
        attributeId: attribute.id,
        value: normalized,
        meta: expectedMeta ?? {},
      });

      value = await attributeValueRepo.save(value);
      valueMap.set(key, value);
    }

    attributeInfos.set(config.name, {
      attribute,
      normalize: config.normalize,
      resolveMeta: config.resolveMeta,
      values: valueMap,
    });
  }

  const getOrCreateAttributeValue = async (
    manager: EntityManager,
    attributeName: string,
    rawValue: string,
  ): Promise<AttributeValue> => {
    const info = attributeInfos.get(attributeName);

    if (!info) {
      throw new Error(`Attribute not prepared for seeding: ${attributeName}`);
    }

    const normalized = info.normalize(rawValue);
    const key = normalized.toLowerCase();
    const expectedMeta = info.resolveMeta?.(normalized);
    const cached = info.values.get(key);

    if (cached) {
      if (expectedMeta) {
        const mergedMeta = { ...(cached.meta ?? {}) } as Record<string, unknown>;
        let needsUpdate = false;

        for (const [metaKey, metaValue] of Object.entries(expectedMeta)) {
          if (mergedMeta[metaKey] !== metaValue) {
            mergedMeta[metaKey] = metaValue;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          cached.meta = mergedMeta;
          const repo = manager.getRepository(AttributeValue);
          const saved = await repo.save(cached);
          info.values.set(key, saved);
          return saved;
        }
      }

      return cached;
    }

    const repo = manager.getRepository(AttributeValue);
    let value = await repo.findOne({
      where: { attributeId: info.attribute.id, value: normalized },
    });

    if (!value) {
      value = repo.create({
        attributeId: info.attribute.id,
        value: normalized,
        meta: expectedMeta ?? {},
      });
      value = await repo.save(value);
    } else if (expectedMeta) {
      const mergedMeta = { ...(value.meta ?? {}) } as Record<string, unknown>;
      let needsUpdate = false;

      for (const [metaKey, metaValue] of Object.entries(expectedMeta)) {
        if (mergedMeta[metaKey] !== metaValue) {
          mergedMeta[metaKey] = metaValue;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        value.meta = mergedMeta;
        value = await repo.save(value);
      }
    }

    info.values.set(key, value);
    return value;
  };

  const existingProducts = await productRepo.find({ select: ['name'] });
  const existingNames = new Set(existingProducts.map((product) => product.name));

  const leafCategories = categories.filter(
    (category) => !categories.some((candidate) => candidate.parentId === category.id),
  );

  const assignableCategories = leafCategories.length ? leafCategories : categories;

  const seeds = buildProductSeeds(TARGET_PRODUCT_COUNT);
  let insertedCount = 0;
  const insertedProductIds: number[] = [];

  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index];

    if (existingNames.has(seed.name)) {
      continue;
    }

    const brand = brands.length ? brands[index % brands.length] : null;
    const category = assignableCategories[index % assignableCategories.length];
    const variantBlueprints = generateVariantBlueprints(seed, index);

    const productId = await dataSource.transaction(async (manager) => {
      const productEntity = manager.getRepository(Product).create({
        name: seed.name,
        description: seed.description,
        categoryId: category?.id ?? null,
        brandId: brand?.id ?? null,
        image: seed.image,
        originalPrice: seed.originalPrice,
        status: seed.status,
        stock: 0,
        rating: seed.rating,
      });

      const savedProduct = await manager.getRepository(Product).save(productEntity);

      for (const attributeName of attributeConfigs.map((config) => config.name)) {
        const attributeInfo = attributeInfos.get(attributeName);
        if (!attributeInfo) {
          continue;
        }

        const productAttribute = manager.getRepository(ProductAttribute).create({
          productId: savedProduct.id,
          attributeId: attributeInfo.attribute.id,
          isRequired: true,
        });

        await manager.getRepository(ProductAttribute).save(productAttribute);
      }

      let totalStock = 0;

      for (let variantIndex = 0; variantIndex < variantBlueprints.length; variantIndex += 1) {
        const blueprint = variantBlueprints[variantIndex];
        const variant = manager.getRepository(ProductVariant).create({
          productId: savedProduct.id,
          price: blueprint.price,
          status: ProductVariantStatus.ACTIVE,
          image: blueprint.image,
        });

        const savedVariant = await manager.getRepository(ProductVariant).save(variant);

        const attributeAssignments = [
          await getOrCreateAttributeValue(manager, 'Màu sắc', blueprint.color),
          await getOrCreateAttributeValue(manager, 'Kích thước', blueprint.size),
          await getOrCreateAttributeValue(manager, 'Chất liệu', blueprint.material),
        ];

        for (const attributeValue of attributeAssignments) {
          const variantAttribute = manager.getRepository(VariantAttributeValue).create({
            variantId: savedVariant.id,
            attributeId: attributeValue.attributeId,
            attributeValueId: attributeValue.id,
          });

          await manager.getRepository(VariantAttributeValue).save(variantAttribute);
        }

        if (branchIds.length) {
          const branchId = branchIds[(index + variantIndex) % branchIds.length];

          const inventoryRecord = manager.getRepository(ProductVariantInventory).create({
            variantId: savedVariant.id,
            branchId,
            stock: blueprint.stock,
          });

          await manager.getRepository(ProductVariantInventory).save(inventoryRecord);
        }

        totalStock += blueprint.stock;
      }

      savedProduct.stock = totalStock;
      await manager.getRepository(Product).save(savedProduct);
      return savedProduct.id;
    });

    existingNames.add(seed.name);
    insertedCount += 1;
    insertedProductIds.push(productId);
  }

  if (!insertedCount) {
    console.log('ℹ️  Product seeds skipped: all seed products already exist.');
    return;
  }

  console.log(`✅ Product seed data inserted successfully (${insertedCount} products).`);
  await refreshProductEmbeddings(insertedProductIds);
}
