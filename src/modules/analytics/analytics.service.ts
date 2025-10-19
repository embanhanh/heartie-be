import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { InteractionType } from '../interactions/entities/interaction.entity';
import { ProductInteractionMetric } from './entities/product_interaction_metric.entity';

export interface RecordInteractionOptions {
  occurredAt?: Date;
}

export interface MetricQuery {
  productVariantId: number;
  from?: Date;
  to?: Date;
  metricTypes?: InteractionType[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(ProductInteractionMetric)
    private readonly metricRepository: Repository<ProductInteractionMetric>,
  ) {}

  async recordInteraction(
    productVariantId: number,
    metricType: InteractionType,
    options?: RecordInteractionOptions,
  ): Promise<void> {
    const occurredAt = options?.occurredAt ?? new Date();
    const metricDate = occurredAt.toISOString().slice(0, 10);

    await this.metricRepository
      .createQueryBuilder()
      .insert()
      .into(ProductInteractionMetric)
      .values({
        productVariantId,
        metricType,
        metricDate,
        count: 1,
      })
      .onConflict(
        '("productVariantId", "metricDate", "metricType") DO UPDATE SET count = product_interaction_metrics.count + EXCLUDED.count',
      )
      .execute();
  }

  async getMetrics(query: MetricQuery): Promise<ProductInteractionMetric[]> {
    const { productVariantId, from, to, metricTypes } = query;

    const where: Record<string, unknown> = {
      productVariantId,
    };

    if (from || to) {
      const start = from ?? new Date('1970-01-01');
      const end = to ?? new Date();
      where.metricDate = Between(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    }

    if (metricTypes?.length) {
      where.metricType = In(metricTypes);
    }

    return this.metricRepository.find({
      where,
      order: { metricDate: 'ASC' },
    });
  }

  async getTotals(
    productVariantId: number,
    since?: Date,
  ): Promise<Record<InteractionType, number>> {
    const qb = this.metricRepository
      .createQueryBuilder('metric')
      .select('metric.metricType', 'metricType')
      .addSelect('SUM(metric.count)', 'total')
      .where('metric.productVariantId = :productVariantId', { productVariantId });

    if (since) {
      qb.andWhere('metric.metricDate >= :sinceDate', {
        sinceDate: since.toISOString().slice(0, 10),
      });
    }

    qb.groupBy('metric.metricType');

    const rows = await qb.getRawMany<{ metricType: InteractionType; total: string }>();

    return rows.reduce<Record<InteractionType, number>>(
      (acc, row) => {
        acc[row.metricType] = Number(row.total);
        return acc;
      },
      {} as Record<InteractionType, number>,
    );
  }
}
