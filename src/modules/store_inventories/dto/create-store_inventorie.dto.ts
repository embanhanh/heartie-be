// store-inventory.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, IsOptional, IsString, IsIn, Min } from 'class-validator';
// import { Transform } from 'class-transformer';

export class CreateStoreInventoryDto {
  @ApiProperty({
    description: 'ID store',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  idStore: number;

  @ApiProperty({
    description: 'ID product variant',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  idProductVariant: number;

  @ApiProperty({
    description: 'Số lượng tồn kho',
    example: 100,
    required: true,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  stockOnHand: number;

  @ApiProperty({
    description: 'Số lượng đã đặt trước',
    example: 10,
    required: false,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  reserved?: number;

  @ApiProperty({
    description: 'Giá bán',
    example: 299000,
    required: true,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  price: number;

  @ApiProperty({
    description: 'Trạng thái',
    example: 'ACTIVE',
    enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'],
    required: false,
    default: 'ACTIVE',
  })
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'])
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: 'ID người cập nhật',
    example: 1,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  updatedBy?: number;
}
