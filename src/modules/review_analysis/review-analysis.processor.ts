import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ReviewAnalysisService } from './review-analysis.service';
import { REVIEW_ANALYSIS_QUEUE } from './review-analysis.constants';
import { AnalyzeReviewJobPayload } from './dto/analyze-review-job.dto';

@Injectable()
@Processor(REVIEW_ANALYSIS_QUEUE)
export class ReviewAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewAnalysisProcessor.name);

  constructor(private readonly reviewAnalysisService: ReviewAnalysisService) {
    super();
  }

  async process(job: Job<AnalyzeReviewJobPayload>): Promise<void> {
    await this.reviewAnalysisService.analyzeAndPersist(job.data.ratingId);
  }

  onFail(job: Job<AnalyzeReviewJobPayload> | undefined, error: Error): void {
    if (!job) {
      this.logger.error(
        `Review analysis job failed without job context: ${error.message}`,
        error.stack,
      );
      return;
    }

    this.logger.error(
      `Review analysis job ${job.id} for rating ${job.data.ratingId} failed: ${error.message}`,
      error.stack,
    );
  }
}
