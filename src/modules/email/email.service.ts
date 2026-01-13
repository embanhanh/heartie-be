import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { I18nService } from 'nestjs-i18n';
import { Order, OrderStatus } from '../orders/entities/order.entity';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  // Brand colors
  private readonly colors = {
    primary: '#13293d',
    secondary: '#006494',
    accent: '#1b98e0',
    background: '#f7f7f9',
    text: '#1b1e28',
    white: '#ffffff',
  };

  constructor(
    private readonly mailerService: MailerService,
    private readonly i18n: I18nService,
  ) {}

  async sendOrderCreated(order: Order) {
    const email = order.address?.email || order.user?.email;
    if (!email) {
      this.logger.warn(
        `Order ${order.id} has no email address (address or user), skipping email notification.`,
      );
      return;
    }

    // Default to Vietnamese for now, but in future can use user.preferredLanguage if available
    const lang = 'vi';
    const t = (key: string, args?: Record<string, any>): string => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      return this.i18n.t(key, { lang, args }) as unknown as string;
    };

    const html = this.generateOrderTemplate(
      t('email.order_confirmation'),
      t('email.thank_you_order'),
      order,
      lang,
    );

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `[Fashia] ${t('email.order_confirmation')} #${order.orderNumber}`,
        html,
      });
      this.logger.log(`Order created email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send order created email: ${error}`);
    }
  }

  async sendOrderStatusChanged(order: Order) {
    const email = order.address?.email || order.user?.email;
    if (!email) {
      this.logger.warn(
        `Order ${order.id} has no email address (address or user), skipping email notification.`,
      );
      return;
    }

    const lang = 'vi';
    const t = (key: string, args?: Record<string, any>): string => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      return this.i18n.t(key, { lang, args }) as unknown as string;
    };

    const statusMessage = this.getStatusMessage(order.status, t);
    const html = this.generateOrderTemplate(
      t('email.order_status_update'),
      statusMessage,
      order,
      lang,
    );

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `[Fashia] ${t('email.order_status_update')} #${order.orderNumber}`,
        html,
      });
      this.logger.log(`Order status email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send order status email: ${error}`);
    }
  }

  private getStatusMessage(status: OrderStatus, t: (key: string) => string): string {
    return t(`email.status.${status}`) || t('email.status.UNKNOWN');
  }

  private generateOrderTemplate(
    title: string,
    message: string,
    order: Order,
    lang: string,
  ): string {
    const t = (key: string, args?: Record<string, any>): string => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      return this.i18n.t(key, { lang, args }) as unknown as string;
    };

    const itemsHtml =
      order.items
        ?.map((item) => {
          const productName = item.variant?.product?.name || t('email.product');
          const variantInfo = item.variant?.attributeValues
            ?.map((av) => av.attributeValue?.value)
            .filter(Boolean)
            .join(' - ');

          return `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 16px 10px; color: ${this.colors.text}; font-size: 14px;">
            <div style="font-weight: 500;">${productName}</div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">${variantInfo || ''}</div>
        </td>
        <td style="padding: 16px 10px; text-align: center; color: ${this.colors.text}; font-size: 14px;">${item.quantity}</td>
        <td style="padding: 16px 10px; text-align: right; color: ${this.colors.text}; font-weight: 500; font-size: 14px;">${this.formatCurrency(item.subTotal)}</td>
      </tr>
    `;
        })
        .join('') || '';

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: ${this.colors.text}; background-color: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background-color: ${this.colors.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
          .header { background-color: ${this.colors.white}; padding: 30px; text-align: center; border-bottom: 1px solid #f0f0f0; }
          .content { padding: 40px; }
          .footer { background-color: #fafafa; padding: 30px; text-align: center; font-size: 13px; color: #999; border-top: 1px solid #eee; }
          table { width: 100%; border-collapse: collapse; margin-top: 25px; }
          th { text-align: left; padding: 12px 10px; border-bottom: 2px solid ${this.colors.secondary}; color: ${this.colors.primary}; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-box { background-color: #f8fbfe; padding: 25px; border-radius: 8px; margin: 25px 0; border: 1px solid #eef2f6; }
          .info-item { margin-bottom: 10px; font-size: 14px; }
          .info-item:last-child { margin-bottom: 0; }
          .info-label { color: #666; margin-right: 5px; }
          .info-value { font-weight: 600; color: ${this.colors.text}; }
          .total-price { color: ${this.colors.secondary}; font-weight: 700; font-size: 18px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${frontendUrl}/images/fashia_logo.png" alt="Fashia Shop" style="height: 32px; width: auto;">
          </div>
          <div class="content">
            <h1 style="color: ${this.colors.primary}; margin-top: 0; font-size: 24px; font-weight: 700; text-align: center; margin-bottom: 20px;">${title}</h1>
            <p style="font-size: 15px; margin-bottom: 15px;">${t('email.hello')} <strong>${order.address?.fullName || order.user?.lastName || 'Khách hàng'}</strong>,</p>
            <p style="font-size: 15px; color: #555;">${message}</p>
            
            <div class="info-box">
              <div class="info-item">
                <span class="info-label">${t('email.order_id')}:</span>
                <span class="info-value">#${order.orderNumber}</span>
              </div>
              <div class="info-item">
                <span class="info-label">${t('email.order_date')}:</span>
                <span class="info-value">${new Date(order.createdAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}</span>
              </div>
              <div class="info-item" style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ddd;">
                <span class="info-label">${t('email.total_amount')}:</span>
                <span class="total-price">${this.formatCurrency(order.totalAmount)}</span>
              </div>
            </div>

            ${
              itemsHtml
                ? `
              <h3 style="color: ${this.colors.primary}; font-size: 16px; margin-top: 30px; margin-bottom: 10px;">${t('email.order_details')}</h3>
              <table>
                <thead>
                  <tr>
                    <th style="width: 50%">${t('email.product')}</th>
                    <th style="text-align: center; width: 20%">${t('email.quantity')}</th>
                    <th style="text-align: right; width: 30%">${t('email.price')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            `
                : ''
            }
          </div>
          <div class="footer">
            <p style="margin-bottom: 10px;">&copy; ${new Date().getFullYear()} Fashia Shop. All rights reserved.</p>
            <p style="margin: 0; font-size: 11px; opacity: 0.7;">This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }
}
