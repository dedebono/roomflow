import { randomUUID } from 'node:crypto';
import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PakasirService } from '../pakasir/pakasir.service';
import { CheckoutDto, CartItemDto, StaffBookingDto } from './dto/checkout.dto';
import { Prisma, BookingStatus, BookingSource, Role } from '@prisma/client';

const HOLD_TTL_MINUTES = 15;
const EXTEND_MINUTES = 5;
const MAX_ACTIVE_ORDERS_PER_USER = 3;
const SLOT_MINUTES_DEFAULT = 60;

/**
 * Mode QA: gateway dilewati, checkout langsung jadi PAID.
 *
 * Hanya untuklingkungan uji — TIDAK untuk produksi. Tanpa ini, QA butuh
 * kunci gateway asli dan uang asli hanya untuk membuktikan tombol
 * "Checkout" bekerja. Set PAYMENT_BYPASS=true di environment backend.
 * Jawabannya tetap 201 dengan order PAID, jadi frontend tidak perlu tahu.
 */
const PAYMENT_BYPASS = process.env.PAYMENT_BYPASS === 'true';

export type ApiError = {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  detail?: unknown;
};

/** Error dengan bentuk seragam di seluruh API. */
export class ApiFail extends HttpException {
  constructor(
    code: string,
    message: string,
    status: number,
    retryable: boolean,
    detail?: unknown,
    retryAfterSeconds?: number,
  ) {
    const body: ApiError = { code, message, retryable };
    if (detail !== undefined) body.detail = detail;
    if (retryAfterSeconds !== undefined) body.retryAfterSeconds = retryAfterSeconds;
    super(body, status);
  }
}

