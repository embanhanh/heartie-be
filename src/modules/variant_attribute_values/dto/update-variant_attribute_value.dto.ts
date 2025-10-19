import { PartialType } from '@nestjs/swagger';
import { CreateVariantAttributeValueDto } from './create-variant_attribute_value.dto';

export class UpdateVariantAttributeValueDto extends PartialType(CreateVariantAttributeValueDto) {}
