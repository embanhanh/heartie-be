export interface AiCustomerFeatureManifestItem {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  actions: Array<{
    key: string;
    label: string;
    description: string;
  }>;
}

export interface AiCustomerManifestResponse {
  features: AiCustomerFeatureManifestItem[];
  updatedAt: string;
}

export interface ProductVariantAttributeValueHydrated {
  attribute?: { name?: string | null } | null;
  attributeValue?: { value?: string | null } | null;
}

export interface ProductVariantHydrated {
  id: number;
  price: number | string;
  image?: string | null;
  attributeValues?: ProductVariantAttributeValueHydrated[] | null;
}

export interface ProductDetailHydrated {
  id: number;
  name: string;
  slug?: string;
  images?: string[] | null;
  category?: { name?: string | null } | null;
  brand?: { name?: string | null } | null;
  variants?: ProductVariantHydrated[] | null;
}

export interface VariantSnapshot {
  id: number;
  price: number;
  image: string | null;
  attributes: Array<{ attribute?: string; value?: string }>;
  attributeSummary: string | null;
}

export interface ProductSnapshot {
  id: number;
  name: string;
  category: string | null;
  brand: string | null;
  priceRange: string | null;
  image: string | null;
  selectedVariant: VariantSnapshot | null;
}

export interface StylistCandidateSummary {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  priceRange: string | null;
  tags: string[];
  image: string | null;
  score: number;
  isFocus: boolean;
}

export interface GeminiStylistPlanOutfit {
  title?: string;
  name?: string;
  summary?: string;
  overview?: string;
  description?: string;
  occasion?: string | null;
  items?: unknown;
}

export interface GeminiStylistPlanPayload {
  headline?: string;
  title?: string;
  suggestions?: unknown;
  outfits?: unknown;
}
