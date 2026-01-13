import { Module, forwardRef } from '@nestjs/common';
import { RatingsModule } from '../ratings/ratings.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ReviewAnalysisService } from './review-analysis.service';
import { ReviewInsight } from './entities/review-insight.entity';
import { Rating } from '../ratings/entities/rating.entity';
import { REVIEW_ANALYSIS_QUEUE } from './review-analysis.constants';
import { ReviewAnalysisProcessor } from './review-analysis.processor';
import { ReviewInsightsController } from './review-insights.controller';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewInsight, Rating]),
    BullModule.registerQueue({
      name: REVIEW_ANALYSIS_QUEUE,
    }),

    AuthModule,
    forwardRef(() => RatingsModule),
  ],
  providers: [ReviewAnalysisService, ReviewAnalysisProcessor],
  controllers: [ReviewInsightsController],
  exports: [ReviewAnalysisService],
})
export class ReviewAnalysisModule {}
