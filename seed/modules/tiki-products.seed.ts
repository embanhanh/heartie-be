import { DataSource, EntityManager } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Product, ProductStatus } from '../../src/modules/products/entities/product.entity';
import {
  ProductVariant,
  ProductVariantStatus,
} from '../../src/modules/product_variants/entities/product_variant.entity';
import { ProductAttribute } from '../../src/modules/product_attributes/entities/product-attribute.entity';
import { Attribute, AttributeType } from '../../src/modules/attributes/entities/attribute.entity';
import { AttributeValue } from '../../src/modules/attribute_values/entities/attribute-value.entity';
import { VariantAttributeValue } from '../../src/modules/variant_attribute_values/entities/variant-attribute-value.entity';
import { Brand } from '../../src/modules/brands/entities/brand.entity';
import { Category } from '../../src/modules/categories/entities/category.entity';

interface TikiConfigurableProduct {
  option1?: string;
  option2?: string;
  price: number;
  thumbnail_url: string;
}

interface TikiProduct {
  id: number;
  name: string;
  short_description?: string;
  original_price: number;
  rating_average?: number;
  thumbnail_url: string;
  brand?: string | { id?: number; name?: string; slug?: string };
  configurable_products?: TikiConfigurableProduct[];
  breadcrumbs?: TikiCategory[];
}

interface TikiCategory {
  category_id: number;
  name: string;
  url: string;
}

const BATCH_SIZE = 100;

const titleize = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const computeColorHex = (colorName: string): string => {
  if (!colorName) {
    return '#000000';
  }

  let hash = 0;
  for (let i = 0; i < colorName.length; i++) {
    hash = Math.imul(31, hash) + colorName.charCodeAt(i);
    hash |= 0;
  }

  const hex = ((hash >>> 0) & 0xffffff).toString(16).padStart(6, '0');
  return `#${hex}`;
};

