export type TrendDirection = 'up' | 'down' | 'neutral';

export interface TrendMetric {
  value: number;
  previousValue: number;
  percentageChange: number;
  trend: TrendDirection;
}

export interface StatsOverviewResponse {
  revenue: TrendMetric;
  orders: TrendMetric;
  customers: TrendMetric;
}

export interface RevenueChartPoint {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface OrderStatusSlice {
  label: string;
  status: string;
  value: number;
}

export interface TopSellingProduct {
  productId: number;
  name: string;
  image?: string | null;
  soldQuantity: number;
  totalRevenue: number;
}

export interface LowStockProduct {
  productId: number;
  name: string;
  image?: string | null;
  stock: number;
  branchId?: number | null;
  branchName?: string | null;
  branchAddress?: string | null;
}

export interface ViewLeaderboardItem {
  id: number;
  name: string;
  views: number;
  image?: string | null;
  type: 'product' | 'article';
}
