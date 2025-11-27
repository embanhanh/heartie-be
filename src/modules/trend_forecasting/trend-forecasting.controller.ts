import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TrendForecastingService } from './trend-forecasting.service';
import { TrendForecastQueryDto } from './dto/trend-forecast-query.dto';
import { TrendForecastResponseDto } from './dto/trend-forecast-response.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Trend Forecasting')
@ApiBearerAuth()
@Controller('admin/trend-forecast')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class TrendForecastingController {
  constructor(private readonly trendForecastingService: TrendForecastingService) {}

  @Get('sales')
  @ApiOkResponse({ type: TrendForecastResponseDto })
  async getSalesForecast(@Query() query: TrendForecastQueryDto): Promise<TrendForecastResponseDto> {
    return this.trendForecastingService.getSalesForecast(query);
  }
}
