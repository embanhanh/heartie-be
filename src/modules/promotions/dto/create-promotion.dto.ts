import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ApplyScope,
  ComboType,
  CouponType,
  DiscountType,
  PromotionType,
} from '../entities/promotion.entity';

export class CreatePromotionDto {
  @ApiProperty({ description: 'Promotion name', example: 'Back to School Sale' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Promotion code', example: 'BACK2SCHOOL' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({ description: 'Promotion description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Promotion type', enum: PromotionType })
  @IsEnum(PromotionType)
  type: PromotionType;

  @ApiPropertyOptional({ description: 'Combo type', enum: ComboType })
  @IsOptional()
  @IsEnum(ComboType)
  comboType?: ComboType;

  @ApiPropertyOptional({ description: 'Coupon type', enum: CouponType })
  @IsOptional()
  @IsEnum(CouponType)
  couponType?: CouponType;

  @ApiProperty({ description: 'Discount value', example: 10 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue: number;

  @ApiPropertyOptional({
    description: 'Discount type',
    enum: DiscountType,
    default: DiscountType.PERCENT,
  })
  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @ApiProperty({ description: 'Promotion start date (ISO string)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Promotion end date (ISO string)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'Minimum order value to apply', example: 100000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderValue?: number;

  @ApiPropertyOptional({ description: 'Maximum discount amount', example: 50000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxDiscount?: number;

  @ApiPropertyOptional({ description: 'Allowed usage count overall', example: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ description: 'Current used count', example: 5 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  usedCount?: number;

  @ApiPropertyOptional({ description: 'Scope where promotion applies', enum: ApplyScope })
  @IsOptional()
  @IsEnum(ApplyScope)
  applyScope?: ApplyScope;

  @ApiPropertyOptional({ description: 'Whether promotion is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
