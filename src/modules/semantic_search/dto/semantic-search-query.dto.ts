import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class SemanticSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
