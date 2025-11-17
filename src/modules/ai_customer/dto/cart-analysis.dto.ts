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

export type CartInsightCategory =
  | 'duplicates'
  | 'comparison'
  | 'cross-sell'
  | 'promotion'
  | 'shipping'
  | 'styling'
  | 'none';

export interface CartAnalysisSuggestion {
  category: CartInsightCategory;
  title: string;
  message: string;
  recommendation?: string;
}

export interface CartAnalysisResponse {
  suggestion: CartAnalysisSuggestion | null;
  fallbackApplied: boolean;
  inspectedItems: number;
}
