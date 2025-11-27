import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class ScheduleAdsAiDto {
  @ApiProperty({ description: 'Thời điểm đăng quảng cáo', type: String, format: 'date-time' })
  @IsDateString()
  scheduledAt!: string;
}
