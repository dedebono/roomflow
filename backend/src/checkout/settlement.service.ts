import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PakasirService } from '../pakasir/pakasir.service';
import { Role } from '@prisma/client';

const SWEEP_INTERVAL_MS = 60_000;
const RECONCILE_INTERVAL_MS = 5 * 60_000;
const CART_GC_INTERVAL_MS = 60 * 60_000;
const SWEEP_BATCH = 50;
const SWEEP_CONCURRENCY = 5; // rate limit cancel-transaction: 2 req/detik
const ORDER_GRACE_MS = 60_000;

/**
 * Settlement: satu-satunya jalan melepas slot.
 *
 * Prinsip (keputusan "tanpa refund"):
 *   SLOT TIDAK PERNAH DILEPAS SEBELUM GATEWAY MENGAKUI TRANSAKSI ITU
 *   TIDAK DIBAYAR.
 *
 * Karena tidak ada refund, tidak ada cara menarik kembali uang yang sudah
 * masuk. Kalau slot dilepas tepat di menit 15 dan user membayar di menit
 * 16, uang itu masuk untuk slot yang sudah diberikan orang lain.
 *
 * Karena itu Booking tidak pernah langsung EXPIRED. Ia masuk ke
 * `settling = true` dan MENGGUNGGU verdict gateway. Selama settling, slot
 * tetap terkunci (status masih HELD, jadi predicate exclusion tetap kena).
 */
