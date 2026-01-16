import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Collection, CollectionStatus } from '../entities/collection.entity';
import { PaginationMeta } from '../../../common/dto/pagination.dto';

class PaginationMetaDto implements PaginationMeta {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class CollectionResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  slug?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiPropertyOptional({ description: 'Đường dẫn ảnh đã được lưu' })
  imageUrl?: string | null;

  @ApiPropertyOptional({ deprecated: true, description: 'Sử dụng imageUrl thay thế' })
  image?: string | null;

  @ApiProperty({ enum: CollectionStatus })
  status!: CollectionStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static from(entity: Collection): CollectionResponseDto {
    const dto = new CollectionResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.slug = entity.slug ?? null;
    dto.description = entity.description ?? null;
    const imagePath = entity.image ?? null;
    dto.imageUrl = imagePath;
    dto.image = imagePath;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

export class CollectionListResponseDto {
  @ApiProperty({ type: () => CollectionResponseDto, isArray: true })
  data!: CollectionResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMeta;
}
