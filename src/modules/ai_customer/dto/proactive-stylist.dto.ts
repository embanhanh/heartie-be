import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ProactiveStylistSignalDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsNumber()
  durationMs?: number;

  @IsOptional()
  @IsString()
  intensity?: string;
}

export class ProactiveStylistVariantPreferenceDto {
  @IsOptional()
  @IsNumber()
  variantId?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ProactiveStylistRequestDto {
  @IsNumber()
  productId: number;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  surface?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProactiveStylistVariantPreferenceDto)
  variant?: ProactiveStylistVariantPreferenceDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProactiveStylistSignalDto)
  signals?: ProactiveStylistSignalDto[];
}

export interface ProactiveStylistOutfitItemSuggestion {
  name: string;
  description?: string;
  categoryHint?: string;
  pairingReason?: string;
  image?: string;
  productId?: number;
}

export interface ProactiveStylistSuggestion {
  title: string;
  summary: string;
  items: ProactiveStylistOutfitItemSuggestion[];
  occasionHint?: string;
}

export interface ProactiveStylistResponse {
  headline: string;
  suggestions: ProactiveStylistSuggestion[];
  fallbackApplied: boolean;
  productSnapshot: {
    id: number;
    name: string;
    category?: string | null;
    brand?: string | null;
    priceRange?: string | null;
    image?: string | null;
  };
}
