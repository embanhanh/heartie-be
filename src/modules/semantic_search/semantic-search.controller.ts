import { Controller, Get, Query } from '@nestjs/common';
import { SemanticSearchService } from './semantic-search.service';
import { SemanticSearchQueryDto } from './dto/semantic-search-query.dto';

@Controller('search')
export class SemanticSearchController {
  constructor(private readonly semanticSearchService: SemanticSearchService) {}

  @Get('semantic')
  async semanticSearch(@Query() query: SemanticSearchQueryDto) {
    return this.semanticSearchService.search(query);
  }
}
