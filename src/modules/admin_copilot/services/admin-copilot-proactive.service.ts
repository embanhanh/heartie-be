import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AdminCopilotService } from '../admin-copilot.service';
import { StatsService } from '../../stats/stats.service';
import { TrendForecastingService } from '../../trend_forecasting/trend-forecasting.service';
import { GeminiService } from '../../gemini/gemini.service';
import { AdsAiService } from '../../ads_ai/ads_ai.service';
import { Schema, SchemaType } from '@google/generative-ai';
import {
  AdminCopilotAdminContext,
  AdminCopilotMorningBriefingResult,
} from '../types/admin-copilot.types';
import { subtractDays } from '../../../common/utils/data-normalization.util';

@Injectable()
export class AdminCopilotProactiveService {
  private readonly logger = new Logger(AdminCopilotProactiveService.name);

  constructor(
    private readonly adminCopilotService: AdminCopilotService,
    private readonly statsService: StatsService,
    private readonly trendForecastingService: TrendForecastingService,
    private readonly geminiService: GeminiService,
    private readonly adsAiService: AdsAiService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private readonly BRIEFING_SCHEMA: Schema = {
    type: SchemaType.OBJECT,
    properties: {
      greeting: { type: SchemaType.STRING, description: 'Personalized greeting' },
      briefing: { type: SchemaType.STRING, description: 'Summary of the metrics and insights' },
      actions: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            label: { type: SchemaType.STRING, description: 'Action button label' },
            type: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: ['RESTOCK_REDIRECT', 'OPEN_COPILOT_DRAFT', 'VIEW_REPORTS'],
            },
            payload: {
              type: SchemaType.OBJECT,
              properties: {
                range: { type: SchemaType.STRING, description: 'Time range for reports' },
              },
              description: 'Action parameters',
            },
          },
          required: ['label', 'type', 'payload'],
        },
      },
    },
    required: ['greeting', 'briefing', 'actions'],
  };

  async getMorningBriefing(adminUserId: number): Promise<AdminCopilotMorningBriefingResult> {
    const context = await this.adminCopilotService.resolveAdminContext(adminUserId);

    const cacheKey = `morning_briefing_${adminUserId}_${context.branchId || 'global'}`;
    const cached = await this.cacheManager.get<AdminCopilotMorningBriefingResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Returning cached morning briefing for admin ${adminUserId}`);
      return cached;
    }

    this.logger.debug(
      `Generating morning briefing for admin ${adminUserId} (branch=${context.branchId})`,
    );

    // 1. Aggregate Data
    const revenueData = await this.getRevenueContext(context);
    const stockAlerts = await this.getStockContext(context);
    const sentimentData = await this.getSentimentContext(context);
    const marketingData = await this.getMarketingContext();

    // 2. Build Prompt
    const prompt = this.buildBriefingPrompt(
      context,
      revenueData,
      stockAlerts,
      sentimentData,
      marketingData,
    );

    // 3. Generate with Gemini
    let resultText = '';
    try {
      resultText = await this.geminiService.generateStructuredContent(prompt, {
        model: 'gemini-2.5-flash',
        maxOutputTokens: 8192,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: this.BRIEFING_SCHEMA,
      });
    } catch (error) {
      this.logger.error('Failed to generate morning briefing via Gemini', error);
      return this.getFallbackBriefing();
    }

    this.logger.debug(`Gemini response: ${resultText}`);

    let result: AdminCopilotMorningBriefingResult;
    try {
      const cleanedJson = this.extractJson(resultText);
      this.logger.debug(`Cleaned JSON: ${cleanedJson}`);
      result = JSON.parse(cleanedJson) as AdminCopilotMorningBriefingResult;
    } catch (e: unknown) {
      const error = e as Error;
      this.logger.error(`Failed to parse Gemini response. Raw: ${resultText}`, error.stack);
      // Fallback to a safe result instead of throwing error
      return this.getFallbackBriefing();
    }

    const finalResult = {
      ...result,
      generatedAt: new Date().toISOString(),
    };

    await this.cacheManager.set(cacheKey, finalResult);

    return finalResult;
  }

  private extractJson(text: string): string {
    // Attempt to find JSON block between markdown
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      let candidate = jsonMatch[0].trim();

      // Handle known truncation patterns
      // 1. Unclosed string
      const quoteCount = (candidate.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        candidate += '"';
      }

      // 2. Count open vs closed structures
      const openBraces = (candidate.match(/\{/g) || []).length;
      const closeBraces = (candidate.match(/\}/g) || []).length;
      const openBrackets = (candidate.match(/\[/g) || []).length;
      const closeBrackets = (candidate.match(/\]/g) || []).length;

      // 3. Balance them
      // We generally assume a structure like { ... [ ... ] ... }
      // If we are deep in an array, we might need to close the array then the object.
      // A simple heuristic: check the last few chars to see what we might be in.

      // If we added a quote, we might need a comma or we might be at the end of a value.
      // But adding "}" or "]" without a comma if we were in the middle of a list of objects might be valid format-wise but missing data.
      // However, to satisfy JSON.parse:

      if (openBrackets > closeBrackets) {
        candidate += ']'.repeat(openBrackets - closeBrackets);
      }
      if (openBraces > closeBraces) {
        candidate += '}'.repeat(openBraces - closeBraces);
      }

      return candidate;
    }

    // Stripping markdown code blocks if present (legacy)
    return text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
  }

  private getFallbackBriefing(): AdminCopilotMorningBriefingResult {
    return {
      greeting: 'Chào Admin, rất tiếc mình gặp chút sự cố khi phân tích dữ liệu sáng nay.',
      briefing:
        'Hệ thống đang gặp gián đoạn khi tổng hợp bản tin. Tuy nhiên, doanh số và vận hành vẫn đang được ghi nhận bình thường. Bạn có thể kiểm tra trực tiếp tại các mục báo cáo.',
      actions: [
        {
          label: 'Xem báo cáo doanh thu',
          type: 'VIEW_REPORTS',
          payload: { range: '7d' },
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  private async getRevenueContext(context: AdminCopilotAdminContext) {
    const now = new Date();
    const rangeStart = subtractDays(now, 6); // Last 7 days
    rangeStart.setHours(0, 0, 0, 0);

    const stats = await this.statsService.getOverview({
      from: rangeStart,
      to: now,
      branchId: context.branchId ?? undefined,
    });

    return {
      totalRevenue: stats.revenue.value,
      revenueChange: stats.revenue.percentageChange,
      totalOrders: stats.orders.value,
      ordersChange: stats.orders.percentageChange,
    };
  }

  private async getStockContext(context: AdminCopilotAdminContext) {
    // Branch managers only see their branch alerts
    const alerts = await this.adminCopilotService.getStockAlerts(context.adminUserId, {
      threshold: 20,
      limit: 5,
    });

    return alerts.alerts.map((a) => ({
      productId: a.productId,
      productName: a.productName,
      stock: a.stock,
      branchId: a.branchId,
      branchName: a.branchName,
    }));
  }

  private async getSentimentContext(context: AdminCopilotAdminContext) {
    const forecast = await this.trendForecastingService.getSalesForecast({
      granularity: 'day',
      lookbackMonths: 1,
      forecastPeriods: 0,
      branchId: context.branchId ?? undefined,
    });
    return {
      summary: forecast.summary.narrative,
      sentiment: forecast.signals.sentimentScore,
    };
  }

  private async getMarketingContext() {
    try {
      const recentAds = await this.adsAiService.getRecentPerformance(5);
      return recentAds.map((ad) => ({
        name: ad.name,
        type: ad.postType,
        reach: ad.reach,
        clicks: ad.clicks,
        conversions: ad.conversions,
        rating: ad.rating,
        notes: ad.notes,
      }));
    } catch (error) {
      this.logger.error('Failed to get marketing context', error);
      return [];
    }
  }

  private buildBriefingPrompt(
    context: AdminCopilotAdminContext,
    revenue: {
      totalRevenue: number;
      revenueChange: number;
      totalOrders: number;
      ordersChange: number;
    },
    stock: Array<{
      productId: number;
      productName: string;
      stock: number;
      branchId: number | null;
      branchName: string | null;
    }>,
    sentiment: {
      summary: string;
      sentiment: number;
    },
    marketing: Array<{
      name: string;
      type: string;
      reach: number;
      clicks: number;
      conversions: number;
      rating: number | null;
      notes: string | null;
    }>,
  ) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN');
    const roleLabel = context.isGlobalAdmin
      ? 'Quản trị viên Hệ thống'
      : `Quản lý chi nhánh ${context.branchName}`;

    // Event detection logic
    let eventContext = '';
    const month = now.getMonth() + 1;
    const day = now.getDate();

    if (month === 2 && day <= 14) {
      eventContext =
        'Sắp đến ngày Lễ Tình Nhân (14/2). Thị trường đang có nhu cầu cao về quà tặng và đồ đôi.';
    } else if (month === 12 && day >= 15) {
      eventContext =
        'Đang trong mùa lễ hội cuối năm và chuẩn bị Tết. Nhu cầu mua sắm quần áo mới tăng mạnh.';
    } else if (month === 1 && day <= 30) {
      eventContext =
        'Sắp đến Tết Nguyên Đán (Âm lịch). Đây là thời điểm mua sắm cao điểm nhất trong năm.';
    }

    const stockContext =
      stock.length > 0
        ? `Các sản phẩm tồn kho thấp: ${stock
            .map((s) => `${s.productName} (${s.stock} cái tại ${s.branchName})`)
            .join(', ')}.`
        : 'Tồn kho hiện tại đang ở mức an toàn.';

    return `
      Bạn là Trợ lý AI Proactive tên là "Fashia Copilot". Bạn đang chuẩn bị bản tin "Morning Briefing" cho ${roleLabel}.
      Mục tiêu là giúp Admin tiết kiệm thời gian vận hành bằng cách đưa ra phân tích và đề xuất hành động ngay lập tức.

      Dữ liệu hiện thực tế:
      - Ngày: ${dateStr}
      - Phạm vi dữ liệu: ${context.isGlobalAdmin ? 'Toàn hệ thống' : `Chỉ chi nhánh ${context.branchName}`}
      - Doanh thu 7 ngày qua: ${revenue.totalRevenue.toLocaleString()} VNĐ (${revenue.revenueChange >= 0 ? '+' : ''}${revenue.revenueChange}%)
      - Đơn hàng: ${revenue.totalOrders} (${revenue.ordersChange >= 0 ? '+' : ''}${revenue.ordersChange}%)
      - Tình trạng hàng hóa: ${stockContext}
      - Sentiment khách hàng: ${sentiment.sentiment}/100
      - Xu hướng kinh doanh: ${sentiment.summary}
      - Ngữ cảnh đặc biệt: ${eventContext}
      - Hiệu suất Marketing gần đây:
        ${marketing.length > 0 ? marketing.map((m) => `- ${m.name} (${m.type}): Reach ${m.reach}, Clicks ${m.clicks}, CV ${m.conversions}, Rating ${m.rating ?? 'N/A'}/5. Notes: ${m.notes ?? 'None'}`).join('\n        ') : 'Chưa có dữ liệu bài đăng gần đây.'}

      Yêu cầu đầu ra:
      1. greeting: Một lời chào cá nhân hóa, chuyên nghiệp nhưng thân thiện.
      2. briefing: Một đoạn tóm tắt (3-5 câu) phân tích sâu về con số (Doanh thu, Kho hàng, Marketing). Đề cập đến hiệu quả của các bài đăng quảng cáo gần đây nếu có. Ví dụ: "Chiến dịch X đang mang lại hiệu quả chuyển đổi tốt, trong khi chiến dịch Y có reach cao nhưng ít click, có thể cần điều chỉnh CTA."
      3. actions: Danh sách 2-3 hành động ưu tiên nhất:
         - Nếu có bài quảng cáo kém hiệu quả (Rating < 3 hoặc Clicks thấp so với Reach): Đề xuất 'OPEN_COPILOT_DRAFT' để tối ưu nội dung.
         - Nếu có sản phẩm hot tồn kho thấp tại chi nhánh: Đề xuất 'RESTOCK_REDIRECT' kèm payload { productId, branchId }.
         - Nếu sắp có sự kiện (Valentine, Tết): Đề xuất 'OPEN_COPILOT_DRAFT' kèm payload { topic, context } để AI hỗ trợ viết post quảng cáo ngay.
         - Luôn có 1 hành động xem báo cáo chi tiết: 'VIEW_REPORTS' kèm payload { range: '7d' }.

      - Ngôn ngữ: Tiếng Việt, phong cách chuyên nghiệp, tích cực.
      - Briefing: Tối đa 300 ký tự, tập trung vào con số và hành động quan trọng nhất.
      - Luôn trả về dữ liệu dưới dạng JSON thuần túy, không có văn bản thừa. Đảm bảo cấu trúc JSON luôn hợp lệ và đầy đủ.
      Trả về định dạng JSON thuần túy:
      {
        "greeting": string,
        "briefing": string,
        "actions": [
          { "label": string, "type": "RESTOCK_REDIRECT" | "OPEN_COPILOT_DRAFT" | "VIEW_REPORTS", "payload": object }
        ]
      }
      Ngôn ngữ: Tiếng Việt.
    `;
  }
}
