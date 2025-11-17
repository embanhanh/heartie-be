import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ReviewAnalysisService } from './review-analysis.service';
import { ReviewInsightQueryDto } from './dto/review-insight-query.dto';
import { ReviewInsightResponseDto } from './dto/review-insight-response.dto';
import { PaginatedResult } from 'src/common/dto/pagination.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Review Insights')
@ApiBearerAuth()
@Controller('admin/review-insights')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class ReviewInsightsController {
  constructor(private readonly reviewAnalysisService: ReviewAnalysisService) {}

  @Get()
  @ApiOkResponse({ type: ReviewInsightResponseDto, isArray: false })
  async list(
    @Query() query: ReviewInsightQueryDto,
  ): Promise<PaginatedResult<ReviewInsightResponseDto>> {
    return this.reviewAnalysisService.listInsights(query);
  }

  @Get(':ratingId')
  @ApiOkResponse({ type: ReviewInsightResponseDto })
  async getByRatingId(
    @Param('ratingId', ParseIntPipe) ratingId: number,
  ): Promise<ReviewInsightResponseDto> {
    const insight = await this.reviewAnalysisService.getInsightByRatingId(ratingId);

    if (!insight) {
      throw new NotFoundException(`Insight for rating ${ratingId} not found`);
    }

    return insight;
  }
}
