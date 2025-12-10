import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateCollectionProductDto {
  @ApiProperty({ description: 'ID bộ sưu tập', minimum: 1 })
  @IsInt()
  @Min(1)
  collectionId!: number;

  @ApiProperty({ description: 'ID sản phẩm', minimum: 1 })
  @IsInt()
  @Min(1)
  productId!: number;

  @ApiPropertyOptional({ description: 'Thứ tự hiển thị', default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
