import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SemanticSearchService } from './semantic-search.service';
import { SemanticSearchController } from './semantic-search.controller';
import { Product } from '../products/entities/product.entity';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), GeminiModule],
  controllers: [SemanticSearchController],
  providers: [SemanticSearchService],
  exports: [SemanticSearchService],
})
export class SemanticSearchModule {}