@Injectable()
export class SettlementService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettlementService.name);
  private sweepTimer?: NodeJS.Timeout;
  private reconcileTimer?: NodeJS.Timeout;
  private gcTimer?: NodeJS.Timeout;
  private sweeping = false;
  private reconciling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly pakasir: PakasirService,
  ) {}

  onModuleInit() {
    // Jeda awal supaya proses lain selesai boot.
    setTimeout(() => {
      this.sweepTimer = setInterval(() => void this.runSweep(), SWEEP_INTERVAL_MS);
      this.reconcileTimer = setInterval(() => void this.runReconciliation(), RECONCILE_INTERVAL_MS);
      this.gcTimer = setInterval(() => void this.gcCarts(), CART_GC_INTERVAL_MS);
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    if (this.gcTimer) clearInterval(this.gcTimer);
  }

  // ---------------------------------------------------------------------------
  // Job 1 — settlement sweep (per menit)
  // ---------------------------------------------------------------------------

  async runSweep(): Promise<{ processed: number; confirmed: number; expired: number; skipped: number }> {
    if (this.sweeping) {
      this.logger.warn('sweep sebelumnya masih jalan, dilewati');
      return { processed: 0, confirmed: 0, expired: 0, skipped: 0 };
    }
    this.sweeping = true;
    const stats = { processed: 0, confirmed: 0, expired: 0, skipped: 0 };
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT b.id            AS booking_id,
               b."roomId"      AS room_id,
               b."startTime"   AS start_time,
               b."endTime"     AS end_time,
               o.id            AS order_id,
               o."userId"      AS user_id,
               o.total         AS total,
               p.id            AS payment_id,
               p."gatewayTxnId" AS txn_id
          FROM "Booking" b
          JOIN "OrderItem" oi ON oi."bookingId" = b.id
          JOIN "Order" o ON o.id = oi."orderId"
          LEFT JOIN "Payment" p ON p."orderId" = o.id AND p.status = 'PENDING'
         WHERE b.status = 'HELD'
           AND b.settling = true
           AND b."holdExpiresAt" <= now()
         ORDER BY b."roomId", b."startTime"
         LIMIT ${SWEEP_BATCH}
         FOR UPDATE OF b SKIP LOCKED
      `;
      // Booking settling yang TIDAK punya OrderItem sama sekali (hold yatim
      // dari sebelum migrasi, atau order yang gagal dibuat) tidak muncul
      // di query di atas karena itu INNER JOIN. Kalau tidak ditangani
      // terpisah, baris-baris itu memblokir slot SELAMANYA: tidak ada
      // invoice untuk ditanyakan ke gateway, jadi tidak ada jalur kode
      // yang pernah mengubahnya, dan sweep tidak pernah melihatnya.
      //
      // Halaman iniHO coarse: JANGAN pernah menganggap cancel-dulu-lebih-
      // dulu di sini. Booking tanpa OrderItem berarti tidak ada transaksi
      // gateway — jadi tidak ada yang bisa membayarnya, dan melepasnya
      // tidak mungkin melewatkan uang.
      const orphans = await this.prisma.$executeRaw`
        UPDATE "Booking" b
           SET status = 'EXPIRED', settling = false, "settledAt" = now(), "updatedAt" = now()
          FROM (
            SELECT b2.id
              FROM "Booking" b2
             WHERE b2.status = 'HELD'
               AND b2."holdExpiresAt" <= now()
               AND NOT EXISTS (SELECT 1 FROM "OrderItem" oi WHERE oi."bookingId" = b2.id)
             LIMIT ${SWEEP_BATCH}
             FOR UPDATE OF b2 SKIP LOCKED
          ) orphan
         WHERE b.id = orphan.id
      `;
      if (orphans > 0) {
        stats.expired += orphans;
        stats.processed += orphans;
        this.logger.log(`sweep: ${orphans} booking tanpa OrderItem di-expire (hold yatim)`);
      }

      // Hanya keluar setelah jalur orphan selesai. Versi sebelumnya punya
      // early-return SEBELUM cek orphan, jadi tepat ketika semua booking
      // yang tersisa adalah yatim, sweep keluar tanpa membersihkan
      // apa pun — persis kasus yang membuat blok orphan tidak pernah
      // tereksekusi.
      if (rows.length === 0) return stats;

      // Konkurensi dibatasi: endpoint cancel shared, rate limit 2/detik.
      for (let i = 0; i < rows.length; i += SWEEP_CONCURRENCY) {
        const batch = rows.slice(i, i + SWEEP_CONCURRENCY);
        const results = await Promise.all(batch.map((r) => this.settleRow(r)));
        for (const r of results) {
          if (r === 'confirmed') stats.confirmed++;
          else if (r === 'expired') stats.expired++;
          else if (r === 'skipped') stats.skipped++;
        }
        stats.processed += batch.length;
      }
      if (stats.processed > 0) {
        this.logger.log(
          `sweep: ${stats.processed} diproses, ${stats.confirmed} confirmed, ${stats.expired} expired, ${stats.skipped} ditunda`,
        );
      }
    } catch (err: any) {
      this.logger.error(`sweep error: ${err.message}`);
    } finally {
      this.sweeping = false;
    }
    return stats;
  }

  /**
   * Satu baris = satu Order. steps:
   *   1. CANCEL dulu di gateway (membekukan pembayaran)
   *   2. baru tanya status (menangkap pembayaran yang sudah in-flight)
   *   3. terapkan hasil dalam satu transaksi
   *
   * Urutan TIDAK BOLEH dibalik. Kalau status dicek dulu lalu cancel, ada
   * jeda tempat user menekan tombol bayar; gateway mencatat completed, kita
   * sudah melepas slot, dan uangnya hilang tanpa refund.
   */
  private async settleRow(row: any): Promise<'confirmed' | 'expired' | 'skipped'> {
    const { booking_id, order_id, payment_id, txn_id, total } = row;

    if (!txn_id) {
      // Order dibuat tapi gateway tidak pernah mengembalikan txn_id
      // (crash setelah commit). Tidak mungkin ada yang membayar karena QRIS
      // belum pernah dibuat -> aman expire.
      await this.expireOrder(
        booking_id,
        order_id,
        payment_id,
        'gateway_transaction_missing',
      );
      return 'expired';
    }

    const gatewayId = await this.gatewayIdFor();

    // STEP 1 — bekukan dulu.
    try {
      await this.pakasir.cancelTransaction(gatewayId, txn_id);
    } catch (err: any) {
      // Fail-closed: gateway tidak merespons -> jangan ubah apa pun.
      // Slot tetap terkunci, sweep berikutnya coba lagi.
      this.logger.error(`cancel gagal untuk txn ${txn_id}: ${err.message}; ditunda (fail-closed)`);
      return 'skipped';
    }

    // STEP 2 — tanyakan keadaan.
    let status: string;
    let completedAt: string | undefined;
    try {
      const st = await this.pakasir.getTransactionStatus(gatewayId, txn_id);
      status = String(st.status || '').toLowerCase();
      completedAt = st.completed_at;
    } catch (err: any) {
      this.logger.error(`status gagal untuk txn ${txn_id}: ${err.message}; ditunda (fail-closed)`);
      return 'skipped';
    }

    if (status === 'completed') {
      await this.confirmPaid({
        bookingId: booking_id,
        orderId: order_id,
        paymentId: payment_id,
        txnId: txn_id,
        actor: 'settlement_late_payment',
        meta: { holdExpiredFirst: true, completedAt },
      });
      return 'confirmed';
    }

    await this.expireOrder(
      booking_id,
      order_id,
      payment_id,
      'gateway_reported_not_paid',
      { status },
    );
    return 'expired';
  }

  private async gatewayIdFor(): Promise<string> {
    const gw = await this.prisma.paymentGateway.findFirst({ where: { enabled: true } });
    if (!gw) throw new Error('no enabled payment gateway');
    return gw.id;
  }

  /**
   * Terapkan "uang masuk" -> Booking CONFIRMED, Order PAID.
   *
   * Idempotent: kalau Order sudah PAID, langsung return. Ini yang membuat
   * sweep + webhook bisa berjalan bersamaan tanpa efek ganda.
   */
  async confirmPaid(args: {
    bookingId: string;
    orderId: string;
    paymentId: string;
    txnId?: string | null;
    actor: string;
    meta?: Record<string, unknown>;
  }): Promise<boolean> {
    const { bookingId, orderId, paymentId, txnId, actor, meta } = args;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true },
    });
    if (!order) return false;
    if (order.status === 'PAID') return false; // sudah diproses

    const wasSettling = await this.prisma.booking
      .findUnique({ where: { id: bookingId }, select: { settling: true, status: true } })
      .then((b) => !!b?.settling);

    // The order-status guard is CONDITIONAL (updateMany, not update): three
    // parallel webhook deliveries all read AWAITING_PAYMENT before any of
    // them commits, so a check-then-write would send three notifications
    // and write three AuditLog rows. Only the transaction that actually
    // flips AWAITING_PAYMENT -> PAID is the winner; the rest see count = 0
    // and return false without any side effect.
    // LATE PAYMENT: uang masuk setelah slot seharusnya dilepas.
    //
    // Dengan cancel-dulu-lebih-dulu, booking yang settling TIDAK PERNAH
    // dilepas sebelum gatewayxiv menyatakan tidak dibayar — jadi cabang ini
    // secara praktis sangat jarang. Tapi "sangat jarang" bukan "tidak pernah":
    // admin bisa cancel manual, atau data bisa dimanipulasi. Kalau slot
    // sudah diambil booking LAIN, konfirmasi diam-diam akan menciptakan
    // dua booking untuk slot yang sama (dilarang constraint), dan
    // mengorbankan pelanggan yang payset-nya sah.
    //
    // Kebijakan: JANGAN konfirmasi. Tandai needs_refund + beri tahu manager.
    // Karena kebijakan refund selalu manual, minimal sistem harus RECORD
    // permintaannya — kalau tidak, uang customer tersangkut diam-diam.
    if (meta?.wasSettling) {
      const item = await this.prisma.orderItem.findFirstOrThrow({ where: { orderId } });
      const squatter = await this.prisma.booking.findFirst({
        where: {
          roomId: item.roomId,
          status: { in: ['HELD', 'CONFIRMED'] },
          startTime: { lt: item.endTime },
          endTime: { gt: item.startTime },
          NOT: { id: bookingId },
        },
        select: { id: true },
      });
      if (squatter) {
        await this.prisma.auditLog.create({
          data: {
            id: randomUUID(),
            entityType: 'Order',
            entityId: orderId,
            action: 'late_payment_slot_taken',
            actorType: 'GATEWAY',
            actorId: 'PAKASIR',
            meta: { bookingId, txnId, conflictWith: squatter.id, ...(meta ?? {}) },
          },
        });
        await this.notifyManagers(
          `LATE PAYMENT: order ${orderId.slice(0, 8)} dibayar setelah slot dipakai booking lain. ` +
            `Booking dibatalkan, perlu refund manual. Booking pembayar: ${bookingId.slice(0, 8)}, ` +
            `pemegang slot: ${squatter.id.slice(0, 8)}.`,
        );
        await this.prisma.booking.updateMany({
          where: { id: bookingId, status: 'HELD' },
          data: { status: 'CANCELLED', cancelledAt: new Date(), settling: false, settledAt: new Date() },
        });
        await this.prisma.order.update({
          where: { id: orderId },
          data: { settledAt: new Date() },
        });
        void this.notifications
          .create(
            order.userId,
            'LATE_PAYMENT',
            'Pembayaran diterima, slot sudah dipakai',
            'Pembayaran kamu masuk, tapi slotnya sudah dipakai. Tim kami akan menghubungi soal refund.',
            JSON.stringify({ orderId, bookingId }),
          )
          .catch(() => undefined);
        return false;
      }
    }

    const won = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: 'AWAITING_PAYMENT' },
        data: { status: 'PAID', paidAt: new Date(), settledAt: new Date() },
      });
      if (count === 0) return false;

      await tx.booking.updateMany({
        where: { id: bookingId, status: 'HELD' },
        data: {
          status: 'CONFIRMED',
          settling: false,
          confirmedAt: new Date(),
          settledAt: new Date(),
        },
      });
      await tx.payment.updateMany({
        where: { id: paymentId, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date(), gatewayTxnId: txnId ?? undefined },
      });
      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          entityType: 'Order',
          entityId: orderId,
          action: wasSettling ? 'settled' : 'payment_confirmed',
          toState: 'PAID',
          actorType: 'GATEWAY',
          actorId: 'PAKASIR',
          meta: { bookingId, txnId, actor, ...(meta ?? {}) },
        },
      });
      return true;
    });
    if (!won) return false;

    // Notifikasi SELALU setelah commit.
    void this.notifications
      .create(
        order.userId,
        'PAYMENT_APPROVED',
        'Pembayaran diterima',
        wasSettling
          ? 'Pembayaran Anda diterima meski telat. Ruangan tetap Anda pakai.'
          : 'Pembayaran Anda telah dikonfirmasi.',
        JSON.stringify({ orderId, bookingId }),
      )
      .catch((e) => this.logger.error(`notify paid: ${e.message}`));

    return true;
  }

  /** Gateway membuktikan tidak ada uang -> baru boleh lepas slot. */
  private async expireOrder(
    bookingId: string,
    orderId: string,
    paymentId: string | null,
    reason: string,
    meta: Record<string, unknown> = {},
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'AWAITING_PAYMENT') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: { id: bookingId, status: 'HELD' },
        data: { status: 'EXPIRED', settling: false, settledAt: new Date() },
      });
      if (paymentId) {
        await tx.payment.updateMany({
          where: { id: paymentId, status: 'PENDING' },
          data: { status: 'FAILED' },
        });
      }
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'EXPIRED', settledAt: new Date() },
      });
      // Idempotensi sweep: index unik "one_settlement_per_booking" membuat
      // duplikasi jadi error yang TERLIHAT, bukan AuditLog rangkap senyap.
      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          entityType: 'Order',
          entityId: orderId,
          action: 'settled',
          toState: 'EXPIRED',
          actorType: 'SYSTEM',
          meta: { bookingId, reason, ...meta },
        },
      });
    });

    void this.notifications
      .create(
        order.userId,
        'ORDER_EXPIRED',
        'Pesanan kedaluwarsa',
        'Tahan slot habis tanpa pembayaran, jadi slot dilepas.',
        JSON.stringify({ orderId, reason }),
      )
      .catch(() => undefined);
  }

  // ---------------------------------------------------------------------------
  // Job 2 — rekonsiliasi (tiap 5 menit)
  // ---------------------------------------------------------------------------

  async runReconciliation(): Promise<{ checked: number; mismatched: number }> {
    if (this.reconciling) return { checked: 0, mismatched: 0 };
    this.reconciling = true;
    let checked = 0;
    let mismatched = 0;
    try {
      const stuck = await this.prisma.$queryRaw<any[]>`
        SELECT o.id AS order_id, o."userId" AS user_id, o.total AS total,
               o."gatewayTxnId" AS txn_id, o.status AS order_status,
               b.id AS booking_id, b.status AS booking_status, b.settling AS settling
          FROM "Order" o
          JOIN "OrderItem" oi ON oi."orderId" = o.id
          JOIN "Booking" b ON b.id = oi."bookingId"
         WHERE o.status = 'AWAITING_PAYMENT'
           AND b.status = 'HELD'
           AND (b."holdExpiresAt" <= now() - interval '10 minutes' OR b.settling = true)
         LIMIT 100
      `;

      const gatewayId = await this.gatewayIdFor();

      for (const row of stuck) {
        checked++;
        // Order tanpa txn_id dan sudah lewat grace period: tidak mungkin
        // ada yang bisa bayar -> expire.
        if (!row.txn_id) {
          const ageMs = Date.now() - new Date(row.created_at ?? Date.now()).getTime();
          if (ageMs > ORDER_GRACE_MS || row.settling) {
            const payment = await this.prisma.payment.findFirst({
              where: { orderId: row.order_id, status: 'PENDING' },
              select: { id: true },
            });
            await this.expireOrder(
              row.booking_id,
              row.order_id,
              payment?.id ?? null,
              row.settling ? 'settlement_without_gateway_transaction' : 'order_grace_elapsed',
            );
          }
          continue;
        }

        let st: any;
        try {
          st = await this.pakasir.getTransactionStatus(gatewayId, row.txn_id);
        } catch (err: any) {
          this.logger.error(`reconcile status gagal ${row.order_id}: ${err.message}`);
          continue; // fail-closed
        }

        const status = String(st.status || '').toLowerCase();

        // Nominal berbeda: jangan pernah auto-CONFIRM. Ini bisa berarti salah
        // input, bisa berarti manipulasi. Sistem tidak boleh menebak.
        if (Number(st.amount) !== Number(row.total)) {
          mismatched++;
          await this.prisma.auditLog.create({
            data: {
              id: randomUUID(),
              entityType: 'Order',
              entityId: row.order_id,
              action: 'amount_mismatch',
              actorType: 'SYSTEM',
              meta: { gatewayAmount: st.amount, orderTotal: Number(row.total), txnId: row.txn_id },
            },
          });
          await this.notifyManagers(
            `Amount mismatch order ${row.order_id.slice(0, 8)}: masuk Rp ${Number(st.amount).toLocaleString('id-ID')}, order Rp ${Number(row.total).toLocaleString('id-ID')}. Jangan auto-konfirmasi.`,
          );
          continue;
        }

        const payment = await this.prisma.payment.findFirst({
          where: { orderId: row.order_id, status: 'PENDING' },
          select: { id: true },
        });
        if (!payment) continue;

        if (status === 'completed') {
          // termasuk kasus "webhook datang setelah slot dilepas" — namun
          // dengan cancel-dulu, slot TIDAK bisa terlepas lebih dulu.
          await this.confirmPaid({
            bookingId: row.booking_id,
            orderId: row.order_id,
            paymentId: payment.id,
            txnId: row.txn_id,
            actor: 'reconciliation',
            meta: { completedAt: st.completed_at },
          });
        } else if (row.settling) {
          await this.expireOrder(row.booking_id, row.order_id, payment.id, 'reconciliation_not_paid', {
            gatewayStatus: status,
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`reconciliation error: ${err.message}`);
    } finally {
      this.reconciling = false;
    }
    if (checked > 0) this.logger.log(`reconciliation: ${checked} dicek, ${mismatched} mismatch`);
    return { checked, mismatched };
  }

  private async notifyManagers(message: string) {
    const managers = await this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN_IT, Role.ROOM_ADMIN] } },
      select: { id: true },
    });
    for (const m of managers) {
      void this.notifications
        .create(m.id, 'LATE_PAYMENT', 'Rekonsiliasi pembayaran', message, JSON.stringify({}))
        .catch(() => undefined);
    }
  }

  // ---------------------------------------------------------------------------
  // Job 4 — housekeeping keranjang
  // ---------------------------------------------------------------------------

  async gcCarts() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const items = await this.prisma.cartItem.deleteMany({ where: { createdAt: { lt: cutoff } } });
    const carts = await this.prisma.$executeRaw`
      DELETE FROM "Cart" c
       WHERE NOT EXISTS (SELECT 1 FROM "CartItem" i WHERE i."cartId" = c.id)
    `;
    if (items.count > 0) this.logger.log(`cart gc: ${items.count} item dihapus`);
    void carts;
  }

  // ---------------------------------------------------------------------------
  // Bootstrap: tandai hold yang TTL-nya sudah lewat sebagai settling.
  // Dipanggil saat service start supaya restart tidak meninggalkan slot
  // yang memblokir tanpa ada yang menyelesaikan.
  // ---------------------------------------------------------------------------

  async bootstrapSettling() {
    const res = await this.prisma.$executeRaw`
      UPDATE "Booking"
         SET settling = true, "updatedAt" = now()
       WHERE status = 'HELD'
         AND settling = false
         AND "holdExpiresAt" <= now()
    `;
    if (res > 0) this.logger.log(`bootstrap: ${res} hold ditandai settling`);
  }
}