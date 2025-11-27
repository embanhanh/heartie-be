import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';
import { Rating } from './entities/rating.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { ReviewAnalysisModule } from '../review_analysis/review-analysis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Rating, Product, User]), ReviewAnalysisModule],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
