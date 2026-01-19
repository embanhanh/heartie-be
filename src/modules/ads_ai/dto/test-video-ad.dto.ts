import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TestVideoAdDto {
  @ApiProperty({ example: 'Áo Hoodie Mùa Đông', description: 'Tên sản phẩm' })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiProperty({ example: 'Chất liệu nỉ bông dày dặn, ấm áp', description: 'Mô tả sản phẩm' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: '450,000đ', description: 'Giá sản phẩm' })
  @IsString()
  @IsNotEmpty()
  price: string;

  @ApiProperty({ example: 'Tặng kèm mũ len thời trang', description: 'Thông tin khuyến mãi' })
  @IsString()
  @IsNotEmpty()
  promotion: string;
}
