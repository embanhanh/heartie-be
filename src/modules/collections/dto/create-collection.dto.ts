import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CollectionStatus } from '../entities/collection.entity';

export class CreateCollectionDto {
  @ApiProperty({ description: 'Tên bộ sưu tập', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn ảnh (sử dụng khi không tải file)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ enum: CollectionStatus, default: CollectionStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CollectionStatus)
  status?: CollectionStatus;
}
