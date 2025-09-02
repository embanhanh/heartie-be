import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsDate, IsOptional, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePromotionalComboDto {
  @ApiProperty({
    description: 'Tên của combo khuyến mãi',
    example: 'Combo Ăn Vặt Siêu Tiết Kiệm',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  comboName: string;

  @ApiProperty({
    description: 'Ngày bắt đầu combo',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty({
    description: 'Ngày kết thúc combo',
    example: '2024-12-31T23:59:59.000Z',
    required: true,
  })
  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @ApiProperty({
    description: 'Giới hạn số lượng combo có thể bán',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limitCombo?: number;

  @ApiProperty({
    description: 'Loại combo',
    example: 'bundle',
    enum: ['fixed', 'percentage', 'bundle'],
    required: true,
  })
  @IsString()
  @IsIn(['fixed', 'percentage', 'bundle'])
  comboType: string;

  @ApiProperty({
    description: 'Danh sách ID sản phẩm trong combo',
    example: [1, 2, 3],
    required: true,
    type: [Number],
  })
  @IsNotEmpty({ each: true })
  @IsNumber({}, { each: true })
  products: number[];
}
