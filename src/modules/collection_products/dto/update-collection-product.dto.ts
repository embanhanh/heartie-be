import { PartialType } from '@nestjs/swagger';
import { CreateCollectionProductDto } from './create-collection-product.dto';

export class UpdateCollectionProductDto extends PartialType(CreateCollectionProductDto) {}
