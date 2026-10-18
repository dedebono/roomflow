import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Pakasir API v2.
 *
 * MIGRASI WAJIB (tenggat 20 Oktober 2026): API v1
 * (POST /api/transactioncreate/{method}, GET /api/transaction/{slug}/{order_id})
 * sudah DEPRECATED dan dimatikan. Endpoint v2 memakai header X-Api-Key,
 * bukan api_key di body JSON.
 *
 * Rate limit: create/cancel 2 req/detik (shared, global), transaction-status
 * 4 detik per transaksi. Scheduler WAJIB membatasi konkurensi; lihat
 * SettlementService.
 */
@Injectable()
export class PakasirService {
  private readonly logger = new Logger(PakasirService.name);
  private readonly DEFAULT_BASE = 'https://app.pakasir.com';

  constructor(private readonly prisma: PrismaService) {}

  private async loadGateway(gatewayId: string) {
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
    if (!apiKey || !projectSlug) {
      throw new BadRequestException(
        `Gateway '${gateway.name}' is not fully configured. Missing API key or project slug.`,
      );
    }
    // config.apiUrl bisa berupa host ("app.pakasir.com") maupun base penuh
    // yang sudah memuat /api/v2. Normalkan ke host saja supaya path v2
    // tidak jadi dobel.
    const base = (config.apiUrl || this.DEFAULT_BASE)
      .replace(/\/api\/v2\/?$/, '')
      .replace(/\/api\/?$/, '')
      .replace(/\/+$/, '');
    return { gateway, config, apiKey, projectSlug, base };
  }

  private async request<T>(
    url: string,
    apiKey: string,
    init: RequestInit = {},
    what = 'Pakasir',
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          ...(init.headers || {}),
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`${what} HTTP ${res.status}: ${body.slice(0, 300)}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * POST /api/v2/create-transaction/{slug}/{order_id}
   *
   * FIND-OR-CREATE: panggil lagi dengan slug+order_id+body sama selalu
   * mengembalikan transaksi yang sama. Ini yang membuat retry aman.
   *
   * order_id WAJIB milik Order yang sudah tersimpan di DB sebelum dipanggil.
   * Kalau tidak, response yang hilang lalu di-retry akan membuat transaksi
   * yatim yang tidak pernah bisa di-cancel atau di-rekonsiliasi.
   */
  async createTransaction(
    gatewayId: string,
    params: { orderId: string; amount: number; method?: string },
  ): Promise<{
    txn_id: string;
    payment_link?: string;
    qr_string?: string;
    va_number?: string;
    amount?: number;
    fee?: number;
    total_payment?: number;
    payment_method?: string;
    expired_at?: string;
    is_sandbox?: boolean;
  }> {
    const { apiKey, projectSlug, base } = await this.loadGateway(gatewayId);
    const method = params.method || 'qris';
    try {
      return await this.request(
        `${base}/api/v2/create-transaction/${projectSlug}/${encodeURIComponent(params.orderId)}`,
        apiKey,
        { method: 'POST', body: JSON.stringify({ method, amount: params.amount }) },
        'Pakasir create-transaction',
      );
    } catch (error: any) {
      this.logger.error(`Pakasir createTransaction ${params.orderId}: ${error.message}`);
      throw new BadRequestException(`Payment gateway error: ${error.message}`);
    }
  }

  /**
   * POST /api/v2/cancel-transaction/{slug}/{txn_id}
   *
   * Idempotent: transaksi yang sudah cancelled/expired tetap 200. Itu yang
   * membuat settlement sweep aman di-retry atau di-restart.
   */
  async cancelTransaction(gatewayId: string, txnId: string): Promise<void> {
    const { apiKey, projectSlug, base } = await this.loadGateway(gatewayId);
    await this.request(
      `${base}/api/v2/cancel-transaction/${projectSlug}/${encodeURIComponent(txnId)}`,
      apiKey,
      { method: 'POST' },
      'Pakasir cancel-transaction',
    );
  }

  /**
   * GET /api/v2/transaction-status/{slug}/{txn_id}
   *
   * Satu-satunya sumber kebenaran apakah uang benar-benar masuk.
   * Status: pending | completed | canceled
   */
  async getTransactionStatus(
    gatewayId: string,
    txnId: string,
  ): Promise<{
    txn_id: string;
    order_id: string;
    amount: number;
    status: string;
    completed_at?: string;
    is_sandbox?: boolean;
  }> {
    const { apiKey, projectSlug, base } = await this.loadGateway(gatewayId);
    return this.request(
      `${base}/api/v2/transaction-status/${projectSlug}/${encodeURIComponent(txnId)}`,
      apiKey,
      { method: 'GET' },
      'Pakasir transaction-status',
    );
  }

  /**
   * Verifikasi header X-Secret, timing-safe.
   *
   * CATATAN PENTING: ini BUKAN signature. Pakasir tidak menandatangani
   * payload dengan HMAC — dokumentasinya hanya menyebut header X-Secret
   * statis per proyek. Shared secret bisa bocor lewat log.
   *
   * Lapis kedua (order_id + amount dicocokkan ke Order lokal di
   * WebhookService) adalah verifikasi yang benar-benar bermakna. Jangan
   * menganggap lapis ini sudah cukup.
   */
  verifySecret(config: Record<string, unknown>, provided: string | undefined): boolean {
    const expected = (config.webhookSecret || config.secret || '') as string;
    if (!expected || !provided) return false;
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  /** Payment link v2 untuk method=payment_link. */
  buildPaymentLink(txnId: string, redirect?: string, qrisOnly = false): string {
    const params: string[] = [];
    if (redirect) params.push(`redirect=${encodeURIComponent(redirect)}`);
    if (qrisOnly) params.push('qris_only=1');
    const qs = params.length ? `?${params.join('&')}` : '';
    return `https://app.pakasir.com/pay-v2/${txnId}${qs}`;
  }
}
