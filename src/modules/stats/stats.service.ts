import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AdsAiCampaign } from '../ads_ai/entities/ads-ai-campaign.entity';
import { Branch } from '../branches/entities/branch.entity';
import { ProductVariantInventory } from '../inventory/entities/product-variant-inventory.entity';
import { OrderItem } from '../order_items/entities/order-item.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { LowStockQueryDto } from './dto/low-stock-query.dto';
import { OrderStatusQueryDto } from './dto/order-status-query.dto';
import { RevenueChartQueryDto } from './dto/revenue-chart-query.dto';
import { StatsOverviewQueryDto } from './dto/stats-overview-query.dto';
import { TopSellingQueryDto } from './dto/top-selling-query.dto';
import { DailyStatistic } from './entities/daily-statistic.entity';
import {
  LowStockProduct,
  OrderStatusSlice,
  RevenueChartPoint,
  StatsOverviewResponse,
  TopSellingProduct,
  TrendMetric,
  ViewLeaderboardItem,
} from './interfaces/stats.types';
import { StatsCacheService } from './services/stats-cache.service';
import { StatsTrackingService } from './services/stats-tracking.service';
import { EXCLUDED_ORDER_STATUSES } from './stats.constants';
import { computeTrend } from './utils/trend.util';

const STATUS_GROUPS: Record<string, { label: string; statuses: OrderStatus[] }> = {
  pending: {
    label: 'Đang xử lý',
    statuses: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING],
  },
  shipping: {
    label: 'Đang giao',
    statuses: [OrderStatus.SHIPPED],
  },
  completed: {
    label: 'Hoàn thành',
    statuses: [OrderStatus.DELIVERED],
  },
  cancelled: {
    label: 'Đã hủy',
    statuses: [OrderStatus.CANCELLED, OrderStatus.RETURNED],
  },
};

