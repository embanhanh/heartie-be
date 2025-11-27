import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { PromotionConditionRole } from '../entities/promotion-condition.entity';

export class CreatePromotionConditionDto {
  @ApiProperty({ description: 'Identifier of the promotion', minimum: 1 })
  @IsInt()
  @Min(1)
  promotionId: number;

  @ApiProperty({
    description: 'Identifier of the product participating in the promotion',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ description: 'Quantity threshold for the condition', minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({
    enum: PromotionConditionRole,
    description: 'Role of the product in the promotion',
  })
  @IsEnum(PromotionConditionRole)
  @IsNotEmpty()
  role: PromotionConditionRole;
}
