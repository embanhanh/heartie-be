import { Injectable } from '@nestjs/common';
import { StatsCacheService } from './stats-cache.service';

const GLOBAL_PRODUCT_VIEWS_KEY = 'leaderboard:products:views';
const GLOBAL_ARTICLE_VIEWS_KEY = 'leaderboard:articles:views';

@Injectable()
export class StatsTrackingService {
  constructor(private readonly cache: StatsCacheService) {}

  async recordProductView(productId: number, branchId?: number | null): Promise<void> {
    if (!productId) {
      return;
    }

    const member = productId.toString();
    await this.cache.zincrby(GLOBAL_PRODUCT_VIEWS_KEY, 1, member);

    if (branchId) {
      await this.cache.zincrby(this.getBranchProductKey(branchId), 1, member);
    }
  }

  async recordArticleView(articleId: number): Promise<void> {
    if (!articleId) {
      return;
    }

    await this.cache.zincrby(GLOBAL_ARTICLE_VIEWS_KEY, 1, articleId.toString());
  }

  async getTopProducts(
    limit: number,
    branchId?: number,
  ): Promise<Array<{ id: number; views: number }>> {
    const key = branchId ? this.getBranchProductKey(branchId) : GLOBAL_PRODUCT_VIEWS_KEY;
    const entries = await this.cache.zrevrangeWithScores(key, limit);
    return entries.map((entry) => ({ id: Number(entry.member), views: entry.score }));
  }

  async getTopArticles(limit: number): Promise<Array<{ id: number; views: number }>> {
    const entries = await this.cache.zrevrangeWithScores(GLOBAL_ARTICLE_VIEWS_KEY, limit);
    return entries.map((entry) => ({ id: Number(entry.member), views: entry.score }));
  }

  private getBranchProductKey(branchId: number): string {
    return `${GLOBAL_PRODUCT_VIEWS_KEY}:branch:${branchId}`;
  }
}
