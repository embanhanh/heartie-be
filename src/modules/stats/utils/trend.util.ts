import { TrendDirection, TrendMetric } from '../interfaces/stats.types';

export interface TrendComputationInput {
  value: number;
  previousValue: number;
}

export function computeTrend({ value, previousValue }: TrendComputationInput): TrendMetric {
  const safeCurrent = Number.isFinite(value) ? value : 0;
  const safePrevious = Number.isFinite(previousValue) ? previousValue : 0;
  let percentageChange = 0;

  if (safePrevious === 0) {
    percentageChange = safeCurrent === 0 ? 0 : 100;
  } else {
    percentageChange = ((safeCurrent - safePrevious) / Math.abs(safePrevious)) * 100;
  }

  const trend: TrendDirection =
    percentageChange === 0 ? 'neutral' : percentageChange > 0 ? 'up' : 'down';

  return {
    value: roundTwoDecimals(safeCurrent),
    previousValue: roundTwoDecimals(safePrevious),
    percentageChange: roundTwoDecimals(percentageChange),
    trend,
  };
}

export function roundTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
