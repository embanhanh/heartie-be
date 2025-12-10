import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationOptionsDto } from '../../../common/dto/pagination.dto';
import { CollectionStatus } from '../entities/collection.entity';

export class CollectionsQueryDto extends PaginationOptionsDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên hoặc slug', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ enum: CollectionStatus })
  @IsOptional()
  @IsEnum(CollectionStatus)
  status?: CollectionStatus;
}
