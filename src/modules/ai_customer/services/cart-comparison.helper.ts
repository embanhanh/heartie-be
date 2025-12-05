import { ProductComparisonFeatureInsight } from '../dto/product-comparison.dto';
import { CartProductContext } from './cart-product-context.factory';
import { getCartCopy, SupportedLocale } from './cart-insights.copy';

const calculateDiffPercent = (minPrice: number, maxPrice: number): number => {
  if (!minPrice || !maxPrice || minPrice <= 0) {
    return 0;
  }
  const diff = maxPrice - minPrice;
  return Number(((diff / minPrice) * 100).toFixed(1));
};

export const buildComparisonMatrix = (
  locale: SupportedLocale,
  contexts: CartProductContext[],
): ProductComparisonFeatureInsight[] => {
  const copy = getCartCopy(locale);
  const maxPrice = Math.max(...contexts.map((item) => item.maxPrice ?? 0));
  const minPrice = Math.min(...contexts.map((item) => item.minPrice ?? 0));
  const maxDiffPercent = calculateDiffPercent(minPrice, maxPrice);

  const formatHighlight = (context: CartProductContext): string =>
    context.attributeHighlights.length ? context.attributeHighlights.join(', ') : '—';

  return [
    {
      feature: copy.featurePrice(),
      insight: copy.priceInsight({ maxDiffPercent }),
      values: contexts.map((context) => ({
        productId: context.id,
        value: context.priceRange ?? '—',
      })),
    },
    {
      feature: copy.featureBrand(),
      values: contexts.map((context) => ({
        productId: context.id,
        value: context.brand ?? '—',
      })),
    },
    {
      feature: copy.featureCategory(),
      values: contexts.map((context) => ({
        productId: context.id,
        value: context.category ?? '—',
      })),
    },
    {
      feature: copy.featureVariants(),
      values: contexts.map((context) => ({
        productId: context.id,
        value: `${context.variantCount} variants`,
      })),
    },
    {
      feature: copy.featureAttributes(),
      values: contexts.map((context) => ({
        productId: context.id,
        value: formatHighlight(context),
      })),
    },
  ];
};