/**
 * CheckoutService adalah SATU-SATUNYA tempat yang boleh membuat Booking
 * berstatus HELD atau CONFIRMED. Semua jalur lain (checkout renter, booking
 * staff, approval change request) memanggilnya.
 *
 * Kalau suatu saat ada endpoint yang INSERT Booking HELD/CONFIRMED di luar
 * service ini, seluruhALLYaman dari exclusion constraint runtuh.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly pakasir: PakasirService,
  ) {}

  // ---------------------------------------------------------------------------
  // Util waktu — nominal-UTC. Lihat catatan timezone di schema.prisma.
  // ---------------------------------------------------------------------------

  private hhmmOf(value: string | Date): string {
    const s = typeof value === 'string' ? value : value.toISOString();
    if (s.includes('T')) return s.substring(11, 16);
    return s.length >= 5 ? s.substring(0, 5) : '';
  }

  private minuteOfDay(value: string | Date): number {
    const [h, m] = this.hhmmOf(value).split(':').map(Number);
    return h * 60 + m;
  }

  /** 1=Senin .. 7=Minggu. */
  private isoDayOfWeek(d: Date): number {
    return ((d.getUTCDay() + 6) % 7) + 1;
  }

  private asNominalDate(iso: string): Date {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      throw new ApiFail('INVALID_TIME', `Waktu tidak valid: ${iso}`, HttpStatus.UNPROCESSABLE_ENTITY, false);
    }
    return d;
  }

  // ---------------------------------------------------------------------------
  // Keranjang — TIDAK mengunci apa pun.
  // ---------------------------------------------------------------------------

  private async getOrCreateCart(userId: string) {
    const existing = await this.prisma.cart.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { id: randomUUID(), userId } });
  }

  async getCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { } } },
    });
    const items = cart?.items ?? [];
    const total = items.reduce((sum, i) => sum + Number(i.priceSnapshot), 0);
    return { items, total };
  }

  async addCartItem(userId: string, dto: CartItemDto) {
    const start = this.asNominalDate(dto.startTime);
    const end = this.asNominalDate(dto.endTime);
    const price = await this.validateRentalWindow(dto.roomId, start, end);

    const cart = await this.getOrCreateCart(userId);
    // Sengaja TIDAK mengecek bentrok dengan booking lain: keranjang memang
    // tidak mengunci dan memang boleh berisi slot yang sudah diambil.
    try {
      const item = await this.prisma.cartItem.create({
        data: {
          id: randomUUID(),
          cartId: cart.id,
          roomId: dto.roomId,
          startTime: start,
          endTime: end,
          priceSnapshot: price,
        },
      });
      const all = await this.prisma.cartItem.findMany({ where: { cartId: cart.id } });
      return {
        item,
        total: all.reduce((s, i) => s + Number(i.priceSnapshot), 0),
      };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ApiFail(
          'DUPLICATE_CART_ITEM',
          'Item yang sama sudah ada di keranjang.',
          HttpStatus.UNPROCESSABLE_ENTITY,
          false,
        );
      }
      throw err;
    }
  }

  async removeCartItem(userId: string, itemId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new ApiFail('CART_EMPTY', 'Keranjang kosong.', HttpStatus.NOT_FOUND, false);
    const deleted = await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cartId: cart.id },
    });
    if (deleted.count === 0) {
      throw new ApiFail('CART_ITEM_NOT_FOUND', 'Item tidak ada di keranjang.', HttpStatus.NOT_FOUND, false);
    }
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { items: [], total: 0 };
  }

  // ---------------------------------------------------------------------------
  // Validasi jam operasional
  // ---------------------------------------------------------------------------

  /** Rentang harus UTUH di dalam satu RentalSlot renter. */
  private async validateRentalWindow(roomId: string, start: Date, end: Date) {
    if (start >= end) {
      throw new ApiFail('INVALID_RANGE', 'Jam mulai harus sebelum jam selesai.', HttpStatus.UNPROCESSABLE_ENTITY, false);
    }
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new ApiFail('ROOM_NOT_FOUND', 'Ruangan tidak ditemukan.', HttpStatus.NOT_FOUND, false);
    if (!room.isRentable) {
      throw new ApiFail('ROOM_NOT_RENTABLE', 'Ruangan ini tidak disewakan.', HttpStatus.FORBIDDEN, false);
    }
    if (room.status !== 'ACTIVE') {
      throw new ApiFail('ROOM_CLOSED', 'Ruangan sedang tidak aktif.', HttpStatus.CONFLICT, false);
    }

    const slotMinutes = room.slotMinutes || SLOT_MINUTES_DEFAULT;
    const mins = (end.getTime() - start.getTime()) / 60000;
    if (mins % slotMinutes !== 0) {
      throw new ApiFail(
        'INVALID_DURATION',
        `Durasi harus kelipatan ${slotMinutes} menit.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
        false,
      );
    }
    if (mins > (room.maxBookingHours ?? 24) * 60) {
      throw new ApiFail(
        'TOO_LONG',
        `Maksimal ${room.maxBookingHours ?? 24} jam per pemesanan.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
        false,
      );
    }

    const dow = this.isoDayOfWeek(start);
    const slots = await this.prisma.rentalSlot.findMany({
      where: { roomId, dayOfWeek: dow, isActive: true },
    });
    const sMin = this.minuteOfDay(start);
    const eMin = this.minuteOfDay(end);
    // Harus UTUH di dalam SATU slot. Dua slot yang berdampingan tidak
    // dianggap satu: menggabungkan 09-10 dan 10-11 jadi 09-11 akan
    // memberi user satu order untuk slot yang di tengahnya bisa diambil
    // orang lain.
    const slot = slots.find((s) => {
      const a = this.minuteOfDay(s.startTime);
      const b = this.minuteOfDay(s.endTime);
      return a <= sMin && eMin <= b;
    });
    if (!slot) {
      throw new ApiFail(
        'OUTSIDE_RENTAL_HOURS',
        'Jam tersebut di luar jam sewa ruangan.',
        HttpStatus.UNPROCESSABLE_ENTITY,
        false,
        { dayOfWeek: dow, requestedStart: this.hhmmOf(start), requestedEnd: this.hhmmOf(end) },
      );
    }
    return Number(slot.price);
  }

  /** Rentang harus UTUH di dalam satu StaffWindow. */
  private async validateStaffWindow(roomId: string, start: Date, end: Date) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { staffWindows: true },
    });
    if (!room) throw new ApiFail('ROOM_NOT_FOUND', 'Ruangan tidak ditemukan.', HttpStatus.NOT_FOUND, false);
    if (room.status !== 'ACTIVE') {
      throw new ApiFail('ROOM_CLOSED', 'Ruangan sedang tidak aktif.', HttpStatus.CONFLICT, false);
    }
    if (start >= end) {
      throw new ApiFail('INVALID_RANGE', 'Jam mulai harus sebelum jam selesai.', HttpStatus.UNPROCESSABLE_ENTITY, false);
    }
    const slotMinutes = room.slotMinutes || SLOT_MINUTES_DEFAULT;
    const mins = (end.getTime() - start.getTime()) / 60000;
    if (mins % slotMinutes !== 0) {
      throw new ApiFail(
        'INVALID_DURATION',
        `Durasi harus kelipatan ${slotMinutes} menit.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
        false,
      );
    }

    const dow = this.isoDayOfWeek(start);
    const sMin = this.minuteOfDay(start);
    const eMin = this.minuteOfDay(end);
    const ok = room.staffWindows.some(
      (w) => w.dayOfWeek === dow && w.startMin <= sMin && eMin <= w.endMin,
    );
    if (!ok) {
      throw new ApiFail(
        'OUTSIDE_STAFF_HOURS',
        'Di luar jam kerja. Ruangan hanya bisa dipinjam staff di dalam jam operasional.',
        HttpStatus.UNPROCESSABLE_ENTITY,
        false,
        { dayOfWeek: dow, requestedStart: this.hhmmOf(start), requestedEnd: this.hhmmOf(end) },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Inti: hold atomik
  // ---------------------------------------------------------------------------

  /**
   * Satu transaksi, all-or-nothing, kunci slot dalam urutan tetap.
   *
   * URUTAN WAJIB:
   *   1. cek settling  -> kalau ada booking yang verdict-nya belum keluar, STOP
   *   2. reaping      -> ttl habis & belum settling -> flag settling
   *   3. insert HELD  -> exclusion constraint yang memutuskan
   *
   * Kalau langkah 1 dilewati, checkout bisa mengambil slot yang uangnya
   * masih mungkin masuk — persis skenario yang menghapus seluruh aturan
   * "tanpa refund".
   */
  private async acquireHolds(
    tx: Prisma.TransactionClient,
    userId: string,
    items: { roomId: string; start: Date; end: Date; price: number }[],
    options: { source?: BookingSource; bookingId?: string; orderId?: string | null } = {},
  ) {
    // Urutan tetap untuk mencegah deadlock antar-checkout multi-item.
    const sorted = [...items].sort(
      (a, b) =>
        a.roomId.localeCompare(b.roomId) || a.start.getTime() - b.start.getTime(),
    );

    for (const it of sorted) {
      // 1. masih ada yang menunggu verdict gateway?
      const pending = await tx.booking.findFirst({
        where: {
          roomId: it.roomId,
          status: BookingStatus.HELD,
          settling: true,
          startTime: { lt: it.end },
          endTime: { gt: it.start },
        },
        select: { id: true },
      });
      if (pending) {
        throw new ApiFail(
          'SETTLEMENT_PENDING',
          'Slot ini sedang diverifikasi pembayaran. Coba beberapa saat lagi.',
          HttpStatus.CONFLICT,
          true,
          { roomId: it.roomId },
          30,
        );
      }

      // 2. reaping sinkron. UPDATE ini juga mengambil row lock, jadi
      //    transaksi pesaing untuk slot sama akan menunggu di titik ini.
      await tx.$executeRaw`
        UPDATE "Booking"
           SET settling = true, "updatedAt" = now()
         WHERE "roomId" = ${it.roomId}
           AND status = 'HELD'
           AND settling = false
           AND "holdExpiresAt" <= now()
           AND "startTime" < ${it.end}
           AND "endTime" > ${it.start}
      `;
    }

    // 3. insert. Constraint yangMutakhir, bukan logika di atas.
    const source = options.source ?? BookingSource.RENTAL;
    const isInternal = source === BookingSource.INTERNAL;
    const created: { id: string; roomId: string; price: number }[] = [];
    for (let idx = 0; idx < sorted.length; idx++) {
      const it = sorted[idx];
      // Booking staff boleh punya id yang ditentukan pemanggil supaya
      // bisa langsung di-CONFIRM di dalam transaksi yang sama.
      const id = options.bookingId ?? randomUUID();
      try {
        await tx.$executeRaw`
          INSERT INTO "Booking"
            (id, "roomId", "userId", title, "startTime", "endTime", status, source,
             "isRental", "holdExpiresAt", settling, "holdExtended", "priceSnapshot",
             "orderId", "createdAt", "updatedAt")
          VALUES
            (${id}, ${it.roomId}, ${userId}, ${'Rental'}, ${it.start}, ${it.end},
             'HELD', ${source}::"BookingSource", ${!isInternal},
             -- TTL WAJIB interval literal. make_interval(mins => $1) TIDAK
             -- boleh dipakai: Prisma mengirim parameter numerik untuknya dan
             -- Postgres mengabaikannya, sehingga holdExpiresAt = now() dan
             -- hold langsung dianggap expired.
             now() + interval '15 minutes',
             false, false, ${it.price},
             ${isInternal ? null : options.orderId ?? null}, now(), now())
        `;
        created.push({ id, roomId: it.roomId, price: it.price });
      } catch (err: any) {
        if (this.isExclusionViolation(err)) {
          throw new ApiFail(
            'SLOT_TAKEN',
            'Slot sudah diambil.',
            HttpStatus.CONFLICT,
            true,
            { roomId: it.roomId, startTime: it.start, endTime: it.end },
          );
        }
        throw err;
      }
    }
    return created;
  }

  /**
   * Deadlock (40P01) saat dua checkout berebut slot yang tumpang tindih:
   * A mengunci lewat INSERT, lalu reaping-nya mengunci baris yang dipegang B,
   * sementara B sudah menunggu A. Exclusion constraint TIDAK rusak — ini
   * siklus lock biasa. Postgres sudah mendeteksi dan membatalkan salah
   * satu transaksi, jadi cukup ulangi dari awal dengan jeda singkat.
   */
  /** Ulangi transaksi saat Postgres membatalkan karena deadlock. */
  private async withDeadlockRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err: any) {
        if (!this.isDeadlock(err) || i === attempts - 1) throw err;
        // Jeda acak supaya dua pihak tidak retry serempak.
        await new Promise((r) => setTimeout(r, 20 * (i + 1) + Math.random() * 40));
      }
    }
    throw new Error('unreachable');
  }

  private isDeadlock(err: any): boolean {
    const raw = err?.meta?.database_error || err?.message || '';
    return (
      err?.code === '40P01' ||
      String(raw).includes('40P01') ||
      String(raw).includes('deadlock detected')
    );
  }

  private isExclusionViolation(err: any): boolean {
    if (err?.code === 'P2004' && String(err?.meta?.database_error || '').includes('booking_no_overlap')) {
      return true;
    }
    const raw = err?.meta?.database_error || err?.message || '';
    return String(raw).includes('booking_no_overlap');
  }

  // ---------------------------------------------------------------------------
  // Checkout renter
  // ---------------------------------------------------------------------------

  async checkout(userId: string, dto: CheckoutDto, idempotencyKey?: string) {
    if (!idempotencyKey) {
      throw new ApiFail(
        'IDEMPOTENCY_KEY_REQUIRED',
        'Header Idempotency-Key wajib diisi untuk checkout.',
        HttpStatus.UNPROCESSABLE_ENTITY,
        false,
      );
    }

    // Retry klik ganda: key sama -> Order yang sama, gateway TIDAK dipanggil lagi.
    const existing = await this.prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: { items: true, payments: true },
    });
    if (existing) return this.decorateOrder(existing);

    // Batas jumlah order yang menunggu pembayaran.
    const active = await this.prisma.order.count({
      where: { userId, status: 'AWAITING_PAYMENT' },
    });
    if (active >= MAX_ACTIVE_ORDERS_PER_USER) {
      throw new ApiFail(
        'TOO_MANY_ACTIVE_ORDERS',
        `Kamu punya ${active} pesanan yang belum dibayar. Selesaikan atau tunggu kedaluwarsa.`,
        HttpStatus.CONFLICT,
        false,
      );
    }

    // Validasi bentuk + harga (harga di-SNAPSHOT saat checkout, bukan saat
    // masuk keranjang: yang dipikul user adalah harga yang dia lihat saat
    // menekan tombol bayar).
    const priced: { roomId: string; start: Date; end: Date; price: number }[] = [];
    for (const item of dto.items) {
      const start = this.asNominalDate(item.startTime);
      const end = this.asNominalDate(item.endTime);
      const price = await this.validateRentalWindow(item.roomId, start, end);
      priced.push({ roomId: item.roomId, start, end, price });
    }
    const total = priced.reduce((s, i) => s + i.price, 0);

    const orderId = randomUUID();
    const gatewayOrderRef = `RF-${orderId.slice(0, 8)}-${Date.now()}`;

    let orderWithItems: any;
    try {
      orderWithItems = await this.withDeadlockRetry(() =>
        this.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            id: orderId,
            userId,
            status: 'AWAITING_PAYMENT',
            total,
            idempotencyKey,
            gateway: 'PAKASIR',
            gatewayOrderRef,
          },
        });
        const bookings = await this.acquireHolds(tx, userId, priced, { orderId: order.id });
        for (let i = 0; i < priced.length; i++) {
          const b = bookings[i];
          await tx.orderItem.create({
            data: {
              id: randomUUID(),
              orderId: order.id,
              bookingId: b.id,
              roomId: priced[i].roomId,
              startTime: priced[i].start,
              endTime: priced[i].end,
              priceSnapshot: priced[i].price,
            },
          });
          await tx.auditLog.create({
            data: {
              id: randomUUID(),
              entityType: 'Booking',
              entityId: b.id,
              action: 'hold_acquired',
              toState: 'HELD',
              actorType: 'USER',
              actorId: userId,
              meta: { orderId: order.id, total },
            },
          });
        }
        await tx.payment.create({
          data: {
            id: randomUUID(),
            orderId: order.id,
            userId,
            gateway: 'PAKASIR',
            status: 'PENDING',
            amount: total,
          },
        });
          return tx.order.findUniqueOrThrow({
            where: { id: order.id },
            include: { items: true, payments: true },
          });
        }),
      );
    } catch (err: any) {
      if (err instanceof ApiFail) throw err;
      if (this.isExclusionViolation(err)) {
        throw new ApiFail('SLOT_TAKEN', 'Slot sudah diambil.', HttpStatus.CONFLICT, true);
      }
      // Unique violation pada (userId, idempotencyKey) = request paralel dengan
      // key sama. Order-nya sudah ada, kembalikan itu.
      if (err?.code === 'P2002') {
        const again = await this.prisma.order.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
          include: { items: true, payments: true },
        });
        if (again) return this.decorateOrder(again);
      }
      throw err;
    }

    // NOTIFIKASI DI LUAR TRANSAKSI. Panggilan HTTP (WAHA/email) di dalam
    // transaksi bisa menggantung atau rollback seluruh CONFIRMED kalau
    // layanan luar lambat.
    void this.notifications
      .create(
        userId,
        'BOOKING_CREATED',
        'Slot ditahan sementara',
        `Slot ditahan ${HOLD_TTL_MINUTES} menit. Selesaikan pembayaran sebelum waktu habis.`,
        JSON.stringify({ orderId: orderWithItems.id }),
      )
      .catch((e) => this.logger.error(`notify hold: ${e.message}`));

    // Gateway DI LUAR transaksi, dan Order sudah tersimpan sebelum dipanggil —
    // jadi kalau response hilang lalu di-retry, Pakasir find-or-create
    // mengembalikan transaksi yang sama, bukan membuat yatim.
    // attachPayment memanggil gateway DI LUAR transaksi (butuh HTTP).
    // Kalau gateway gagal, hold + Order SUDAH commit — tidak ada yang
    // membatalkannya, sehingga slot terkunci 15 menit tanpa ada invoice
    // untuk dibayar. Renter berikutnya dapat 409 tanpa sebab yang bisa
    // dia pahami, dan order itu menggantung sebagai AWAITING_PAYMENT
    // dengan gatewayTxnId kosong sampai sweep menyentuhnya.
    //
    // Ditemukan lewat uji curl produksi: Pakasir membalas 429 rate limit,
    // dua order tetap tercipta tanpa invoice.
    try {
      return await this.attachPayment(orderWithItems, dto);
    } catch (err: any) {
      await this.releaseOrderAfterGatewayFailure(orderWithItems.id, err);
      throw err;
    }
  }

  /**
   * Lepas booking milik satu order setelah kegagalan gateway.
   *
   * Idempoten dan aman dipanggil berkali-kali. Tidak melempar error ke
   * pemanggil — kegagalan melepas slot HARUS dicatat, bukan disembunyikan
   * di balik error gateway yang jadi penyebabnya.
   */
  private async releaseOrderAfterGatewayFailure(orderId: string, cause: any): Promise<void> {
    try {
      const { count } = await this.prisma.booking.updateMany({
        where: { orderItem: { orderId }, status: { in: ['HELD', 'CONFIRMED'] } },
        data: {
          status: 'CANCELLED',
          settling: false,
          cancelledAt: new Date(),
          settledAt: new Date(),
        },
      });
      await this.prisma.order.updateMany({
        // Order enum hanya punya AWAITING_PAYMENT/PAID/EXPIRED (tidak ada
        // CANCELLED karena tidak ada refund). Order yang gagal di gateway
        // tidak pernah dibayar, jadi EXPIRED adalah status yang tepat —
        // sama dengan order yang hold-nya habis tanpa dibayar.
        where: { id: orderId, status: 'AWAITING_PAYMENT' },
        data: { status: 'EXPIRED', settledAt: new Date() },
      });
      await this.prisma.auditLog.create({
        data: {
          id: randomUUID(),
          entityType: 'Order',
          entityId: orderId,
          action: 'hold_released_gateway_failure',
          toState: 'EXPIRED',
          actorType: 'SYSTEM',
          meta: {
            bookingsReleased: count,
            cause: String(cause?.message ?? cause).slice(0, 300),
          },
        },
      });
      this.logger.warn(
        `order ${orderId}: lepaskan ${count} booking karena gateway gagal (${String(
          cause?.message ?? cause,
        ).slice(0, 120)})`,
      );
    } catch (releaseErr: any) {
      // Jangan menimpa error asli, tapi jangan diamkan juga: hold yatim
      // memblokir slot sampai sweep mengubahnya EXPIRED.
      this.logger.error(
        `GAGAL melepas hold order ${orderId}: ${releaseErr?.message}. Slot tetap terkunci sampai sweep.`,
      );
    }
  }

  private async attachPayment(order: any, dto: CheckoutDto) {
    if (PAYMENT_BYPASS) {
      return this.settleWithoutGateway(order);
    }
    const gatewayId = dto.gatewayId ?? (await this.defaultGatewayId());
    if (!gatewayId) {
      throw new ApiFail('NO_GATEWAY', 'Tidak ada payment gateway aktif.', HttpStatus.SERVICE_UNAVAILABLE, true);
    }
    const payment = order.payments[0];

    // Retry: kalau gatewayTxnId sudah ada, jangan panggil lagi.
    if (order.gatewayTxnId && order.gatewayOrderRef) {
      return this.decorateOrder(order);
    }

    const txn = await this.pakasir.createTransaction(gatewayId, {
      orderId: order.gatewayOrderRef!,
      amount: Number(order.total),
      method: dto.method || 'qris',
    });

    // Verifikasi TTL invoice vs TTL hold. Invoice yang hidup lebih lama
    // dari hold = user bisa membayar ke invoice yang kita anggap sudah
    // mati, dan uang itu tidak punya booking.
    const gatewayExpiry = txn.expired_at ? new Date(txn.expired_at) : null;
    const hold = await this.prisma.booking.findFirst({
      where: { orderItem: { orderId: order.id } },
      select: { holdExpiresAt: true },
    });
    const holdExpiry = hold?.holdExpiresAt ?? null;

    // Masa berlaku invoice Effective = min(gateway, hold).
    //
    // Sebelumnya expiresAt = gatewayExpiry mentah. Dua masalah:
    //   - Gateway sandbox/tidak mengirim expired_at -> Order.expiresAt NULL,
    //     jadi halaman pembayaran menampilkan "—" untuk countdown dan user
    //     tidak tahu kapan slot-nya lepas.
    //   - Kalau gateway mengirim expiry LEBIH LAMA dari hold, invoice tetap
    //     hidup padahal slot sudah dilepas.
    //
    // Aturannya sederhana: invoice tidak boleh lebih lama dari slotnya, dan
    // kalau gateway tidak memberi expiry, berpegang pada hold.
    let expiresAt: Date | null;
    if (gatewayExpiry && holdExpiry) {
      if (gatewayExpiry.getTime() > holdExpiry.getTime()) {
        this.logger.warn(
          `gateway expired_at ${gatewayExpiry.toISOString()} > hold ${holdExpiry.toISOString()} untuk order ${order.id}; memotong invoice`,
        );
        await this.pakasir
          .cancelTransaction(gatewayId, txn.txn_id)
          .catch((e) => this.logger.error(`cancel overlong invoice: ${e.message}`));
        throw new ApiFail(
          'INVOICE_LONGER_THAN_HOLD',
          'Masa berlaku invoice lebih lama dari tahan slot. Silakan ulangi.',
          HttpStatus.SERVICE_UNAVAILABLE,
          true,
        );
      }
      expiresAt = gatewayExpiry;
    } else {
      // Tidak ada expiry dari gateway (atau tidak ada hold) -> pakai hold.
      expiresAt = holdExpiry ?? gatewayExpiry;
    }

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: order.id },
        data: { gatewayTxnId: txn.txn_id, expiresAt },
      }),
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          gatewayTxnId: txn.txn_id,
          method: txn.payment_method || dto.method || 'qris',
          fee: txn.fee != null ? txn.fee : undefined,
          // Simpan payload gateway mentah. Tanpa ini, permintaan berikutnya
          // ke GET /orders/:id tidak punya qr_string/va_number untuk
          // ditampilkan — respons checkoutpertama punya, tapi polling
          // berikutnya tidak, jadi UI renter tiba-tiba kehilangan QR.
          rawPayload: txn as any,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          id: randomUUID(),
          entityType: 'Order',
          entityId: order.id,
          action: 'gateway_transaction_created',
          actorType: 'GATEWAY',
          actorId: 'PAKASIR',
          meta: { txnId: txn.txn_id, amount: txn.amount, fee: txn.fee, expiresAt },
        },
      }),
    ]);

    const reloaded = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, payments: true },
    });
    return this.decorateOrder(reloaded, txn);
  }

  /**
   * QA bypass: tanpa gateway, order langsung lunas.
   *
   * Booking CONFIRMED (bukan HELD) karena tidak ada invoice yang bisa
   * waited on — kalau dibiarkan HELD, slot terkunci 15 menit lalu expire
   * padahal tidak ada yang perlu dibayar.
   */
  private async settleWithoutGateway(order: any) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: now, settledAt: now, expiresAt: null },
      });
      await tx.booking.updateMany({
        where: { orderItem: { orderId: order.id }, status: 'HELD' },
        data: {
          status: 'CONFIRMED',
          settling: false,
          holdExpiresAt: null,
          confirmedAt: now,
          settledAt: now,
        },
      });
      await tx.payment.updateMany({
        where: { orderId: order.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt: now },
      });
      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          entityType: 'Order',
          entityId: order.id,
          action: 'payment_bypassed_qa',
          toState: 'PAID',
          actorType: 'SYSTEM',
          meta: { total: Number(order.total), note: 'PAYMENT_BYPASS=true' },
        },
      });
    });
    const reloaded = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, payments: true },
    });
    return this.decorateOrder(reloaded);
  }

  private async defaultGatewayId(): Promise<string | null> {
    const gw = await this.prisma.paymentGateway.findFirst({ where: { enabled: true } });
    return gw?.id ?? null;
  }

  private decorateOrder(order: any, txn?: any) {
    const holdExpiry = txn?.expired_at
      ? new Date(txn.expired_at)
      : order.expiresAt ?? null;
    return {
      order: {
        id: order.id,
        total: Number(order.total),
        status: order.status,
        expiresAt: order.expiresAt,
        createdAt: order.createdAt,
      },
      payment: {
        status: order.payments?.[0]?.status ?? 'PENDING',
        txnId: order.gatewayTxnId,
        method: txn?.payment_method ?? order.payments?.[0]?.method,
        amount: Number(order.total),
        fee: txn?.fee ?? null,
        qrString: txn?.qr_string ?? null,
        vaNumber: txn?.va_number ?? null,
        paymentUrl: txn?.txn_id ? this.pakasir.buildPaymentLink(txn.txn_id) : null,
      },
      hold: { expiresAt: holdExpiry },
      items: order.items?.length ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Perpanjang hold (sekali saja, +5 menit)
  // ---------------------------------------------------------------------------

  async extendHold(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { booking: true } }, payments: true },
    });
    if (!order || order.userId !== userId) {
      throw new ApiFail('ORDER_NOT_FOUND', 'Pesanan tidak ditemukan.', HttpStatus.NOT_FOUND, false);
    }
    if (order.status !== 'AWAITING_PAYMENT') {
      throw new ApiFail(
        'EXTEND_NOT_ALLOWED',
        'Pesanan sudah tidak menunggu pembayaran.',
        HttpStatus.CONFLICT,
        false,
      );
    }
    const booking = order.items[0]?.booking;
    if (!booking || !booking.holdExpiresAt) {
      throw new ApiFail('EXTEND_NOT_ALLOWED', 'Tidak ada hold aktif.', HttpStatus.CONFLICT, false);
    }
    if (booking.holdExtended) {
      throw new ApiFail(
        'EXTEND_NOT_ALLOWED',
        'Perpanjangan sudah dipakai.',
        HttpStatus.CONFLICT,
        false,
      );
    }
    if (booking.settling) {
      throw new ApiFail(
        'SETTLEMENT_PENDING',
        'Slot sedang diverifikasi pembayaran.',
        HttpStatus.CONFLICT,
        true,
        undefined,
        30,
      );
    }
    // Perpanjangan tidak memperpanjang invoice di gateway (API v2 tidak
    // punya itu). Kalau invoice sudah hampir mati, perpanjangan hanya
    // menahan slot tanpa gunanya.
    //
    // Catatan: `order.expiresAt` dibuat DALAM-transaksi yang sama dengan
    // booking dan nilainya sama dengan hold awal, jadi `Math.min(..., invoiceExpiry)`
    // selalu menghasilkan waktu yang SAMA dengan yang sudah ada — tombol
    // melaporkan "diperpanjang 5 menit" padahal tidak menambah apa pun
    // (ditemukan oleh audit QA). Invoice tidak bisa diperpanjang lewat API
    // gateway, jadi clamp ke invoice tidak ada artinya di sini; yang perlu
    // dijaga hanya jangan menahan slot jauh melewati TTL.
    const nowMs = Date.now();
    const invoiceExpiry = order.expiresAt?.getTime() ?? booking.holdExpiresAt.getTime();
    if (invoiceExpiry - nowMs < 2 * 60_000) {
      throw new ApiFail(
        'INVOICE_NEARLY_EXPIRED',
        'Invoice hampir kedaluwarsa. Silakan buat pesanan baru.',
        HttpStatus.CONFLICT,
        false,
      );
    }

    const newExpiry = new Date(booking.holdExpiresAt.getTime() + EXTEND_MINUTES * 60_000);
    await this.prisma.$transaction([
      this.prisma.booking.updateMany({
        where: { orderItem: { orderId: order.id }, holdExtended: false, settling: false },
        data: { holdExtended: true, holdExpiresAt: newExpiry },
      }),
      this.prisma.auditLog.create({
        data: {
          id: randomUUID(),
          entityType: 'Order',
          entityId: order.id,
          action: 'hold_extended',
          actorType: 'USER',
          actorId: userId,
          meta: { newExpiresAt: newExpiry.toISOString() },
        },
      }),
    ]);
    return { extended: true, hold: { expiresAt: newExpiry } };
  }

  async getOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { booking: true } }, payments: true },
    });
    if (!order || order.userId !== userId) {
      throw new ApiFail('ORDER_NOT_FOUND', 'Pesanan tidak ditemukan.', HttpStatus.NOT_FOUND, false);
    }
    const booking = order.items[0]?.booking;
    // Hold yang sudah dilepas (gateway menolak / kedaluwarsa) tidak boleh
    // dilaporkan sebagai "masih aktif". Order EXPIREDmeans slot sudah
    // kembali ke pool — menampilkan expiresAt 15 menit ke depan membuat
    // renter mengira slotnya terkunci padahal tidak, dan membuat QA menyimpulkan
    // slot yang bocor.
    const holdLive = booking?.status === 'HELD' || booking?.status === 'CONFIRMED';
    return {
      order: {
        id: order.id,
        total: Number(order.total),
        status: order.status,
        expiresAt: order.expiresAt,
      },
      payment: {
        status: order.payments?.[0]?.status ?? 'PENDING',
        txnId: order.gatewayTxnId,
        method: order.payments?.[0]?.method,
        amount: Number(order.total),
        fee: order.payments?.[0]?.fee ?? null,
        // PENTING: link pembayaran harus dibangun ulang dari txnId yang
        // tersimpan. Versi ini tidak mengirimnya sama sekali, jadi halaman
        // pembayaran menampilkan "metode sedang disiapkan" padahal transaksi
        // gateway sudah dibuat — renter tidak punya cara membayar.
        qrString: order.payments?.[0]?.rawPayload
          ? ((order.payments[0].rawPayload as any)?.qr_string ?? null)
          : null,
        vaNumber: order.payments?.[0]?.rawPayload
          ? ((order.payments[0].rawPayload as any)?.va_number ?? null)
          : null,
        paymentUrl: order.gatewayTxnId ? this.pakasir.buildPaymentLink(order.gatewayTxnId) : null,
      },
      hold: {
        expiresAt: holdLive ? (booking?.holdExpiresAt ?? null) : null,
        settling: booking?.settling ?? false,
        extended: booking?.holdExtended ?? false,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Booking staff (Role.USER) — instan, tanpa payment, hanya jam kerja.
  // ---------------------------------------------------------------------------

  async createStaffBooking(user: { id: string; role: Role }, dto: StaffBookingDto) {
    if (user.role === Role.RENTER) {
      throw new ApiFail(
        'ROLE_NOT_ALLOWED',
        'Endpoint ini hanya untuk staff. Renter harus lewat checkout.',
        HttpStatus.FORBIDDEN,
        false,
      );
    }
    const start = this.asNominalDate(dto.startTime);
    const end = this.asNominalDate(dto.endTime);
    await this.validateStaffWindow(dto.roomId, start, end);
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: dto.roomId } });

    const bookingId = randomUUID();
    try {
      await this.prisma.$transaction(async (tx) => {
        // Memakai jalur yang SAMA dengan checkout: reaping sinkron dulu, lalu
        // insert. Kalau booking staff punya jalur sendiri, dia bisa mendarat
        // di slot yang sedang disettle.
        await this.acquireHolds(
          tx,
          user.id,
          [{ roomId: dto.roomId, start, end, price: 0 }],
          { source: BookingSource.INTERNAL, bookingId },
        );
        await tx.$executeRaw`
          UPDATE "Booking"
             SET status = 'CONFIRMED', source = 'INTERNAL', "isRental" = false,
                 "holdExpiresAt" = NULL, settling = false,
                 "confirmedAt" = now(), title = ${dto.title}, notes = ${dto.notes ?? null}
           WHERE id = ${bookingId}
        `;
      });
    } catch (err: any) {
      if (err instanceof ApiFail) throw err;
      if (this.isExclusionViolation(err)) {
        throw new ApiFail(
          'SLOT_TAKEN',
          'Slot sudah dipakai.',
          HttpStatus.CONFLICT,
          true,
          { roomId: dto.roomId, startTime: start, endTime: end },
        );
      }
      throw err;
    }
    return this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { room: true, user: { select: { id: true, name: true, email: true } } },
    });
  }

  // ---------------------------------------------------------------------------
  // Booking saya
  // ---------------------------------------------------------------------------

  /**
   * Daftar ORDER milik user, bukan daftar Booking.
   *
   * Endpoint-nya /api/orders, jadi harus mengembalikan Order — dengan
   * items, payment, dan status pembayaran. Sebelumnya route ini memanggil
   * myBookings() dan mengembalikan baris Booking: field "total" tidak ada
   * (hanya priceSnapshot per item), status-nya status booking (HELD), dan
   * frontend tidak punya cara tahuorder-nya sudah dibayar atau belum.
   */
  async myOrders(userId: string, limit = 50) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async myBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: { room: { include: { building: true } } },
      orderBy: { startTime: 'desc' },
    });
  }

  /** Pembatalan hanya untuk booking staff: tidak ada uang yang perlu kembali. */
  async cancelStaffBooking(
    actor: { id: string; role: Role },
    bookingId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { room: true },
    });
    if (!booking) throw new ApiFail('BOOKING_NOT_FOUND', 'Booking tidak ditemukan.', HttpStatus.NOT_FOUND, false);

    if (booking.source === BookingSource.RENTAL) {
      throw new ApiFail(
        'CANNOT_CANCEL_PAID',
        'Booking yang sudah dibayar tidak bisa dibatalkan.',
        HttpStatus.FORBIDDEN,
        false,
      );
    }
    const isAdmin = actor.role === Role.ADMIN_IT || actor.role === Role.ROOM_ADMIN;
    if (!isAdmin && booking.userId !== actor.id) {
      throw new ApiFail('CANNOT_CANCEL_OTHERS', 'Kamu hanya bisa membatalkan booking sendiri.', HttpStatus.FORBIDDEN, false);
    }
    if (booking.status === BookingStatus.CANCELLED) {
      return booking;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED, cancelledAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          entityType: 'Booking',
          entityId: bookingId,
          action: 'staff_cancelled',
          fromState: booking.status,
          toState: 'CANCELLED',
          actorType: 'USER',
          actorId: actor.id,
          meta: { roomName: booking.room.name },
        },
      });
      return b;
    });

    void this.notifications
      .create(
        booking.userId,
        'BOOKING_CANCELLED',
        'Booking dibatalkan',
        `Booking ${booking.room.name} dibatalkan oleh ${isAdmin && booking.userId !== actor.id ? 'admin' : 'kamu'}.`,
        JSON.stringify({ bookingId }),
      )
      .catch(() => undefined);

    return updated;
  }
}
