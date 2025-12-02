import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { StatsOverviewQueryDto } from './dto/stats-overview-query.dto';
import { RevenueChartQueryDto } from './dto/revenue-chart-query.dto';
import { OrderStatusQueryDto } from './dto/order-status-query.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import {
  OrderStatusSliceDto,
  RevenueChartPointDto,
  StatsOverviewResponseDto,
  ViewLeaderboardItemDto,
} from './dto/responses/stats-response.dto';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Tổng quan doanh thu, đơn hàng và khách hàng theo thời gian' })
  @ApiOkResponse({
    description: 'Số liệu KPI kèm phần trăm tăng trưởng',
    type: StatsOverviewResponseDto,
  })
  getOverview(@Query() query: StatsOverviewQueryDto) {
    return this.statsService.getOverview(query);
  }

  @Get('revenue-chart')
  @ApiOperation({ summary: 'Biểu đồ doanh thu theo ngày kết hợp dữ liệu realtime & lịch sử' })
  @ApiOkResponse({
    description: 'Danh sách điểm dữ liệu doanh thu theo ngày',
    type: RevenueChartPointDto,
    isArray: true,
  })
  getRevenueChart(@Query() query: RevenueChartQueryDto) {
    return this.statsService.getRevenueChart(query);
  }

  @Get('order-status')
  @ApiOperation({ summary: 'Tỷ lệ đơn hàng theo trạng thái chính trong kỳ' })
  @ApiOkResponse({
    description: 'Danh sách trạng thái với nhãn hiển thị và số lượng đơn',
    type: OrderStatusSliceDto,
    isArray: true,
  })
  getOrderStatus(@Query() query: OrderStatusQueryDto) {
    return this.statsService.getOrderStatusBreakdown(query);
  }

  @Get('product-views')
  @ApiOperation({ summary: 'Bảng xếp hạng sản phẩm theo lượt xem thời gian thực' })
  @ApiOkResponse({
    description: 'Top sản phẩm được xem nhiều nhất',
    type: ViewLeaderboardItemDto,
    isArray: true,
  })
  getProductViews(@Query() query: LeaderboardQueryDto) {
    return this.statsService.getProductViewsLeaderboard(query);
  }

  @Get('article-views')
  @ApiOperation({ summary: 'Bảng xếp hạng bài viết/chiến dịch theo lượt xem' })
  @ApiOkResponse({
    description: 'Top bài viết/campaign được xem nhiều nhất',
    type: ViewLeaderboardItemDto,
    isArray: true,
  })
  getArticleViews(@Query() query: LeaderboardQueryDto) {
    return this.statsService.getArticleViewsLeaderboard(query);
  }
}
