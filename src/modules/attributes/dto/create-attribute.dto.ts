import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AttributeType } from '../entities/attribute.entity';

export class CreateAttributeDto {
  @ApiProperty({ description: 'Internal attribute name (e.g. color, size)', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ enum: AttributeType, default: AttributeType.COMMON })
  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;
}
