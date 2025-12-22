import { Injectable, Logger } from '@nestjs/common';
import { ProductsService } from '../../products/products.service';
import { ProductDetailHydrated, ProductVariantHydrated } from '../types/internal.types';

export interface CartProductContext {
  id: number;
  name: string;
  slug?: string;
  brand?: string | null;
  category?: string | null;
  image?: string | null;
  priceRange: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  variantCount: number;
  attributeHighlights: string[];
}

@Injectable()
export class CartProductContextFactory {
  private readonly logger = new Logger(CartProductContextFactory.name);

  constructor(private readonly productsService: ProductsService) {}

  /**
   * Build a map of product id -> cart-specific context snapshot.
   */
  async hydrate(productIds: number[]): Promise<Map<number, CartProductContext>> {
    const uniqueIds = Array.from(new Set(productIds)).filter((id) => id > 0);
    if (!uniqueIds.length) {
      return new Map();
    }

    const entries = await Promise.all(
      uniqueIds.map(async (productId) => {
        try {
          const detail = (await this.productsService.findOne(
            productId,
          )) as ProductDetailHydrated | null;
          if (!detail) {
            return null;
          }
          return [productId, this.toProductContext(detail)] as const;
        } catch (error) {
          this.logger.warn(
            `Failed to hydrate product ${productId}: ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        }
      }),
    );

    return new Map(
      entries.filter((entry): entry is [number, CartProductContext] => Boolean(entry)),
    );
  }

  /**
   * Ensure a map contains the given product ids (used when promotions reference extra items).
   */
  async ensure(productIds: number[], map: Map<number, CartProductContext>): Promise<void> {
    const missingIds = productIds.filter((productId) => !map.has(productId));
    if (!missingIds.length) {
      return;
    }

    const hydrated = await this.hydrate(missingIds);
    hydrated.forEach((context, productId) => map.set(productId, context));
  }

  private toProductContext(product: ProductDetailHydrated): CartProductContext {
    const variants = Array.isArray(product.variants)
      ? product.variants.filter((variant): variant is ProductVariantHydrated => Boolean(variant))
      : [];

    const numericPrices = variants
      .map((variant) => Number(variant.price))
      .filter((price) => Number.isFinite(price));
    const minPrice = numericPrices.length ? Math.min(...numericPrices) : null;
    const maxPrice = numericPrices.length ? Math.max(...numericPrices) : null;

    const attributeHighlights = this.extractAttributeHighlights(variants);
    const heroImage =
      Array.isArray(product.images) && product.images.length ? (product.images[0] ?? null) : null;

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand?.name ?? null,
      category: product.category?.name ?? null,
      image: heroImage,
      priceRange: this.formatPriceRange(minPrice, maxPrice),
      minPrice,
      maxPrice,
      variantCount: variants.length,
      attributeHighlights,
    };
  }

  private extractAttributeHighlights(variants: ProductVariantHydrated[]): string[] {
    const highlights = new Set<string>();
    for (const variant of variants.slice(0, 3)) {
      const attributes = Array.isArray(variant.attributeValues)
        ? variant.attributeValues
            .map((entry) => {
              const attribute = entry?.attribute?.name ?? '';
              const value = entry?.attributeValue?.value ?? '';
              if (!attribute || !value) {
                return null;
              }
              return `${attribute}: ${value}`;
            })
            .filter((value): value is string => Boolean(value))
        : [];

      for (const attribute of attributes.slice(0, 2)) {
        highlights.add(attribute);
      }
    }

    return Array.from(highlights).slice(0, 4);
  }

  private formatPriceRange(minPrice: number | null, maxPrice: number | null): string | null {
    if (minPrice === null || Number.isNaN(minPrice)) {
      return null;
    }

    const formatter = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    });

    if (maxPrice === null || Number.isNaN(maxPrice) || maxPrice === minPrice) {
      return formatter.format(minPrice);
    }

    return `${formatter.format(minPrice)} - ${formatter.format(maxPrice)}`;
  }
}
