import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CartAnalysisItemDto {
  @IsNumber()
  productId: number;

  @IsOptional()
  @IsNumber()
  variantId?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;
}

export class CartAnalysisRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartAnalysisItemDto)
  items: CartAnalysisItemDto[];

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  surface?: string;
}

export interface CartAssistantGreeting {
  headline: string;
  subtitle: string;
}

export interface CartPromotionProductGap {
  productId: number;
  productName?: string | null;
  productImage?: string | null;
  productPrice?: number | null;
  requiredQuantity: number;
  currentQuantity: number;
  missingQuantity: number;
  autoAdd?: boolean;
}

export interface CartPromotionOpportunity {
  promotionId: number;
  promotionName: string;
  description?: string | null;
  comboType?: string | null;
  summary: string;
  potentialDiscount?: number | null;
  primaryProductId?: number;
  missingProducts: CartPromotionProductGap[];
}

export interface CartComparisonProductSummary {
  productId: number;
  name: string;
  brand?: string | null;
  category?: string | null;
  priceRange?: string | null;
  thumbnail?: string | null;
}

export interface CartComparisonOpportunity {
  comparisonId: string;
  reason: string;
  productIds: number[];
  products: CartComparisonProductSummary[];
}

export interface CartAnalysisResponse {
  greeting: CartAssistantGreeting;
  promotionOpportunities: CartPromotionOpportunity[];
  comparisonOpportunities: CartComparisonOpportunity[];
  fallbackApplied: boolean;
  inspectedItems: number;
  generatedAt: string;
}
