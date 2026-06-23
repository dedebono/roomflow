import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PakasirService {
  private readonly logger = new Logger(PakasirService.name);
  private readonly BASE_URL = 'https://app.pakasir.com/api';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a transaction using Pakasir gateway.
   * Config is loaded from the PaymentGateway record in DB.
   */
  async createTransaction(
    gatewayId: string,
    params: {
      orderId: string;
      amount: number;
      paymentMethod?: string;
    },
  ): Promise<any> {
    // Load gateway config from DB
    const gateway = await this.prisma.paymentGateway.findUnique({
      where: { id: gatewayId },
    });

    if (!gateway) {
      throw new BadRequestException(`Payment gateway '${gatewayId}' not found.`);
    }

    if (!gateway.enabled) {
      throw new BadRequestException(`Payment gateway '${gateway.name}' is disabled.`);
    }

    const config = (gateway.config || {}) as Record<string, string>;
    const apiKey = config.apiKey;
    const projectSlug = config.projectSlug;
    const apiUrl = config.apiUrl || this.BASE_URL;

    if (!apiKey || !projectSlug) {
      throw new BadRequestException(
        `Gateway '${gateway.name}' is not fully configured. Missing API key or project slug.`,
      );
    }

    const method = params.paymentMethod || 'qris';

    try {
      const response = await fetch(`${apiUrl}/transactioncreate/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projectSlug,
          order_id: params.orderId,
          amount: params.amount,
          api_key: apiKey,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Pakasir API error ${response.status}: ${errBody}`);
      }

      const data = await response.json() as any;
      return {
        gateway: gateway.name,
        gatewayId: gateway.id,
        ...data,
      };
    } catch (error: any) {
      this.logger.error(`Pakasir API error for ${params.orderId}: ${error.message}`);
      throw new BadRequestException(
        `Payment gateway error: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Generate a payment URL for redirect-based integration.
   */
  getPaymentUrl(config: Record<string, string>, params: { amount: number; orderId: string; redirect?: string; qrisOnly?: boolean }): string {
    const apiUrl = config.apiUrl || this.BASE_URL;
    const projectSlug = config.projectSlug;

    if (!projectSlug) {
      throw new BadRequestException('Project slug not configured.');
    }

    const baseUrl = apiUrl.replace(/\/api\/?$/, '');
    let url = `${baseUrl}/pay/${projectSlug}/${params.amount}?order_id=${params.orderId}`;

    if (params.redirect) {
      url += `&redirect=${encodeURIComponent(params.redirect)}`;
    }

    if (params.qrisOnly) {
      url += '&qris_only=1';
    }

    return url;
  }
}