export async function seedTikiProducts(dataSource: DataSource) {
  const jsonPath = join(__dirname, '..', 'assets', 'products_detail.json');
  const rawData = readFileSync(jsonPath, 'utf-8');
  const tikiProducts = JSON.parse(rawData) as TikiProduct[];

  console.log(`📦 Found ${tikiProducts.length} products in Tiki JSON file.`);

  const productRepo = dataSource.getRepository(Product);
  const brandRepo = dataSource.getRepository(Brand);
  const categoryRepo = dataSource.getRepository(Category);
  const attributeRepo = dataSource.getRepository(Attribute);
  const attributeValueRepo = dataSource.getRepository(AttributeValue);

  // Load existing brands and categories
  const allBrands = await brandRepo.find();
  const brandMap = new Map<string, Brand>();
  for (const brand of allBrands) {
    brandMap.set(brand.name.toLowerCase().trim(), brand);
  }

  const allCategories = await categoryRepo.find();
  const categoryMap = new Map<string, Category>();
  for (const category of allCategories) {
    categoryMap.set(category.name.toLowerCase(), category);
  }

  // Get or create color and size attributes
  let colorAttribute = await attributeRepo.findOne({ where: { name: 'Màu sắc' } });
  if (!colorAttribute) {
    colorAttribute = attributeRepo.create({ name: 'Màu sắc', type: AttributeType.COMMON });
    colorAttribute = await attributeRepo.save(colorAttribute);
  }

  let sizeAttribute = await attributeRepo.findOne({ where: { name: 'Kích thước' } });
  if (!sizeAttribute) {
    sizeAttribute = sizeAttribute = attributeRepo.create({
      name: 'Kích thước',
      type: AttributeType.COMMON,
    });
    sizeAttribute = await attributeRepo.save(sizeAttribute);
  }

  // Cache attribute values
  const colorValueCache = new Map<string, AttributeValue>();
  const sizeValueCache = new Map<string, AttributeValue>();

  const existingColorValues = await attributeValueRepo.find({
    where: { attributeId: colorAttribute.id },
  });
  for (const val of existingColorValues) {
    colorValueCache.set(val.value.toLowerCase(), val);
  }

  const existingSizeValues = await attributeValueRepo.find({
    where: { attributeId: sizeAttribute.id },
  });
  for (const val of existingSizeValues) {
    sizeValueCache.set(val.value.toLowerCase().trim(), val);
  }

  // Check existing products
  const existingProducts = await productRepo.find({ select: ['name'] });
  const existingProductNames = new Set(existingProducts.map((p) => p.name));

  const getOrCreateColorValue = async (
    manager: EntityManager,
    rawValue: string,
  ): Promise<AttributeValue> => {
    const normalized = titleize(rawValue);
    const key = normalized.toLowerCase();
    const cached = colorValueCache.get(key);

    if (cached) {
      return cached;
    }

    const repo = manager.getRepository(AttributeValue);
    let value = await repo.findOne({
      where: { attributeId: colorAttribute.id, value: normalized },
    });

    if (!value) {
      value = repo.create({
        attributeId: colorAttribute.id,
        value: normalized,
        meta: { hex: computeColorHex(normalized) },
      });
      value = await repo.save(value);
    }

    colorValueCache.set(key, value);
    return value;
  };

  const getOrCreateSizeValue = async (
    manager: EntityManager,
    rawValue: string,
  ): Promise<AttributeValue> => {
    const normalized = rawValue.trim().toUpperCase();
    const key = normalized.toLowerCase();
    const cached = sizeValueCache.get(key);

    if (cached) {
      return cached;
    }

    const repo = manager.getRepository(AttributeValue);
    let value = await repo.findOne({
      where: { attributeId: sizeAttribute.id, value: normalized },
    });

    if (!value) {
      value = repo.create({
        attributeId: sizeAttribute.id,
        value: normalized,
        meta: {},
      });
      value = await repo.save(value);
    }

    sizeValueCache.set(key, value);
    return value;
  };

  let insertedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < tikiProducts.length; i += BATCH_SIZE) {
    const batch = tikiProducts.slice(i, i + BATCH_SIZE);

    for (const tikiProduct of batch) {
      // Skip if product already exists
      if (existingProductNames.has(tikiProduct.name)) {
        skippedCount++;
        continue;
      }

      // Skip products without variants
      if (!tikiProduct.configurable_products || tikiProduct.configurable_products.length === 0) {
        skippedCount++;
        continue;
      }

      // Look up brand
      let brandId: number | null = null;
      if (tikiProduct.brand) {
        const brandName =
          typeof tikiProduct.brand === 'string' ? tikiProduct.brand : tikiProduct.brand.name;
        if (brandName) {
          const brand = brandMap.get(brandName.toLowerCase().trim());
          if (brand) {
            brandId = brand.id;
          }
        }
      }

      // Look up category
      let categoryId: number | null = null;
      const categoryName = tikiProduct.breadcrumbs?.[2]?.name;
      if (categoryName) {
        const category = categoryMap.get(categoryName.toLowerCase().trim());
        if (category) {
          categoryId = category.id;
        }
      }

      try {
        await dataSource.transaction(async (manager) => {
          // Create Product
          const product = manager.getRepository(Product).create({
            tikiId: tikiProduct.id,
            name: tikiProduct.name.trim(),
            description: tikiProduct.short_description?.trim() || undefined,
            originalPrice: tikiProduct.original_price,
            image: tikiProduct.thumbnail_url,
            rating: tikiProduct.rating_average || 0,
            status: ProductStatus.ACTIVE,
            stock: 100,
            brandId,
            categoryId,
          });

          const savedProduct = await manager.getRepository(Product).save(product);

          // Determine which attributes this product uses
          const hasColorOption = tikiProduct.configurable_products!.some((cp) => cp.option1);
          const hasSizeOption = tikiProduct.configurable_products!.some((cp) => cp.option2);

          // Create ProductAttributes
          if (hasColorOption) {
            const productAttribute = manager.getRepository(ProductAttribute).create({
              productId: savedProduct.id,
              attributeId: colorAttribute.id,
              isRequired: true,
            });
            await manager.getRepository(ProductAttribute).save(productAttribute);
          }

          if (hasSizeOption) {
            const productAttribute = manager.getRepository(ProductAttribute).create({
              productId: savedProduct.id,
              attributeId: sizeAttribute.id,
              isRequired: true,
            });
            await manager.getRepository(ProductAttribute).save(productAttribute);
          }

          // Create ProductVariants
          let totalStock = 0;
          const defaultStock = 10; // Default stock per variant

          for (const configProduct of tikiProduct.configurable_products!) {
            const variant = manager.getRepository(ProductVariant).create({
              productId: savedProduct.id,
              price: configProduct.price,
              image: configProduct.thumbnail_url,
              status: ProductVariantStatus.ACTIVE,
            });

            const savedVariant = await manager.getRepository(ProductVariant).save(variant);

            // Create VariantAttributeValues
            if (configProduct.option1) {
              const colorValue = await getOrCreateColorValue(manager, configProduct.option1);
              const variantAttr = manager.getRepository(VariantAttributeValue).create({
                variantId: savedVariant.id,
                attributeId: colorAttribute.id,
                attributeValueId: colorValue.id,
              });
              await manager.getRepository(VariantAttributeValue).save(variantAttr);
            }

            if (configProduct.option2) {
              const sizeValue = await getOrCreateSizeValue(manager, configProduct.option2);
              const variantAttr = manager.getRepository(VariantAttributeValue).create({
                variantId: savedVariant.id,
                attributeId: sizeAttribute.id,
                attributeValueId: sizeValue.id,
              });
              await manager.getRepository(VariantAttributeValue).save(variantAttr);
            }

            totalStock += defaultStock;
          }

          // Update product stock
          savedProduct.stock = totalStock;
          await manager.getRepository(Product).save(savedProduct);
        });

        existingProductNames.add(tikiProduct.name);
        insertedCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️  Failed to insert product "${tikiProduct.name}": ${message}`);
      }
    }

    console.log(
      `📊 Progress: ${Math.min(i + BATCH_SIZE, tikiProducts.length)}/${tikiProducts.length} processed`,
    );
  }

  console.log(
    `✅ Tiki product seed completed: ${insertedCount} inserted, ${skippedCount} skipped.`,
  );
}
