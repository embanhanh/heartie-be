import { PartialType } from '@nestjs/swagger';
import { CreatePromotionConditionDto } from './create-promotion-condition.dto';

export class UpdatePromotionConditionDto extends PartialType(CreatePromotionConditionDto) {}
