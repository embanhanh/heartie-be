import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, Min } from 'class-validator';
// import { Type } from 'class-transformer';

export class CreateOrderProductDetailDto {
  @ApiProperty({
    description: 'ID đơn hàng',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  idOrderProduct: number;

  @ApiProperty({
    description: 'ID biến thể sản phẩm',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  idProductVariant: number;

  @ApiProperty({
    description: 'Số lượng sản phẩm',
    example: 2,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  quantity: number;
}
