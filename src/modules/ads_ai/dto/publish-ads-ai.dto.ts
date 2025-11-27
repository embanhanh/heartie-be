import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class PublishAdsAiDto {
  @ApiPropertyOptional({ description: 'Ghi chú nội bộ hoặc nội dung tuỳ chỉnh sẽ đính kèm' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;
}
