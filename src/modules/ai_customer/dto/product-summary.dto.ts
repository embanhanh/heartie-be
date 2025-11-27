import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ProductSummaryRequestDto {
  @IsNumber()
  productId: number;

  @IsOptional()
  @IsString()
  locale?: string;
}

export interface ProductSummaryResponse {
  summary: string | null;
}
