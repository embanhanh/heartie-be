import { computeTrend } from './trend.util';

describe('computeTrend', () => {
  it('should report neutral trend when both values are zero', () => {
    expect(computeTrend({ value: 0, previousValue: 0 })).toEqual({
      value: 0,
      previousValue: 0,
      percentageChange: 0,
      trend: 'neutral',
    });
  });

  it('should report upward trend with positive delta', () => {
    const result = computeTrend({ value: 200, previousValue: 100 });
    expect(result.trend).toBe('up');
    expect(result.percentageChange).toBe(100);
  });

  it('should report downward trend with negative delta', () => {
    const result = computeTrend({ value: 50, previousValue: 100 });
    expect(result.trend).toBe('down');
    expect(result.percentageChange).toBe(-50);
  });

  it('should handle division by zero gracefully', () => {
    const result = computeTrend({ value: 150, previousValue: 0 });
    expect(result.trend).toBe('up');
    expect(result.percentageChange).toBe(100);
  });
});