const ORDER_STATUS_TTL = 300;
const TOP_SELLING_TTL = 600;
const LOW_STOCK_TTL = 300;

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariantInventory)
    private readonly inventoryRepo: Repository<ProductVariantInventory>,
    @InjectRepository(AdsAiCampaign)
    private readonly adsRepo: Repository<AdsAiCampaign>,
    @InjectRepository(DailyStatistic)
    private readonly dailyStatsRepo: Repository<DailyStatistic>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    private readonly cache: StatsCacheService,
    private readonly tracking: StatsTrackingService,
  ) {}

  async getOverview(query: StatsOverviewQueryDto): Promise<StatsOverviewResponse> {
    const currentRange = this.resolveRange(query.from, query.to);
    const previousRange = this.shiftRange(currentRange);

    const [current, previous] = await Promise.all([
      this.aggregateOverview(currentRange.from, currentRange.to, query.branchId),
      this.aggregateOverview(previousRange.from, previousRange.to, query.branchId),
    ]);

    const revenue = this.toTrendMetric(current.revenue, previous.revenue);
    const orders = this.toTrendMetric(current.orders, previous.orders);
    const customers = this.toTrendMetric(current.customers, previous.customers);

    return { revenue, orders, customers };
  }

  async getRevenueChart(query: RevenueChartQueryDto): Promise<RevenueChartPoint[]> {
    const range = this.resolveRange(query.from, query.to, 14);
    const todayStart = this.startOfDay(new Date());
    const historicalEnd = new Date(Math.min(range.to.getTime(), todayStart.getTime() - 1));
    const pointsMap = new Map<string, RevenueChartPoint>();

    if (historicalEnd >= range.from) {
      const rows = await this.dailyStatsRepo
        .createQueryBuilder('stat')
        .where('stat.date BETWEEN :from AND :to', {
          from: this.formatDate(range.from),
          to: this.formatDate(historicalEnd),
        })
        .andWhere(query.branchId ? 'stat.branchId = :branchId' : 'stat.branchId IS NULL', {
          branchId: query.branchId ?? null,
        })
        .getMany();

      if (rows.length) {
        rows.forEach((row) => {
          pointsMap.set(row.date, {
            date: row.date,
            revenue: Number(row.totalRevenue ?? 0),
            orderCount: row.totalOrders ?? 0,
          });
        });
      } else {
        const fallbackRows = await this.liveRevenueByDay(range.from, historicalEnd, query.branchId);
        fallbackRows.forEach((row) => {
          pointsMap.set(row.date, row);
        });
      }
    }

    if (range.to >= todayStart) {
      const liveFrom = range.from > todayStart ? range.from : todayStart;
      const liveRows = await this.liveRevenueByDay(liveFrom, range.to, query.branchId);

      liveRows.forEach((row) => {
        pointsMap.set(row.date, row);
      });
    }

    const rawPoints = this.buildContinuousSeries(pointsMap, range.from, range.to);
    return this.maybeBucket(rawPoints, query.maxPoints, query.bucketDays);
  }

  async getOrderStatusBreakdown(query: OrderStatusQueryDto): Promise<OrderStatusSlice[]> {
    const range = this.resolveRange(query.from, query.to, 7);
    const cacheKey = this.cache.buildCacheKey([
      'order-status',
      query.branchId ?? 'all',
      range.from,
      range.to,
    ]);

    const cached = await this.cache.getJSON<OrderStatusSlice[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const rows = await this.orderRepo
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(order.id)', 'count')
      .where('order.createdAt BETWEEN :from AND :to', range)
      .andWhere(query.branchId ? 'order.branchId = :branchId' : '1=1', {
        branchId: query.branchId,
      })
      .groupBy('order.status')
      .getRawMany<{ status: OrderStatus; count: string }>();

    const response = Object.entries(STATUS_GROUPS).map(([key, group]) => {
      const value = rows
        .filter((row) => group.statuses.includes(row.status))
        .reduce((sum, row) => sum + Number(row.count ?? 0), 0);
      return { label: group.label, status: key, value };
    });

    await this.cache.setJSON(cacheKey, response, ORDER_STATUS_TTL);
    return response;
  }

  async getTopSellingProducts(query: TopSellingQueryDto): Promise<TopSellingProduct[]> {
    const range = this.resolveRange(query.from, query.to, 30);
    const limit = query.limit ?? 10;
    const cacheKey = this.cache.buildCacheKey([
      'top-selling',
      query.branchId ?? 'all',
      range.from,
      range.to,
      limit,
    ]);

    const cached = await this.cache.getJSON<TopSellingProduct[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const rows = await this.orderItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.variant', 'variant')
      .innerJoin('variant.product', 'product')
      .select('product.id', 'productId')
      .addSelect('product.name', 'name')
      .addSelect('product.image', 'image')
      .addSelect('SUM(item.quantity)', 'soldQuantity')
      .addSelect('SUM(item.totalAmount)', 'totalRevenue')
      .where('order.createdAt BETWEEN :from AND :to', range)
      .andWhere('order.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: EXCLUDED_ORDER_STATUSES,
      })
      .andWhere(query.branchId ? 'order.branchId = :branchId' : '1=1', {
        branchId: query.branchId,
      })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.image')
      .orderBy('SUM(item.quantity)', 'DESC')
      .addOrderBy('SUM(item.totalAmount)', 'DESC')
      .limit(limit)
      .getRawMany<TopSellingProduct>();

    const normalized = rows.map((row) => ({
      ...row,
      soldQuantity: Number(row.soldQuantity ?? 0),
      totalRevenue: Number(row.totalRevenue ?? 0),
    }));

    await this.cache.setJSON(cacheKey, normalized, TOP_SELLING_TTL);
    return normalized;
  }

  async getLowStockProducts(query: LowStockQueryDto): Promise<LowStockProduct[]> {
    const limit = query.limit ?? 10;
    const threshold = query.threshold ?? 5;
    const cacheKey = this.cache.buildCacheKey([
      'low-stock',
      query.branchId ?? 'all',
      threshold,
      limit,
    ]);

    const cached = await this.cache.getJSON<LowStockProduct[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const qb = this.inventoryRepo
      .createQueryBuilder('inventory')
      .innerJoin('inventory.variant', 'variant')
      .innerJoin('variant.product', 'product')
      .innerJoin('inventory.branch', 'branch')
      .select('product.id', 'productId')
      .addSelect('product.name', 'name')
      .addSelect('product.image', 'image')
      .addSelect('SUM(inventory.stock)', 'stock')
      .addSelect('inventory.branchId', 'branchId')
      .addSelect('branch.name', 'branchName')
      .addSelect('branch.address', 'branchAddress')
      .where(query.branchId ? 'inventory.branchId = :branchId' : '1=1', {
        branchId: query.branchId,
      })
      .groupBy('inventory.branchId')
      .addGroupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.image')
      .addGroupBy('branch.name')
      .addGroupBy('branch.address')
      .having('SUM(inventory.stock) <= :threshold', { threshold })
      .orderBy('SUM(inventory.stock)', 'ASC')
      .limit(limit);

    const rows = await qb.getRawMany<
      LowStockProduct & { branchName: string; branchAddress?: string | null }
    >();
    const normalized = rows.map((row) => ({
      ...row,
      stock: Number(row.stock ?? 0),
      branchId: row.branchId ? Number(row.branchId) : null,
      branchName: row.branchName ?? null,
      branchAddress: row.branchAddress ?? null,
    }));

    await this.cache.setJSON(cacheKey, normalized, LOW_STOCK_TTL);
    return normalized;
  }

  async getProductViewsLeaderboard(query: LeaderboardQueryDto): Promise<ViewLeaderboardItem[]> {
    const limit = query.limit ?? 10;
    const top = await this.tracking.getTopProducts(limit, query.branchId);
    if (!top.length) {
      return [];
    }

    const productMap = await this.loadProducts(top.map((item) => item.id));
    return top
      .filter((entry) => productMap.has(entry.id))
      .map((entry) => {
        const product = productMap.get(entry.id)!;
        return {
          id: entry.id,
          views: entry.views,
          name: product.name,
          image: product.image,
          type: 'product',
        };
      });
  }

  async getArticleViewsLeaderboard(query: LeaderboardQueryDto): Promise<ViewLeaderboardItem[]> {
    const limit = query.limit ?? 10;
    const top = await this.tracking.getTopArticles(limit);
    if (!top.length) {
      return [];
    }

    const articles = await this.adsRepo.find({
      where: { id: In(top.map((entry) => entry.id)) },
    });
    const articleMap = new Map(articles.map((article) => [article.id, article]));

    return top
      .filter((entry) => articleMap.has(entry.id))
      .map((entry) => {
        const article = articleMap.get(entry.id)!;
        return {
          id: entry.id,
          views: entry.views,
          name: article.name,
          image: article.image ?? undefined,
          type: 'article',
        };
      });
  }

  private async aggregateOverview(from: Date, to: Date, branchId?: number | null) {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .select(
        `
        COALESCE(
          SUM(
            CASE
              WHEN "order"."status" = :completedStatus THEN "order"."totalAmount"
              ELSE 0
            END
          ),
          0
        )
      `,
        'revenue',
      )
      .addSelect('COUNT(order.id)', 'orders')
      .addSelect('COUNT(DISTINCT order.userId)', 'customers')
      .where('order.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('order.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: EXCLUDED_ORDER_STATUSES,
      });

    if (branchId) {
      qb.andWhere('order.branchId = :branchId', { branchId });
    }

    const aggregates = await qb.setParameter('completedStatus', OrderStatus.DELIVERED).getRawOne<{
      revenue: string;
      orders: string;
      customers: string;
    }>();

    return {
      revenue: Number(aggregates?.revenue ?? 0),
      orders: Number(aggregates?.orders ?? 0),
      customers: Number(aggregates?.customers ?? 0),
    };
  }

  private toTrendMetric(value: number, previousValue: number): TrendMetric {
    return computeTrend({ value, previousValue });
  }

  private resolveRange(from?: Date, to?: Date, fallbackDays = 1): { from: Date; to: Date } {
    const now = new Date();
    const start = from
      ? this.startOfDay(from)
      : this.startOfDay(this.addDays(now, -fallbackDays + 1));
    const end = to ? this.endOfDay(to) : this.endOfDay(now);

    return { from: start, to: end };
  }

  private shiftRange(range: { from: Date; to: Date }) {
    const diff = range.to.getTime() - range.from.getTime();
    const newTo = new Date(range.from.getTime() - 1);
    const newFrom = new Date(newTo.getTime() - diff);
    return { from: newFrom, to: newTo };
  }

  private startOfDay(input: Date): Date {
    const date = new Date(input);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(input: Date): Date {
    const date = new Date(input);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private formatDate(input: Date): string {
    return input.toISOString().slice(0, 10);
  }

  private addDays(input: Date, amount: number): Date {
    const date = new Date(input);
    date.setDate(date.getDate() + amount);
    return date;
  }

  private async liveRevenueByDay(from: Date, to: Date, branchId?: number | null) {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .select("TO_CHAR(order.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('SUM(order.totalAmount)', 'revenue')
      .addSelect('COUNT(order.id)', 'orderCount')
      .where('order.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('order.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: EXCLUDED_ORDER_STATUSES,
      })
      .groupBy("TO_CHAR(order.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC');

    if (branchId) {
      qb.andWhere('order.branchId = :branchId', { branchId });
    }

    const rows = await qb.getRawMany<RevenueChartPoint>();
    return rows.map((row) => ({
      date: row.date,
      revenue: Number(row.revenue ?? 0),
      orderCount: Number(row.orderCount ?? 0),
    }));
  }

  private buildContinuousSeries(
    pointsMap: Map<string, RevenueChartPoint>,
    from: Date,
    to: Date,
  ): RevenueChartPoint[] {
    const cursor = new Date(from);
    const results: RevenueChartPoint[] = [];

    while (cursor <= to) {
      const key = this.formatDate(cursor);
      results.push(
        pointsMap.get(key) ?? {
          date: key,
          revenue: 0,
          orderCount: 0,
        },
      );
      cursor.setDate(cursor.getDate() + 1);
    }

    return results;
  }

  private maybeBucket(
    points: RevenueChartPoint[],
    maxPoints?: number,
    bucketDays?: number,
  ): RevenueChartPoint[] {
    const effectiveMax = maxPoints ?? points.length;
    const effectiveBucket = bucketDays ?? Math.max(1, Math.ceil(points.length / effectiveMax));

    if (effectiveBucket <= 1) {
      return points;
    }

    const bucketed: RevenueChartPoint[] = [];

    for (let i = 0; i < points.length; i += effectiveBucket) {
      const slice = points.slice(i, i + effectiveBucket);
      bucketed.push({
        date: slice[0]?.date ?? '',
        revenue: slice.reduce((sum, point) => sum + point.revenue, 0),
        orderCount: slice.reduce((sum, point) => sum + point.orderCount, 0),
      });
    }

    return bucketed;
  }

  private async loadProducts(ids: number[]): Promise<Map<number, Product>> {
    const products = await this.productRepo.find({ where: { id: In(ids) } });
    return new Map(products.map((product) => [product.id, product]));
  }
}
