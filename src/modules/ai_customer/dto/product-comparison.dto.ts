import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class ProductComparisonRequestDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsNumber({}, { each: true })
  productIds: number[];

  @IsOptional()
  @IsString()
  locale?: string;
}

export interface ProductComparisonProductHighlight {
  productId: number;
  name: string;
  brand?: string | null;
  category?: string | null;
  priceRange?: string | null;
  thumbnail?: string | null;
  variantCount?: number;
  attributeHighlights?: string[];
}

export interface ProductComparisonFeatureValue {
  productId: number;
  value: string;
}

export interface ProductComparisonFeatureInsight {
  feature: string;
  insight?: string;
  values: ProductComparisonFeatureValue[];
}

export interface ProductComparisonResponse {
  headline: string;
  summary: string;
  comparedProducts: ProductComparisonProductHighlight[];
  featureMatrix: ProductComparisonFeatureInsight[];
  generatedAt: string;
}
