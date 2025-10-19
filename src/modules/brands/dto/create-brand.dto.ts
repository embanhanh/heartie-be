import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { BrandStatus } from '../entities/brand.entity';

export class CreateBrandDto {
  @ApiProperty({ description: 'Tên thương hiệu', example: 'Heartie Originals' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Trạng thái thương hiệu',
    enum: BrandStatus,
    default: BrandStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(BrandStatus)
  status?: BrandStatus;
}
