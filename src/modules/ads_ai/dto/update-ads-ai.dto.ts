import { PartialType } from '@nestjs/mapped-types';
import { CreateAdsAiDto } from './create-ads-ai.dto';

export class UpdateAdsAiDto extends PartialType(CreateAdsAiDto) {}
