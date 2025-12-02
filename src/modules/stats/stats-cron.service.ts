import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Order } from '../orders/entities/order.entity';
import { DailyStatistic } from './entities/daily-statistic.entity';
import { EXCLUDED_ORDER_STATUSES } from './stats.constants';

interface AggregateRow {
  branchId: number | null;
  totalRevenue: string;
  totalOrders: string;
  totalCustomers: string;
  totalProductsSold: string;
}

@Injectable()
export class StatsCronService {
  private readonly logger = new Logger(StatsCronService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(DailyStatistic)
    private readonly dailyStatsRepo: Repository<DailyStatistic>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailySnapshot() {
    const target = this.addDays(this.startOfDay(new Date()), -1);
    await this.buildSnapshot(target).catch((error) => {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to build daily stats: ${reason}`);
    });
  }

  async buildSnapshot(targetDate: Date) {
    const start = this.startOfDay(targetDate);
    const end = this.endOfDay(targetDate);

    const branchRows = await this.orderRepo
      .createQueryBuilder('order')
      .leftJoin('order.items', 'item')
      .select('order.branchId', 'branchId')
      .addSelect('SUM(order.totalAmount)', 'totalRevenue')
      .addSelect('COUNT(order.id)', 'totalOrders')
      .addSelect('COUNT(DISTINCT order.userId)', 'totalCustomers')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'totalProductsSold')
      .where('order.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere('order.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: EXCLUDED_ORDER_STATUSES,
      })
      .groupBy('order.branchId')
      .getRawMany<AggregateRow>();

    const globalRow = await this.orderRepo
      .createQueryBuilder('order')
      .leftJoin('order.items', 'item')
      .select('SUM(order.totalAmount)', 'totalRevenue')
      .addSelect('COUNT(order.id)', 'totalOrders')
      .addSelect('COUNT(DISTINCT order.userId)', 'totalCustomers')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'totalProductsSold')
      .where('order.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere('order.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: EXCLUDED_ORDER_STATUSES,
      })
      .getRawOne<AggregateRow>();

    const payloads: QueryDeepPartialEntity<DailyStatistic>[] = [];

    if (globalRow) {
      payloads.push({
        date: this.formatDate(start),
        branchId: null,
        totalRevenue: Number(globalRow.totalRevenue ?? 0),
        totalOrders: Number(globalRow.totalOrders ?? 0),
        totalCustomers: Number(globalRow.totalCustomers ?? 0),
        totalProductsSold: Number(globalRow.totalProductsSold ?? 0),
        meta: {},
      });
    }

    branchRows.forEach((row) => {
      payloads.push({
        date: this.formatDate(start),
        branchId: row.branchId ? Number(row.branchId) : null,
        totalRevenue: Number(row.totalRevenue ?? 0),
        totalOrders: Number(row.totalOrders ?? 0),
        totalCustomers: Number(row.totalCustomers ?? 0),
        totalProductsSold: Number(row.totalProductsSold ?? 0),
        meta: {},
      });
    });

    if (!payloads.length) {
      return;
    }

    await this.dailyStatsRepo
      .createQueryBuilder()
      .insert()
      .into(DailyStatistic)
      .values(payloads)
      .orUpdate(
        ['totalRevenue', 'totalOrders', 'totalCustomers', 'totalProductsSold', 'meta', 'updatedAt'],
        ['date', 'branchId'],
      )
      .execute();
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

  private addDays(input: Date, amount: number): Date {
    const date = new Date(input);
    date.setDate(date.getDate() + amount);
    return date;
  }

  private formatDate(input: Date): string {
    return input.toISOString().slice(0, 10);
  }
}
