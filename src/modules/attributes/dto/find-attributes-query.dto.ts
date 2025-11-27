import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AttributeType } from '../entities/attribute.entity';

export class FindAttributesQueryDto {
  @ApiPropertyOptional({ enum: AttributeType, description: 'Filter attributes by type' })
  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;
}
