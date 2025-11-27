import { Transform, Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsInt, IsOptional } from 'class-validator';
import { InteractionType } from '../../interactions/entities/interaction.entity';

export class MetricsQueryDto {
  @Type(() => Number)
  @IsInt()
  productVariantId!: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item: string) => item.trim().toUpperCase())
        .filter(Boolean);
    }

    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim().toUpperCase()).filter(Boolean);
    }

    return [] as string[];
  })
  @IsEnum(InteractionType, { each: true })
  metricTypes?: InteractionType[];
}
