import { PartialType } from '@nestjs/swagger';
import { CreateProductAttributeDto } from './create-product_attribute.dto';

export class UpdateProductAttributeDto extends PartialType(CreateProductAttributeDto) {}
