import { PartialType } from '@nestjs/swagger';
import { CreatePromotionCustomerGroupDto } from './create-promotion-customer-group.dto';

export class UpdatePromotionCustomerGroupDto extends PartialType(CreatePromotionCustomerGroupDto) {}
