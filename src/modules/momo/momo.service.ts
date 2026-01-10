import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import { MomoIpnDto } from './dto/momo-ipn.dto';
import { Order, OrderStatus } from '../orders/entities/order.entity';

interface MomoConfig {
  accessKey: string;
  secretKey: string;
  partnerCode: string;
  redirectUrl: string;
  ipnUrl: string;
  apiEndpoint: string;
}

interface MomoApiResponse {
  payUrl: string;
  orderId: string;
  requestId: string;
  resultCode: number;
  message: string;
}

interface CreatePaymentResult {
  payUrl: string;
  orderId: string;
  requestId: string;
  resultCode: number;
  message: string;
}

@Injectable()
export class MomoService {
  private readonly logger = new Logger(MomoService.name);
  private readonly config: MomoConfig;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {
    // TODO: Move to environment variables for production
    this.config = {
      accessKey: 'F8BBA842ECF85',
      secretKey: 'K951B6PE1waDMi640xX08PD3vg6EkVlz',
      partnerCode: 'MOMO',
      redirectUrl: 'http://localhost:3000/vi/cart/order-success',
      ipnUrl: 'https://darcie-brashiest-erroneously.ngrok-free.dev/momo/ipn',
      apiEndpoint: 'https://test-payment.momo.vn/v2/gateway/api/create',
    };
  }

  /**
   * Create a MoMo payment request
   */
  async createPayment(
    orderId: number,
    orderNumber: string,
    amount: number,
  ): Promise<CreatePaymentResult> {
    const { accessKey, secretKey, partnerCode, redirectUrl, ipnUrl, apiEndpoint } = this.config;

    const orderInfo = `Thanh toán đơn hàng ${orderNumber}`;
    const requestType = 'payWithMethod';
    const momoOrderId = orderNumber; // Use orderNumber as MoMo orderId for easy tracking
    const requestId = `${orderNumber}-${Date.now()}`;
    const extraData = Buffer.from(JSON.stringify({ orderId })).toString('base64');
    const lang = 'vi';

    const rawSignature =
      `accessKey=${accessKey}` +
      `&amount=${amount}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${ipnUrl}` +
      `&orderId=${momoOrderId}` +
      `&orderInfo=${orderInfo}` +
      `&partnerCode=${partnerCode}` +
      `&redirectUrl=${redirectUrl}` +
      `&requestId=${requestId}` +
      `&requestType=${requestType}`;

    const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

    const body = {
      partnerCode,
      requestId,
      amount,
      orderId: momoOrderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      requestType,
      extraData,
      signature,
      lang,
    };

    this.logger.log(`Creating MoMo payment for order ${orderNumber}, amount: ${amount}`);

    try {
      const res = await axios.post<MomoApiResponse>(apiEndpoint, body);
      this.logger.log(`MoMo response: ${JSON.stringify(res.data)}`);

      if (res.data.resultCode !== 0) {
        throw new BadRequestException(`MoMo payment creation failed: ${res.data.message}`);
      }

      return {
        payUrl: res.data.payUrl,
        orderId: res.data.orderId,
        requestId: res.data.requestId,
        resultCode: res.data.resultCode,
        message: res.data.message,
      };
    } catch (error) {
      this.logger.error(`MoMo API error: ${(error as Error).message}`);
      throw new BadRequestException('Failed to create MoMo payment. Please try again.');
    }
  }

  /**
   * Verify the signature from MoMo IPN callback
   */
  verifySignature(data: MomoIpnDto): boolean {
    const { secretKey, accessKey } = this.config;

    const rawSignature =
      `accessKey=${accessKey}` +
      `&amount=${data.amount}` +
      `&extraData=${data.extraData}` +
      `&message=${data.message}` +
      `&orderId=${data.orderId}` +
      `&orderInfo=${data.orderInfo}` +
      `&orderType=${data.orderType}` +
      `&partnerCode=${data.partnerCode}` +
      `&payType=${data.payType}` +
      `&requestId=${data.requestId}` +
      `&responseTime=${data.responseTime}` +
      `&resultCode=${data.resultCode}` +
      `&transId=${data.transId}`;

    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    return expectedSignature === data.signature;
  }

  /**
   * Handle MoMo IPN callback - update order status based on payment result
   */
  async handlePaymentCallback(data: MomoIpnDto): Promise<{ message: string }> {
    this.logger.log(`Received MoMo IPN: ${JSON.stringify(data)}`);

    // Verify signature
    if (!this.verifySignature(data)) {
      this.logger.error('Invalid MoMo signature');
      throw new BadRequestException('Invalid signature');
    }

    // Extract orderId from extraData if available (for logging/debugging purposes)
    if (data.extraData) {
      try {
        const decoded = JSON.parse(Buffer.from(data.extraData, 'base64').toString()) as {
          orderId: number;
        };
        // Internal orderId is available in decoded.orderId if needed for future use
        this.logger.log(`Internal order ID from extraData: ${decoded.orderId}`);
      } catch {
        this.logger.warn('Failed to parse extraData');
      }
    }

    // Find order by orderNumber (MoMo orderId = our orderNumber)
    const order = await this.orderRepo.findOne({
      where: { orderNumber: data.orderId },
    });

    if (!order) {
      this.logger.error(`Order not found: ${data.orderId}`);
      throw new BadRequestException(`Order not found: ${data.orderId}`);
    }

    // Check if payment was successful
    if (data.resultCode === 0) {
      // Payment successful
      order.status = OrderStatus.CONFIRMED;
      order.paidAt = new Date();
      await this.orderRepo.save(order);

      this.logger.log(`Order ${data.orderId} payment confirmed. TransId: ${data.transId}`);
    } else {
      // Payment failed - keep status as PENDING_PAYMENT or mark as failed
      this.logger.warn(
        `Order ${data.orderId} payment failed. ResultCode: ${data.resultCode}, Message: ${data.message}`,
      );
    }

    return { message: 'OK' };
  }
}
