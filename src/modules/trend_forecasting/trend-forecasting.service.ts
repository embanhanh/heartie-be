import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderItem } from '../order_items/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { ReviewInsight } from '../review_analysis/entities/review-insight.entity';
import { Interaction, InteractionType } from '../interactions/entities/interaction.entity';

import { TrendForecastQueryDto, TrendGranularity } from './dto/trend-forecast-query.dto';
import { TrendForecastResponseDto } from './dto/trend-forecast-response.dto';

import { DailyStatistic } from '../stats/entities/daily-statistic.entity';

type NumericRecord = Record<string, string | number | Date | null>;

type TrendDirection = 'rising' | 'stable' | 'declining';

interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number | null;
  forecast: number[];
}

interface TimeSeriesPoint {
  period: Date;
  revenue: number;
  orderCount: number;
  unitsSold: number;
}

@Injectable()
export class TrendForecastingService {
  private readonly logger = new Logger(TrendForecastingService.name);

  constructor(
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ReviewInsight)
    private readonly reviewInsightRepository: Repository<ReviewInsight>,
    @InjectRepository(Interaction)
    private readonly interactionRepository: Repository<Interaction>,

    @InjectRepository(DailyStatistic)
    private readonly dailyStatsRepository: Repository<DailyStatistic>,
  ) {}

  async getSalesForecast(query: TrendForecastQueryDto): Promise<TrendForecastResponseDto> {
    const granularity = query.granularity ?? 'week';
    const lookbackMonths = query.lookbackMonths ?? 3;
    const forecastPeriods = query.forecastPeriods ?? 4;

    const now = new Date();
    const lookbackStart = this.subtractMonths(now, lookbackMonths);
    lookbackStart.setHours(0, 0, 0, 0);

    const rawSeries = await this.loadTimeSeries({
      granularity,
      startDate: lookbackStart,
      productId: query.productId,
      categoryId: query.categoryId,
      branchId: query.branchId,
    });

    if (!rawSeries.length) {
      return this.buildEmptyResponse({ granularity, lookbackMonths, forecastPeriods });
    }

    const revenueSeries = rawSeries.map((point) => point.revenue);
    const ordersSeries = rawSeries.map((point) => point.orderCount);
    const unitsSeries = rawSeries.map((point) => point.unitsSold);

    const revenueRegression = this.computeRegression(revenueSeries, forecastPeriods);
    const ordersRegression = this.computeRegression(ordersSeries, forecastPeriods);
    const unitsRegression = this.computeRegression(unitsSeries, forecastPeriods);

    const timeSeriesDto = rawSeries.map((point) => ({
      period: point.period.toISOString(),
      revenue: point.revenue,
      orderCount: point.orderCount,
      unitsSold: point.unitsSold,
      averageOrderValue: point.orderCount > 0 ? point.revenue / point.orderCount : 0,
    }));

    const lastPeriod = rawSeries[rawSeries.length - 1].period;
    const forecastPoints = this.buildForecastPoints({
      lastPeriod,
      granularity,
      forecastPeriods,
      revenueForecast: revenueRegression.forecast,
      ordersForecast: ordersRegression.forecast,
      unitsForecast: unitsRegression.forecast,
    });

    const { sentimentScore, sentimentBreakdown } = await this.computeSentimentSignals({
      startDate: lookbackStart,
      productId: query.productId,
      categoryId: query.categoryId,
    });

    const topProducts = await this.computeTopProducts({
      startDate: lookbackStart,
      granularity,
      productId: query.productId,
      categoryId: query.categoryId,
      branchId: query.branchId,
    });

    const engagementSignals = await this.computeEngagementSignals({
      startDate: lookbackStart,
      productId: query.productId,
      categoryId: query.categoryId,
    });

    const summary = this.buildSummary({
      revenueRegression,
      ordersRegression,
      unitsRegression,
      timeSeries: rawSeries,
      forecastPoints,
      sentimentScore,
      topProducts,
    });

    const diagnostics = {
      dataPoints: rawSeries.length,
      revenueSlope: revenueRegression.slope,
      ordersSlope: ordersRegression.slope,
      unitsSlope: unitsRegression.slope,
      revenueRSquared: revenueRegression.rSquared ?? undefined,
      ordersRSquared: ordersRegression.rSquared ?? undefined,
      unitsRSquared: unitsRegression.rSquared ?? undefined,
    };

    return {
      granularity,
      generatedAt: new Date().toISOString(),
      lookbackMonths,
      forecastPeriods,
      timeSeries: timeSeriesDto,
      forecast: forecastPoints,
      summary,
      signals: {
        sentimentScore,
        sentimentBreakdown,
        topProducts,
        engagementSignals,
      },
      diagnostics,
    };
  }

  private async loadTimeSeries(params: {
    granularity: TrendGranularity;
    startDate: Date;
    productId?: number;
    categoryId?: number;
    branchId?: number;
  }): Promise<TimeSeriesPoint[]> {
    const { granularity, startDate, productId, categoryId, branchId } = params;
    const isGlobal = !productId && !categoryId;

    // We use Order status list that matches dashboard (non-cancelled, non-returned)
    const statuses = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    if (isGlobal) {
      // Use DailyStatistic table for global/branch analytics (source of truth)
      const historicalPoints = await this.loadHistoricalStats(granularity, startDate, branchId);

      // Check if we need live data for "today"
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const livePoints: TimeSeriesPoint[] = [];
      if (startDate <= today) {
        livePoints.push(...(await this.loadLiveStats(granularity, today, branchId)));
      }

      // Merge points by period
      const mergedMap = new Map<string, TimeSeriesPoint>();
      [...historicalPoints, ...livePoints].forEach((p) => {
        const key = p.period.toISOString();
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key)!;
          // In case of overlap, historical (pre-aggregated) might be more stable or live might be more current.
          // Usually stats cron runs for PAST days, so live only has today.
          mergedMap.set(key, {
            ...existing,
            revenue: Math.max(existing.revenue, p.revenue),
            orderCount: Math.max(existing.orderCount, p.orderCount),
            unitsSold: Math.max(existing.unitsSold, p.unitsSold),
          });
        } else {
          mergedMap.set(key, p);
        }
      });

      return Array.from(mergedMap.values()).sort((a, b) => a.period.getTime() - b.period.getTime());
    }

    // For product/category specific queries, we MUST use OrderItem to filter correctly
    const dateTrunc = this.getDateTruncExpression(granularity, 'order.createdAt');
    const qb = this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .leftJoin('item.variant', 'variant')
      .leftJoin('variant.product', 'product')
      .select(`${dateTrunc}`, 'period')
      .addSelect('SUM(item.totalAmount)', 'revenue')
      .addSelect('COUNT(DISTINCT order.id)', 'orderCount')
      .addSelect('SUM(item.quantity)', 'unitsSold')
      .where('order.status IN (:...statuses)', { statuses })
      .andWhere('order.createdAt >= :startDate', { startDate: startDate.toISOString() })
      .groupBy('period')
      .orderBy('period', 'ASC');

    if (branchId) {
      qb.andWhere('order.branchId = :branchId', { branchId });
    }

    if (productId) {
      qb.andWhere('variant.productId = :productId', { productId });
    }

    if (categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    const rows = await qb.getRawMany<NumericRecord>();

    return rows.map((row) => ({
      period: new Date(row.period as string),
      revenue: this.asNumber(row.revenue),
      orderCount: this.asNumber(row.orderCount),
      unitsSold: this.asNumber(row.unitsSold),
    }));
  }

  private async loadHistoricalStats(
    granularity: TrendGranularity,
    startDate: Date,
    branchId?: number,
  ): Promise<TimeSeriesPoint[]> {
    const qb = this.dailyStatsRepository.createQueryBuilder('stat');

    // DailyStatistic table has 'date' column as string YYYY-MM-DD
    // Granularity handling: for 'day', we use as is. For 'week'/'month', we might need to truncate.
    // However, DailyStatistic is ALREADY daily. We can aggregate it by granularity.
    const dateTrunc = this.getDateTruncExpression(granularity, 'stat.date::timestamp');

    qb.select(`${dateTrunc}`, 'period')
      .addSelect('SUM(stat.totalRevenue)', 'revenue')
      .addSelect('SUM(stat.totalOrders)', 'orderCount')
      .addSelect('SUM(stat.totalProductsSold)', 'unitsSold')
      .where('stat.date >= :startDate', { startDate: startDate.toISOString().slice(0, 10) });

    if (branchId) {
      qb.andWhere('stat.branchId = :branchId', { branchId });
    } else {
      qb.andWhere('stat.branchId IS NULL');
    }

    qb.groupBy('period').orderBy('period', 'ASC');

    const rows = await qb.getRawMany<NumericRecord>();
    return rows.map((row) => ({
      period: new Date(row.period as string),
      revenue: this.asNumber(row.revenue),
      orderCount: this.asNumber(row.orderCount),
      unitsSold: this.asNumber(row.unitsSold),
    }));
  }

  private async loadLiveStats(
    granularity: TrendGranularity,
    today: Date,
    branchId?: number,
  ): Promise<TimeSeriesPoint[]> {
    // Current day live data from Order table
    const dateTrunc = this.getDateTruncExpression(granularity, 'order.createdAt');
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.items', 'item')
      .select(`${dateTrunc}`, 'period')
      .addSelect('SUM(DISTINCT order.totalAmount)', 'revenue')
      .addSelect('COUNT(DISTINCT order.id)', 'orderCount')
      .addSelect('SUM(item.quantity)', 'unitsSold')
      .where('order.createdAt >= :today', { today: today.toISOString() })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [
          OrderStatus.PENDING,
          OrderStatus.CONFIRMED,
          OrderStatus.PROCESSING,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
        ],
      });

    if (branchId) {
      qb.andWhere('order.branchId = :branchId', { branchId });
    }

    qb.groupBy('period');

    const rows = await qb.getRawMany<NumericRecord>();
    return rows.map((row) => ({
      period: new Date(row.period as string),
      revenue: this.asNumber(row.revenue),
      orderCount: this.asNumber(row.orderCount),
      unitsSold: this.asNumber(row.unitsSold),
    }));
  }

  private async computeSentimentSignals(params: {
    startDate: Date;
    productId?: number;
    categoryId?: number;
  }): Promise<{
    sentimentScore: number;
    sentimentBreakdown: { positive: number; neutral: number; negative: number };
  }> {
    const { startDate, productId, categoryId } = params;

    const qb = this.reviewInsightRepository
      .createQueryBuilder('insight')
      .innerJoin('insight.rating', 'rating')
      .leftJoin('rating.product', 'product')
      .select('insight.sentiment', 'sentiment')
      .addSelect('COUNT(*)', 'count')
      .where('rating.createdAt >= :startDate', { startDate: startDate.toISOString() })
      .groupBy('insight.sentiment');

    if (productId) {
      qb.andWhere('rating.productId = :productId', { productId });
    }

    if (categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    const rows = await qb.getRawMany<{ sentiment: string; count: string }>();

    const totals = rows.reduce(
      (acc, row) => {
        const count = Number(row.count);
        acc[row.sentiment as 'positive' | 'neutral' | 'negative'] += count;
        acc.total += count;
        return acc;
      },
      { positive: 0, neutral: 0, negative: 0, total: 0 },
    );

    if (!totals.total) {
      return {
        sentimentScore: 0,
        sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
      };
    }

    const sentimentScore = (totals.positive - totals.negative) / totals.total;

    return {
      sentimentScore,
      sentimentBreakdown: {
        positive: totals.positive / totals.total,
        neutral: totals.neutral / totals.total,
        negative: totals.negative / totals.total,
      },
    };
  }

  private async computeTopProducts(params: {
    startDate: Date;
    granularity: TrendGranularity;
    productId?: number;
    categoryId?: number;
    branchId?: number;
  }): Promise<{ productId: number; name: string; revenue: number; revenueShare: number }[]> {
    const { startDate, productId, categoryId, branchId } = params;
    const qb = this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .leftJoin('item.variant', 'variant')
      .leftJoin('variant.product', 'product')
      .select('product.id', 'productId')
      .addSelect('product.name', 'name')
      .addSelect('SUM(item.totalAmount)', 'revenue')
      .where('order.createdAt >= :startDate', { startDate: startDate.toISOString() })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [
          OrderStatus.CONFIRMED,
          OrderStatus.PROCESSING,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
        ],
      })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .orderBy('revenue', 'DESC')
      .limit(5);

    if (branchId) {
      qb.andWhere('order.branchId = :branchId', { branchId });
    }

    if (productId) {
      qb.andWhere('product.id = :productId', { productId });
    }

    if (categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    const rows = await qb.getRawMany<{ productId: number; name: string; revenue: string }>();

    const totalRevenue = rows.reduce((acc, row) => acc + Number(row.revenue ?? 0), 0);

    if (!rows.length || !totalRevenue) {
      return rows.map((row) => ({
        productId: Number(row.productId),
        name: row.name,
        revenue: Number(row.revenue ?? 0),
        revenueShare: 0,
      }));
    }

    return rows.map((row) => ({
      productId: Number(row.productId),
      name: row.name,
      revenue: Number(row.revenue ?? 0),
      revenueShare: Number(row.revenue ?? 0) / totalRevenue,
    }));
  }

  private async computeEngagementSignals(params: {
    startDate: Date;
    productId?: number;
    categoryId?: number;
  }): Promise<{ metric: string; count: number }[]> {
    const { startDate, productId, categoryId } = params;

    const qb = this.interactionRepository
      .createQueryBuilder('interaction')
      .leftJoin('interaction.product', 'product')
      .select('interaction.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('interaction.createdAt >= :startDate', { startDate: startDate.toISOString() })
      .groupBy('interaction.type');

    if (productId) {
      qb.andWhere('product.id = :productId', { productId });
    }

    if (categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    const rows = await qb.getRawMany<{ type: InteractionType; count: string }>();

    const friendlyNames: Record<InteractionType, string> = {
      [InteractionType.VIEW]: 'Lượt xem',
      [InteractionType.CLICK]: 'Lượt click',
      [InteractionType.LIKE]: 'Lượt thích',
      [InteractionType.UNLIKE]: 'Bỏ thích',
      [InteractionType.ADD_TO_CART]: 'Thêm vào giỏ',
      [InteractionType.REMOVE_FROM_CART]: 'Bỏ khỏi giỏ',
      [InteractionType.ADD_TO_WISHLIST]: 'Thêm wishlist',
      [InteractionType.REMOVE_FROM_WISHLIST]: 'Bỏ wishlist',
      [InteractionType.SHARE]: 'Chia sẻ',
      [InteractionType.SEARCH]: 'Tìm kiếm',
      [InteractionType.FILTER]: 'Lọc',
      [InteractionType.COMPARE]: 'So sánh',
      [InteractionType.RATING]: 'Đánh giá',
      [InteractionType.PURCHASE]: 'Mua hàng',
    };

    return rows.map((row) => ({
      metric: friendlyNames[row.type] ?? row.type,
      count: Number(row.count ?? 0),
    }));
  }

  private buildForecastPoints(params: {
    lastPeriod: Date;
    granularity: TrendGranularity;
    forecastPeriods: number;
    revenueForecast: number[];
    ordersForecast: number[];
    unitsForecast: number[];
  }): TrendForecastResponseDto['forecast'] {
    const {
      lastPeriod,
      granularity,
      forecastPeriods,
      revenueForecast,
      ordersForecast,
      unitsForecast,
    } = params;

    const forecast: TrendForecastResponseDto['forecast'] = [];

    for (let i = 1; i <= forecastPeriods; i += 1) {
      const periodDate = this.addPeriods(lastPeriod, granularity, i);
      const expectedRevenue = this.toPositive(revenueForecast[i - 1] ?? 0);
      const expectedOrders = this.toPositive(ordersForecast[i - 1] ?? 0);
      const expectedUnits = this.toPositive(unitsForecast[i - 1] ?? 0);
      forecast.push({
        period: periodDate.toISOString(),
        expectedRevenue,
        expectedOrders,
        expectedUnits,
        expectedAverageOrderValue:
          expectedOrders > 0 ? expectedRevenue / expectedOrders : expectedRevenue,
      });
    }

    return forecast;
  }

  private buildSummary(params: {
    revenueRegression: LinearRegressionResult;
    ordersRegression: LinearRegressionResult;
    unitsRegression: LinearRegressionResult;
    timeSeries: TimeSeriesPoint[];
    forecastPoints: TrendForecastResponseDto['forecast'];
    sentimentScore: number;
    topProducts: { productId: number; name: string; revenue: number; revenueShare: number }[];
  }): TrendForecastResponseDto['summary'] {
    const {
      revenueRegression,
      ordersRegression,
      unitsRegression,
      timeSeries,
      forecastPoints,
      sentimentScore,
      topProducts,
    } = params;

    const revenueTrend = this.toTrendDirection(
      revenueRegression.slope,
      revenueRegression.forecast,
      timeSeries.map((p) => p.revenue),
    );
    const ordersTrend = this.toTrendDirection(
      ordersRegression.slope,
      ordersRegression.forecast,
      timeSeries.map((p) => p.orderCount),
    );
    const unitsTrend = this.toTrendDirection(
      unitsRegression.slope,
      unitsRegression.forecast,
      timeSeries.map((p) => p.unitsSold),
    );

    const nextRevenue = forecastPoints[0]?.expectedRevenue ?? 0;
    const lastRevenue = timeSeries[timeSeries.length - 1]?.revenue ?? 0;
    const expectedRevenueGrowthRate =
      lastRevenue > 0 ? (nextRevenue - lastRevenue) / lastRevenue : 0;

    const topProductNames = topProducts.slice(0, 3).map((p) => p.name);
    const narrativeParts = [
      revenueTrend === 'rising'
        ? 'Doanh thu đang tăng, hãy chuẩn bị tồn kho và nhân sự phục vụ nhu cầu.'
        : revenueTrend === 'declining'
          ? 'Doanh thu đang giảm, cần rà soát khuyến mãi và lý do khách rời bỏ.'
          : 'Doanh thu ổn định, có thể thử nghiệm chiến dịch kích cầu nhẹ.',
    ];

    if (sentimentScore < -0.2) {
      narrativeParts.push(
        'Cảnh báo: sentiment khách hàng đang tiêu cực, cần xử lý phản hồi nhanh.',
      );
    } else if (sentimentScore > 0.3) {
      narrativeParts.push(
        'Khách hàng phản hồi rất tích cực, tận dụng để upsell các sản phẩm liên quan.',
      );
    }

    if (topProductNames.length) {
      narrativeParts.push(`Nhóm sản phẩm dẫn đầu: ${topProductNames.join(', ')}.`);
    }

    const recommendedActions: string[] = [];
    if (revenueTrend === 'rising' && sentimentScore >= 0) {
      recommendedActions.push('Đẩy mạnh quảng cáo cho sản phẩm bán chạy và bảo đảm tồn kho.');
    }
    if (ordersTrend === 'declining') {
      recommendedActions.push('Triển khai giảm giá hoặc combo để kích cầu đơn hàng.');
    }
    if (sentimentScore < 0) {
      recommendedActions.push('Theo dõi phản hồi tiêu cực và phối hợp CSKH xử lý trong 24h.');
    }

    const riskAlerts: string[] = [];
    if (sentimentScore < -0.2) {
      riskAlerts.push('Sentiment tiêu cực có thể ảnh hưởng chuyển đổi, cần điều chỉnh ngay.');
    }
    if (ordersTrend === 'declining' && sentimentScore <= 0) {
      riskAlerts.push(
        'Đơn hàng giảm và không có tín hiệu hài lòng mới, hãy xem xét chiến dịch tái kích hoạt.',
      );
    }

    return {
      revenueTrend,
      ordersTrend,
      unitsTrend,
      expectedRevenueGrowthRate,
      expectedNextRevenue: nextRevenue,
      narrative: narrativeParts.join(' '),
      recommendedActions: recommendedActions.length ? recommendedActions : undefined,
      riskAlerts: riskAlerts.length ? riskAlerts : undefined,
    };
  }

  private computeRegression(values: number[], horizon: number): LinearRegressionResult {
    if (values.length <= 1) {
      const value = values[0] ?? 0;
      return {
        slope: 0,
        intercept: value,
        rSquared: null,
        forecast: Array.from({ length: horizon }, () => value),
      };
    }

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((acc, val) => acc + val, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    const sumXY = values.reduce((acc, val, idx) => acc + idx * val, 0);

    const denominator = n * sumXX - sumX * sumX;
    const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    const meanY = sumY / n;
    let ssTot = 0;
    let ssRes = 0;
    values.forEach((y, idx) => {
      const predicted = intercept + slope * idx;
      ssTot += (y - meanY) * (y - meanY);
      ssRes += (y - predicted) * (y - predicted);
    });

    const rSquared = ssTot === 0 ? null : 1 - ssRes / ssTot;

    const forecast: number[] = [];
    const lastIndex = n - 1;
    for (let i = 1; i <= horizon; i += 1) {
      const x = lastIndex + i;
      forecast.push(intercept + slope * x);
    }

    return { slope, intercept, rSquared, forecast };
  }

  private buildEmptyResponse(params: {
    granularity: TrendGranularity;
    lookbackMonths: number;
    forecastPeriods: number;
  }): TrendForecastResponseDto {
    return {
      granularity: params.granularity,
      generatedAt: new Date().toISOString(),
      lookbackMonths: params.lookbackMonths,
      forecastPeriods: params.forecastPeriods,
      timeSeries: [],
      forecast: [],
      summary: {
        revenueTrend: 'stable',
        ordersTrend: 'stable',
        unitsTrend: 'stable',
        expectedRevenueGrowthRate: 0,
        expectedNextRevenue: 0,
        narrative: 'Chưa có dữ liệu đủ để phân tích xu hướng.',
      },
      signals: {
        sentimentScore: 0,
        sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
        topProducts: [],
        engagementSignals: [],
      },
      diagnostics: {
        dataPoints: 0,
        revenueSlope: 0,
        ordersSlope: 0,
        unitsSlope: 0,
      },
    };
  }

  private getDateTruncExpression(granularity: TrendGranularity, column: string): string {
    if (!['day', 'week', 'month'].includes(granularity)) {
      throw new Error(`Unsupported granularity: ${granularity}`);
    }
    return `DATE_TRUNC('${granularity}', ${column})`;
  }

  private addPeriods(base: Date, granularity: TrendGranularity, offset: number): Date {
    const date = new Date(base.getTime());
    if (granularity === 'day') {
      date.setDate(date.getDate() + offset);
    } else if (granularity === 'week') {
      date.setDate(date.getDate() + offset * 7);
    } else {
      date.setMonth(date.getMonth() + offset);
    }
    return date;
  }

  private subtractMonths(base: Date, months: number): Date {
    const date = new Date(base.getTime());
    date.setMonth(date.getMonth() - months);
    return date;
  }

  private asNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    }
    return 0;
  }

  private toPositive(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return value < 0 ? 0 : value;
  }

  private toTrendDirection(slope: number, forecast: number[], history: number[]): TrendDirection {
    const average = history.length ? history.reduce((acc, v) => acc + v, 0) / history.length : 0;
    const normalizedSlope = average ? slope / average : slope;

    if (normalizedSlope > 0.05) {
      return 'rising';
    }
    if (normalizedSlope < -0.05) {
      return 'declining';
    }

    const lastForecast = forecast[forecast.length - 1] ?? 0;
    if (average === 0 && lastForecast > 0) {
      return 'rising';
    }

    return 'stable';
  }
}
