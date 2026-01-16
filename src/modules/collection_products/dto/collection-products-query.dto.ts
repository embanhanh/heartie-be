import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationOptionsDto } from '../../../common/dto/pagination.dto';

export class CollectionProductsQueryDto extends PaginationOptionsDto {
  @ApiPropertyOptional({ description: 'Lọc theo collectionId', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  collectionId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo productId', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên bộ sưu tập hoặc sản phẩm' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}
