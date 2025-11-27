import { PartialType } from '@nestjs/swagger';
import { CreatePromotionBranchDto } from './create-promotion-branch.dto';

export class UpdatePromotionBranchDto extends PartialType(CreatePromotionBranchDto) {}
