// interaction.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsIP,
  Length,
  // IsUUID,
  // IsIn,
  IsInt,
} from 'class-validator';
// import { Transform, Type } from 'class-transformer';
import { InteractionType } from '../entities/interaction.entity';

export class CreateInteractionDto {
  @ApiProperty({
    description: 'ID biến thể sản phẩm',
    example: '2',
    required: true,
  })
  @IsInt()
  @IsNotEmpty()
  idProductVariant: number;

  @ApiProperty({
    description: 'ID người dùng',
    example: '1',
    required: true,
  })
  @IsInt()
  @IsNotEmpty()
  idUser: number;

  @ApiProperty({
    description: 'Loại tương tác',
    example: InteractionType.VIEW,
    enum: InteractionType,
    required: true,
  })
  @IsEnum(InteractionType)
  @IsNotEmpty()
  type: InteractionType;

  @ApiProperty({
    description: 'Metadata bổ sung (search query, filter criteria, etc.)',
    example: { searchQuery: 'laptop gaming', category: 'electronics' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: any;

  @ApiProperty({
    description: 'Địa chỉ IP',
    example: '192.168.1.1',
    required: false,
  })
  @IsIP()
  @IsOptional()
  ipAddress?: string;

  @ApiProperty({
    description: 'User Agent',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    required: false,
  })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiProperty({
    description: 'Session ID',
    example: 'sess_abc123xyz',
    required: false,
  })
  @IsString()
  @Length(0, 100)
  @IsOptional()
  sessionId?: string;
}
