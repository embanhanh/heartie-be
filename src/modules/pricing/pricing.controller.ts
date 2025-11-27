import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { CalculatePricingDto } from './dto/calculate-pricing.dto';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Tính toán giá trị đơn hàng/giỏ hàng dựa trên danh sách biến thể' })
  calculate(@Body() dto: CalculatePricingDto) {
    return this.pricingService.calculate(dto);
  }
}
