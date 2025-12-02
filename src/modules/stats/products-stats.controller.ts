import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { TopSellingQueryDto } from './dto/top-selling-query.dto';
import { LowStockQueryDto } from './dto/low-stock-query.dto';
import { LowStockProductDto, TopSellingProductDto } from './dto/responses/stats-response.dto';

@ApiTags('products')
@Controller('products')
export class ProductsStatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('top-selling')
  @ApiOperation({ summary: 'Top sản phẩm bán chạy nhất trong khoảng thời gian' })
  @ApiOkResponse({
    description: 'Danh sách sản phẩm cùng doanh thu và số lượng bán',
    type: TopSellingProductDto,
    isArray: true,
  })
  getTopSelling(@Query() query: TopSellingQueryDto) {
    return this.statsService.getTopSellingProducts(query);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Phát hiện sản phẩm sắp hết hàng theo tồn kho' })
  @ApiOkResponse({
    description: 'Danh sách sản phẩm có tồn kho dưới ngưỡng',
    type: LowStockProductDto,
    isArray: true,
  })
  getLowStock(@Query() query: LowStockQueryDto) {
    return this.statsService.getLowStockProducts(query);
  }
}
