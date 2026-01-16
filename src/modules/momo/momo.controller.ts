import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MomoService } from './momo.service';
import { MomoIpnDto } from './dto/momo-ipn.dto';

@ApiTags('Momo')
@Controller('momo')
export class MomoController {
  constructor(private readonly momoService: MomoService) {}

  /**
   * IPN callback from MoMo - called by MoMo server after payment (server-to-server)
   */
  @Post('ipn')
  @ApiOperation({ summary: 'MoMo IPN callback - receives payment notification from MoMo server' })
  @ApiResponse({ status: 200, description: 'IPN processed successfully' })
  async momoIPN(@Body() body: MomoIpnDto) {
    return this.momoService.handlePaymentCallback(body);
  }
}
