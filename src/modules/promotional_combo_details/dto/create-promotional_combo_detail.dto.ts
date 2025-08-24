import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, Min, IsPositive } from 'class-validator';

export class CreatePromotionalComboDetailDto {
  @ApiProperty({
    description: 'ID của promotional combo',
    example: 1,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  idCombo: number;

  @ApiProperty({
    description: 'Số lượng sản phẩm trong combo',
    example: 2,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Giá trị giảm giá cho sản phẩm này',
    example: 15000,
    required: true,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  discountValue: number;
}
