import { ApiProperty } from '@nestjs/swagger';
import { ReviewSentiment } from '../entities/review-insight.entity';

export class ReviewInsightResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  ratingId: number;

  @ApiProperty({ enum: ['positive', 'negative', 'neutral'] })
  sentiment: ReviewSentiment;

  @ApiProperty({ type: [String] })
  keyTopics: string[];

  @ApiProperty()
  summary: string;

  @ApiProperty({ required: false, type: Object })
  rawResponse?: Record<string, unknown> | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
