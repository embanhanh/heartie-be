import { PartialType } from '@nestjs/mapped-types';
import { CreateMomoDto } from './create-momo.dto';

export class UpdateMomoDto extends PartialType(CreateMomoDto) {}
