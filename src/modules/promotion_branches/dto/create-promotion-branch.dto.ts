import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreatePromotionBranchDto {
  @ApiProperty({ description: 'Identifier of the promotion', minimum: 1 })
  @IsInt()
  @Min(1)
  promotionId: number;

  @ApiProperty({ description: 'Identifier of the branch that receives the promotion', minimum: 1 })
  @IsInt()
  @Min(1)
  branchId: number;
}
