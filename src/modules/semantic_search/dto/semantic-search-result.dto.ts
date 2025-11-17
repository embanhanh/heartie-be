import { ProductVariantStatus } from '../../product_variants/entities/product_variant.entity';

export interface SemanticVariantSummary {
  id: number;
  price: number;
  status: ProductVariantStatus;
  attributes: Array<{ name: string; value: string }>;
}

export interface SemanticSearchResultDto {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
  brand?: string | null;
  category?: string | null;
  score: number;
  variants: SemanticVariantSummary[];
  attributes: string[];
}
