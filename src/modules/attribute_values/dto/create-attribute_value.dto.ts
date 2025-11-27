import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAttributeValueDto {
  @ApiProperty({ description: 'Identifier of the attribute this value belongs to', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attributeId: number;

  @ApiProperty({ description: 'Display value', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  value: string;

  @ApiPropertyOptional({ description: 'Optional metadata stored as JSON' })
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
