import { TrendGranularity } from '../../trend_forecasting/dto/trend-forecast-query.dto';
import { TrendForecastResponseDto } from '../../trend_forecasting/dto/trend-forecast-response.dto';
import { UserRole } from '../../users/entities/user.entity';
import { ADMIN_COPILOT_RANGE_OPTIONS } from '../constants/admin-copilot.constants';

export type AdminCopilotRangeKey = (typeof ADMIN_COPILOT_RANGE_OPTIONS)[number];

export interface AdminCopilotRevenueOverviewResult {
  range: AdminCopilotRangeKey;
  granularity: TrendGranularity;
  periodStart: string | null;
  periodEnd: string | null;
  totalRevenue: number;
  totalOrders: number;
  totalUnits: number;
  averageOrderValue: number;
  forecast: TrendForecastResponseDto['forecast'][number] | null;
  summary: TrendForecastResponseDto['summary'];
}

export interface AdminCopilotTopProductRow {
  productId: number;
  name: string;
  revenue: number;
  unitsSold: number;
  revenueShare: number;
}

export interface AdminCopilotTopProductsResult {
  range: AdminCopilotRangeKey;
  products: AdminCopilotTopProductRow[];
}

export interface AdminCopilotStockAlertRow {
  inventoryId: number;
  variantId: number;
  productId: number;
  productName: string;
  stock: number;
  branchId: number | null;
  branchName: string | null;
}

export interface AdminCopilotStockAlertsResult {
  threshold: number;
  alerts: AdminCopilotStockAlertRow[];
}

export interface AdminCopilotPostSchedule {
  date?: string | null;
  time?: string | null;
  timezone?: string | null;
}

export interface AdminCopilotPostBrief {
  campaignName?: string | null;
  objective?: string | null;
  targetAudience?: string | null;
  tone?: string | null;
  productFocus?: string | null;
  keyMessages: string[];
  offers: string[];
  callToAction?: string | null;
  schedule?: AdminCopilotPostSchedule | null;
  notes?: string | null;
}

export interface AdminCopilotPostStrategy {
  hookIdeas: string[];
  assetIdeas: string[];
  publishingTips: string[];
  hashtags: string[];
}

export interface AdminCopilotPostDraft {
  variantId: string;
  headline?: string | null;
  subHeadline?: string | null;
  caption: string;
  callToAction?: string | null;
  hashtags: string[];
  schedule?: AdminCopilotPostSchedule | null;
  preview?: string | null;
  notes?: string | null;
  suggestedAssets?: string[];
}

export interface AdminCopilotPostCampaignResult {
  brief: AdminCopilotPostBrief;
  strategy: AdminCopilotPostStrategy;
  posts: AdminCopilotPostDraft[];
}

export interface AdminCopilotPostCampaignNormalizedInput {
  language: string;
  variants: number;
  format: 'short' | 'medium' | 'long' | null;
  hashtags: string[];
  brief: AdminCopilotPostBrief;
  meta?: Record<string, unknown> | null;
}

export interface AdminCopilotRangeConfig {
  range: AdminCopilotRangeKey;
  days: number;
  lookbackMonths: number;
  granularity: TrendGranularity;
}

export interface AdminCopilotAdminContext {
  adminUserId: number;
  role: UserRole;
  branchId: number | null;
  branchName: string | null;
  isGlobalAdmin: boolean;
}

export type AdminCopilotProactiveActionType =
  | 'RESTOCK_REDIRECT'
  | 'OPEN_COPILOT_DRAFT'
  | 'VIEW_REPORTS';

export interface AdminCopilotProactiveAction {
  label: string;
  type: AdminCopilotProactiveActionType;
  payload: Record<string, unknown>;
}

export interface AdminCopilotMorningBriefingResult {
  greeting: string;
  briefing: string;
  actions: AdminCopilotProactiveAction[];
  generatedAt: string;
}
