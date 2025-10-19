import { BadRequestException } from '@nestjs/common';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import {
  FilterParam,
  PaginateQueryHook,
  PaginatedResult,
  PaginationOptionsDto,
  SortParam,
} from '../dto/pagination.dto';

const FIELD_REGEX = /^[a-zA-Z0-9_.]+$/;

type FilterOperator = 'EQUAL' | 'ILIKE' | 'IN';

export abstract class BaseService<T extends ObjectLiteral> {
  protected constructor(
    protected readonly repository: Repository<T>,
    private readonly alias: string,
  ) {}

  protected get queryBuilder(): SelectQueryBuilder<T> {
    return this.repository.createQueryBuilder(this.alias);
  }

  protected resolveField(field: string): string {
    if (!FIELD_REGEX.test(field)) {
      throw new BadRequestException('Invalid field path');
    }
    return field.includes('.') ? field : `${this.alias}.${field}`;
  }

  protected getDefaultSorts(): SortParam[] {
    return [];
  }

  protected applySorts(qb: SelectQueryBuilder<T>, sorts: SortParam[] = []): void {
    const sortList = sorts.length ? sorts : this.getDefaultSorts();

    if (!sortList.length) {
      return;
    }

    const hasExistingOrder = Object.keys(qb.expressionMap.orderBys ?? {}).length > 0;

    sortList.forEach((sort, index) => {
      const field = this.resolveField(sort.field);
      if (!hasExistingOrder && index === 0) {
        qb.orderBy(field, sort.direction.toUpperCase() as 'ASC' | 'DESC');
      } else {
        qb.addOrderBy(field, sort.direction.toUpperCase() as 'ASC' | 'DESC');
      }
    });
  }

  protected applyFilters(qb: SelectQueryBuilder<T>, filters: FilterParam[] = []): void {
    filters.forEach((filter, index) => {
      const field = this.resolveField(filter.field);
      const parameterKey = `filter_${index}`;
      const { operator, value } = this.normalizeFilterValue(filter.value);

      if (operator === 'IN') {
        qb.andWhere(`${field} IN (:...${parameterKey})`, { [parameterKey]: value });
        return;
      }

      const comparison = operator === 'ILIKE' ? 'ILIKE' : '=';
      qb.andWhere(`${field} ${comparison} :${parameterKey}`, { [parameterKey]: value });
    });
  }

  async paginate(
    paginationDto: PaginationOptionsDto,
    hook?: PaginateQueryHook<T>,
  ): Promise<PaginatedResult<T>> {
    const qb = this.queryBuilder;

    if (hook) {
      hook(qb);
    }

    const filters = paginationDto.filters ?? [];
    const sorts = paginationDto.sorts ?? [];

    this.applyFilters(qb, filters);
    this.applySorts(qb, sorts);

    const limit = this.normalizeLimit(paginationDto.limit);
    const page = this.normalizePage(paginationDto.page);
    const skip = this.normalizeSkip(paginationDto.skip ?? (page - 1) * limit);

    qb.take(limit).skip(skip);

    const [data, total] = await qb.getManyAndCount();

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  private normalizeLimit(value?: number): number {
    const limit = Number.isFinite(value) ? Number(value) : 20;
    return Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
  }

  private normalizePage(value?: number): number {
    const page = Number.isFinite(value) ? Number(value) : 1;
    return Math.max(Math.trunc(page) || 1, 1);
  }

  private normalizeSkip(value?: number): number {
    const skip = Number.isFinite(value) ? Number(value) : 0;
    return Math.max(Math.trunc(skip) || 0, 0);
  }

  private normalizeFilterValue(rawValue: string): { operator: FilterOperator; value: unknown } {
    if (rawValue === undefined || rawValue === null) {
      return { operator: 'EQUAL', value: rawValue };
    }

    const trimmed = String(rawValue).trim();

    if (trimmed.includes('|')) {
      const values = trimmed
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => this.castFilterValue(part))
        .filter((part) => part !== undefined);

      return { operator: 'IN', value: values.length ? values : [trimmed] };
    }

    if (trimmed.includes('*') || trimmed.includes('%')) {
      const likeValue = trimmed.replace(/\*/g, '%');
      return { operator: 'ILIKE', value: likeValue };
    }

    return { operator: 'EQUAL', value: this.castFilterValue(trimmed) };
  }

  private castFilterValue(value: string): unknown {
    const lower = value.toLowerCase();

    if (lower === 'null') {
      return null;
    }

    if (lower === 'undefined') {
      return undefined;
    }

    if (lower === 'true' || lower === 'false') {
      return lower === 'true';
    }

    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return Number(value);
    }

    return value;
  }

  protected applyDateFilter(
    qb: SelectQueryBuilder<T>,
    field: string,
    from?: Date | string,
    to?: Date | string,
  ): void {
    const column = this.resolveField(field);
    const normalizedField = field.replace(/[^a-zA-Z0-9]/g, '_');
    const fromValue = this.normalizeDateInput(from);
    const toValue = this.normalizeDateInput(to);

    if (fromValue) {
      const paramName = `${normalizedField}_from`;
      qb.andWhere(`${column} >= :${paramName}`, { [paramName]: fromValue });
    }

    if (toValue) {
      const paramName = `${normalizedField}_to`;
      qb.andWhere(`${column} <= :${paramName}`, { [paramName]: toValue });
    }
  }

  private normalizeDateInput(input?: Date | string): Date | undefined {
    if (!input) {
      return undefined;
    }

    const date = input instanceof Date ? input : new Date(input);

    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date;
  }
}
