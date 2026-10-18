import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PakasirService } from './pakasir.service';
import { SettlementService } from '../checkout/settlement.service';
import { Public } from '../common/decorators/public.decorator';

type PakasirWebhookBody = {
  txn_id?: string;
  order_id?: string;
  amount?: number;
  status?: string;
  completed_at?: string;
  is_sandbox?: boolean;
  project?: string;
};

/**
 * Webhook Pakasir.
 *
 * VERIFIKASI — dua lapis, berurutan:
 *
 *  1. Header X-Secret (timing-safe compare).
 *     CATATAN: ini BUKAN signature. Pakasir tidak menandatangani payload
 *     dengan HMAC; dokumentasinya hanya menyebut shared secret statis.
 *     Jadi ini bisa bocor lewat log dan TIDAK cukup sendirian.
 *
 *  2. order_id + amount HARUS cocok dengan Order lokal.
 *     Ini penjaga yang sebenarnya. Kalau total Order 150.000 dan webhook
 *     bilang 50.000, itu bukan pembayaran valid untuk order itu — dan
 *     tidak ada yang bisa memalsukannya tanpa tahu isi Order.
 *
 * Plus: sandbox event diabaikan, dan delivery ganda dicatat sekali lewat
 * unique index WebhookEvent(gateway, gatewayTxnId).
 *
 * STATUS RESPON — penting dan sering salah:
 *   200 untuk: diproses, duplikat, sandbox, order_id tidak dikenal.
 *   401/403 HANYA untuk kegagalan verifikasi.
 * Kalau dicoba dengan 403, Pakasir akan retry tanpa henti atas payload
 * yang memang tidak akan pernah valid. Dan order_id tak dikenal sering
 * terjadi (transaksi dibuat manual dari dashboard).
 */
@Controller('webhooks/pakasir')
export class PakasirController {
  private readonly logger = new Logger(PakasirController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pakasir: PakasirService,
    private readonly settlement: SettlementService,
  ) {}

  @Post()
  @HttpCode(200)
  @Public()
  async handle(
    @Headers('x-secret') xSecret: string | undefined,
    @Body() body: PakasirWebhookBody,
  ) {
    const gateway = await this.prisma.paymentGateway.findFirst({ where: { enabled: true } });
    if (!gateway) {
      this.logger.warn('webhook masuk tapi tidak ada gateway aktif');
      return { status: 'ignored' };
    }
    const config = (gateway.config || {}) as Record<string, unknown>;

    // 1. shared secret
    if (!this.pakasir.verifySecret(config, xSecret)) {
      this.logger.warn('webhook ditolak: X-Secret tidak cocok');
      throw new UnauthorizedException('Invalid webhook secret');
    }

    // 2. field wajib
    const txnId = body.txn_id;
    const orderRef = body.order_id;
    if (!txnId || !orderRef) {
      this.logger.warn('webhook tidak lengkap, diabaikan');
      return { status: 'ignored' };
    }

    // 3. sandbox -> TIDAK pernah menyentuh produksi
    if (body.is_sandbox === true) {
      await this.recordEvent(gateway.id, txnId, 'sandbox', body, 'ignored_sandbox');
      return { status: 'ignored', reason: 'sandbox' };
    }

    // gatewayOrderRef hanya ber-index, bukan UNIQUE (satu order bisa punya
    // beberapa transaksi setelah retry), jadi pakai findFirst.
    const order = await this.prisma.order.findFirst({
      where: { gatewayOrderRef: orderRef },
      include: { payments: true, items: { include: { booking: true } } },
    });
    if (!order) {
      // 200, bukan 404: transaksi dari dashboard Pakasir juga sampai ke sini.
      await this.recordEvent(gateway.id, txnId, 'unknown_order', body, 'unknown_order');
      return { status: 'ignored', reason: 'unknown_order' };
    }

    // 4. nominal harus cocok — ini verifikasi bermakna.
    if (body.amount !== undefined && Number(body.amount) !== Number(order.total)) {
      this.logger.error(
        `amount mismatch untuk order ${order.id}: webhook ${body.amount} vs order ${Number(order.total)}`,
      );
      await this.prisma.auditLog.create({
        data: {
          id: randomUUID(),
          entityType: 'Order',
          entityId: order.id,
          action: 'webhook_amount_mismatch',
          actorType: 'GATEWAY',
          actorId: 'PAKASIR',
          meta: { webhookAmount: body.amount, orderTotal: Number(order.total), txnId },
        },
      });
      throw new ForbiddenException('Amount mismatch');
    }

    // 5. duplikat?
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { gateway_gatewayTxnId: { gateway: gateway.id, gatewayTxnId: txnId } },
    });
    if (existing) {
      return { status: 'duplicate' };
    }

    const status = String(body.status || '').toLowerCase();
    if (status !== 'completed' && status !== 'pending' && status !== 'canceled') {
      await this.recordEvent(gateway.id, txnId, status || 'unknown', body, 'ignored_status');
      return { status: 'ignored', reason: 'status_not_handled' };
    }
    if (status === 'pending') {
      await this.recordEvent(gateway.id, txnId, status, body, 'ignored_pending');
      return { status: 'pending' };
    }

    if (status === 'canceled') {
      // Gateway yang bilang batal. Booking HELD tidak otomatis EXPIRED di
      // sini: settlement tetap_monopol-owner pelepasan slot, supaya tidak
      // ada dua jalan melepas slot yang bisa tidak sinkron.
      await this.recordEvent(gateway.id, txnId, status, body, 'processed_canceled');
      return { status: 'processed', payment: 'canceled' };
    }

    // 6. completed -> konfirmasi
    const payment = order.payments.find((p: { status: string }) => p.status === 'PENDING') ?? order.payments[0];
    if (!payment) {
      await this.recordEvent(gateway.id, txnId, status, body, 'no_pending_payment');
      return { status: 'ignored', reason: 'no_pending_payment' };
    }

    try {
      await this.recordEvent(gateway.id, txnId, status, body, 'processed');
    } catch (err: any) {
      // Unique violation = delivery paralel menang. Aman: dia yang proses.
      if (err?.code === 'P2002') return { status: 'duplicate' };
      throw err;
    }

    const booking = order.items[0]?.booking;
    if (!booking) {
      return { status: 'ignored', reason: 'no_booking' };
    }

    await this.settlement.confirmPaid({
      bookingId: booking.id,
      orderId: order.id,
      paymentId: payment.id,
      txnId,
      actor: 'webhook',
      meta: { completedAt: body.completed_at },
    });

    return { status: 'processed' };
  }

  private async recordEvent(
    gatewayId: string,
    txnId: string,
    eventType: string,
    payload: unknown,
    outcome: string,
  ) {
    await this.prisma.webhookEvent.create({
      data: {
        id: randomUUID(),
        gateway: gatewayId,
        gatewayTxnId: txnId,
        eventType,
        payload: payload as any,
        outcome,
        processedAt: outcome === 'processed' ? new Date() : null,
      },
    });
  }
}