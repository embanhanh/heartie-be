import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AiCustomerService, AiCustomerManifestResponse } from './ai-customer.service';
import { ProactiveStylistRequestDto, ProactiveStylistResponse } from './dto/proactive-stylist.dto';
import { CartAnalysisRequestDto, CartAnalysisResponse } from './dto/cart-analysis.dto';
import { ProductSummaryRequestDto, ProductSummaryResponse } from './dto/product-summary.dto';
import { ReviewsSummaryRequestDto, ReviewsSummaryResponse } from './dto/reviews-summary.dto';

@Controller('ai/customer')
export class AiCustomerController {
  constructor(private readonly aiCustomerService: AiCustomerService) {}

  @Get('manifest')
  getManifest(): AiCustomerManifestResponse {
    return this.aiCustomerService.getManifest();
  }

  @Post('proactive-stylist')
  @HttpCode(HttpStatus.OK)
  generateProactiveStylistSuggestions(
    @Body() payload: ProactiveStylistRequestDto,
  ): Promise<ProactiveStylistResponse> {
    return this.aiCustomerService.generateProactiveStylistSuggestions(payload);
  }

  @Post('analyze-cart')
  @HttpCode(HttpStatus.OK)
  analyzeCart(@Body() payload: CartAnalysisRequestDto): Promise<CartAnalysisResponse> {
    return this.aiCustomerService.analyzeCart(payload);
  }

  @Post('product-summary')
  @HttpCode(HttpStatus.OK)
  async productSummary(@Body() payload: ProductSummaryRequestDto): Promise<ProductSummaryResponse> {
    return this.aiCustomerService.generateProductSummary(payload);
  }

  @Post('reviews-summary')
  @HttpCode(HttpStatus.OK)
  async reviewsSummary(@Body() payload: ReviewsSummaryRequestDto): Promise<ReviewsSummaryResponse> {
    return this.aiCustomerService.generateReviewsSummary(payload);
  }
}
