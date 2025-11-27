import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ReviewsSummaryRequestDto {
  @IsNumber()
  productId: number;

  @IsOptional()
  @IsString()
  locale?: string;
}

export interface ReviewsSummaryResponse {
  summary: string | null;
}
