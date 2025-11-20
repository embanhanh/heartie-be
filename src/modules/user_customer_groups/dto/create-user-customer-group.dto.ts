import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserCustomerGroupDto {
  @ApiProperty({ description: 'Identifier of the user', minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;

  @ApiProperty({ description: 'Identifier of the customer group', minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerGroupId!: number;
}
