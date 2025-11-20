import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CreatePromotionCustomerGroupDto {
  @ApiProperty({ description: 'Identifier of the promotion', minimum: 1 })
  @IsInt()
  @Min(1)
  promotionId: number;

  @ApiProperty({
    description: 'Optional customer group that will receive the promotion',
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  customerGroupId?: number | null;
}
