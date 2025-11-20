import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCustomerGroupDto {
  @ApiProperty({ description: 'Tên nhóm khách hàng', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Mô tả về nhóm khách hàng', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
