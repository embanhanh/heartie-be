import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AdminCopilotService } from '../admin-copilot.service';
import { StatsService } from '../../stats/stats.service';
import { TrendForecastingService } from '../../trend_forecasting/trend-forecasting.service';
import { GeminiService } from '../../gemini/gemini.service';
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
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

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

    // 2. Build Prompt
    const prompt = this.buildBriefingPrompt(context, revenueData, stockAlerts, sentimentData);

    // 3. Generate with Gemini
    const resultText = await this.geminiService.generateStructuredContent(prompt, {
      model: 'gemini-2.5-flash',
      maxOutputTokens: 2048,
      temperature: 0.2,
      responseMimeType: 'application/json',
    });
    this.logger.debug(`Gemini response: ${resultText}`);

    let result: AdminCopilotMorningBriefingResult;
    try {
      // Stripping markdown code blocks if present
      const cleanedJson = resultText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      this.logger.debug(`Cleaned JSON: ${cleanedJson}`);
      result = JSON.parse(cleanedJson) as AdminCopilotMorningBriefingResult;
    } catch (e: unknown) {
      const error = e as Error;
      this.logger.error(`Failed to parse Gemini response. Raw: ${resultText}`, error.stack);
      throw new Error(`Invalid AI response format: ${error.message}`);
    }

    const finalResult = {
      ...result,
      generatedAt: new Date().toISOString(),
    };

    await this.cacheManager.set(cacheKey, finalResult);

    return finalResult;
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

      Yêu cầu đầu ra:
      1. greeting: Một lời chào cá nhân hóa, chuyên nghiệp nhưng thân thiện.
      2. briefing: Một đoạn tóm tắt (3-5 câu) phân tích sâu về con số. Đừng chỉ liệt kê số, hãy nói về Ý NGHĨA của nó. Ví dụ: "Doanh thu đang tăng ổn định nhờ hiệu ứng chuẩn bị lễ Valentine, tuy nhiên việc tồn kho thấp của sản phẩm X tại chi nhánh Y có thể làm lỡ cơ hội bán hàng."
      3. actions: Danh sách 2-3 hành động ưu tiên nhất:
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
