import { TrendGranularity } from '../../trend_forecasting/dto/trend-forecast-query.dto';
import { AdminCopilotRangeKey } from './admin-copilot.types';

export interface AdminCopilotRevenueOverviewInput {
  range?: AdminCopilotRangeKey;
  granularity?: TrendGranularity;
  forecastPeriods?: number;
}

export interface AdminCopilotTopProductsInput {
  range?: AdminCopilotRangeKey;
  limit?: number;
}

export interface AdminCopilotStockAlertsInput {
  threshold?: number;
  branchId?: number;
  limit?: number;
}

export interface AdminCopilotPostCampaignScheduleInput {
  date?: string | null;
  time?: string | null;
  timezone?: string | null;
}

export interface AdminCopilotPostCampaignBriefInput {
  campaignName?: string | null;
  objective?: string | null;
  targetAudience?: string | null;
  tone?: string | null;
  productFocus?: string | null;
  keyMessages?: string[];
  offers?: string[];
  callToAction?: string | null;
  schedule?: AdminCopilotPostCampaignScheduleInput | null;
  notes?: string | null;
}

export interface AdminCopilotPostCampaignInput {
  brief?: AdminCopilotPostCampaignBriefInput | null;
  variants?: number;
  language?: string | null;
  format?: 'short' | 'medium' | 'long' | 'long_form' | 'short_form';
  hashtags?: string[];
}
