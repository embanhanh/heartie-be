import { PartialType } from '@nestjs/swagger';
import { CreateAttributeValueDto } from './create-attribute_value.dto';

export class UpdateAttributeValueDto extends PartialType(CreateAttributeValueDto) {}
