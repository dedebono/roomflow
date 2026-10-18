import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiFail } from './checkout.service';
import { AddSeriesDto, SeriesDto } from './dto/series.dto';

const SLOT_MINUTES_DEFAULT = 60;
const DAY_MS = 86_400_000;

/**
 * Ekspansi paket sewa berkala menjadi daftar (tanggal, jam) konkret.
 *
 * Semua aritmetika memakai instant nominal-UTC (lihat catatan timezone di
 * schema.prisma): menambah 7 * DAY_MS ke instant UTC selalu mengembalikan
 * jam dinding yang SAMA persis, karena tidak ada DST di UTC. Kalau ini
 * dijumlah di zona Asia/Jakarta, setiap pergantian DST menggeser satu jam
 * dan seluruh sesi bergeser — itu bug ±7 jam yang sudah pernah muncul.
 *
 * Fungsi ini MURNI (tidak menyentuh DB) supaya bisa diuji tanpa database.
 */
export function expandSeries(
  series: SeriesDto,
  firstStartIso: string,
  firstEndIso: string,
): { start: Date; end: Date }[] {
  const firstStart = new Date(firstStartIso);
  const firstEnd = new Date(firstEndIso);
  const durationMs = firstEnd.getTime() - firstStart.getTime();

  if (Number.isNaN(firstStart.getTime()) || Number.isNaN(firstEnd.getTime())) {
    throw new ApiFail('INVALID_TIME', 'Tanggal/waktu tidak valid.', HttpStatus.UNPROCESSABLE_ENTITY, false);
  }
  if (durationMs <= 0) {
    throw new ApiFail('INVALID_RANGE', 'Jam mulai harus sebelum jam selesai.', HttpStatus.UNPROCESSABLE_ENTITY, false);
  }

  // Batas keras. Tanpa ini satu request bisa menghasilkan 7 hari x 400
  // item keranjang dan menahan ribuan slot hanya dalam keadaan HELD.
  const MAX_SESSIONS = 400;

  if (series.pattern === 'ONCE') {
    return [{ start: firstStart, end: firstEnd }];
  }

  const intervalWeeks =
    series.pattern === 'BIWEEKLY' ? 2 : (series.intervalWeeks ?? 1);

  let days: number[];
  if (series.pattern === 'CUSTOM') {
    if (!series.daysOfWeek || series.daysOfWeek.length === 0) {
      throw new ApiFail(
        'DAYS_REQUIRED',
        'Pilih minimal satu hari untuk pola mingguan.',
        HttpStatus.UNPROCESSABLE_ENTITY,
        false,
      );
    }
    days = [...new Set(series.daysOfWeek)].sort((a, b) => a - b);
    for (const d of days) {
      if (d < 1 || d > 7) {
        throw new ApiFail(
          'INVALID_DAY',
          `Hari harus 1 (Senin) sampai 7 (Minggu), dapat ${d}.`,
          HttpStatus.UNPROCESSABLE_ENTITY,
          false,
        );
      }
    }
  } else {
    // WEEKLY / BIWEEKLY: hari yang sama dengan tanggal pertama.
    days = [isoDow(firstStart)];
  }

  const maxOccurrences = series.occurrences ?? null;
  // `until` dikirim sebagai tanggal saja (YYYY-MM-DD), jadi artinya
  // "sampai akhir hari itu". Kalau dibandingkan apa adanya, batasnya jatuh
  // di tengah malam dan sesi terakhir (mis. Senin 30 Nov 09:00) terpotong.
  const until = series.until ? parseDateOnly(series.until).getTime() + DAY_MS - 1 : null;

  if (maxOccurrences == null && until == null) {
    throw new ApiFail(
      'SERIES_NEEDS_END',
      'Tentukan jumlah sesi atau tanggal berakhir.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      false,
    );
  }
  if (until != null && until < firstStart.getTime()) {
    throw new ApiFail(
      'INVALID_UNTIL',
      'Tanggal berakhir tidak boleh sebelum tanggal mulai.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      false,
    );
  }

  const out: { start: Date; end: Date }[] = [];
  const wanted = new Set(days);
  // Mulai dari hari pertama paket (bukan awal minggu) supaya tanggal yang
  // diklik user selalu jadi sesi nomor satu, lalu lanjut per siklus 7 hari.
  const firstStartMs = firstStart.getTime();
  const durationMin = durationMs / 60000;

  // Pagar keras terhadap pola yang tidak menghasilkan apa-apa (misal
  // occurrences sangat besar sementara until sudah lewat): tanpa ini loop
  // bisa berjalan tanpa henti.
  const HARD_LOOP_CAP = 4000;
  let cycle = 0;
  let done = false;

  while (!done && cycle < HARD_LOOP_CAP) {
    const cycleBase = firstStartMs + cycle * intervalWeeks * 7 * DAY_MS;
    // Berhenti kalau siklus ini MULAI setelah tanggal berakhir. Pakai `>`,
    // bukan `>=`: siklus yang mulai tepat di `until` masih mungkin punya sesi
    // di hari yang sama, dan memotongnya di sini menghilangkan tanggal terakhir.
    if (until != null && cycleBase > until) break;

    for (let offset = 0; offset < 7; offset++) {
      const t = cycleBase + offset * DAY_MS;
      if (until != null && t > until) break;
      if (!wanted.has(isoDow(new Date(t)))) continue;
      out.push({ start: new Date(t), end: new Date(t + durationMin * 60000) });
      if (out.length >= MAX_SESSIONS) {
        done = true;
        break;
      }
      // occurrences adalah batas KERAS, bukan saran: begitu tercapai, loop
      // berhenti sepenuhnya. Memecahkannya hanya di inner loop membuat
      // outer loop tetap jalan dan menambah 400 sesi.
      if (maxOccurrences != null && out.length >= maxOccurrences) {
        done = true;
        break;
      }
    }
    cycle++;
  }

  if (maxOccurrences != null && out.length < maxOccurrences) {
    throw new ApiFail(
      'SERIES_TOO_SHORT',
      `Pola ini hanya menghasilkan ${out.length} sesi sebelum tanggal berakhir. Perpanjang tanggal atau kurangi jumlah sesi.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      false,
      { produced: out.length, requested: maxOccurrences },
    );
  }
  if (out.length === 0) {
    throw new ApiFail(
      'SERIES_EMPTY',
      'Pola ini tidak menghasilkan tanggal yang valid.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      false,
    );
  }
  return out;
}

/** 1=Senin .. 7=Minggu. */
export function isoDow(d: Date): number {
  return ((d.getUTCDay() + 6) % 7) + 1;
}

/** "YYYY-MM-DD" -> instant UTC tengah malam. Menolak input lain. */
function parseDateOnly(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new ApiFail(
      'INVALID_DATE',
      'Tanggal harus format YYYY-MM-DD.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      false,
    );
  }
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new ApiFail('INVALID_DATE', `Tanggal tidak valid: ${s}`, HttpStatus.UNPROCESSABLE_ENTITY, false);
  }
  return d;
}

@Injectable()
export class SeriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Preview paket sewa: daftar tanggal + harga per sesi, TANPA menulis.
   * Frontend memakai ini untuk menampilkan "12 sesi, total Rp X" sebelum
   * user menekan tombol. Endpoint ini tidak mengunci apa pun.
   */
  async preview(dto: AddSeriesDto) {
    const sessions = expandSeries(dto.series, dto.startTime, dto.endTime);
    const rooms = await this.prisma.room.findMany({
      where: { id: { in: dto.roomIds } },
      include: { rentalSlots: { where: { isActive: true } } },
    });
    if (rooms.length !== dto.roomIds.length) {
      throw new ApiFail('ROOM_NOT_FOUND', 'Sebagian ruangan tidak ditemukan.', HttpStatus.NOT_FOUND, false);
    }

    const lines: any[] = [];
    const rejected: any[] = [];
    for (const room of rooms) {
      for (const s of sessions) {
        try {
          const price = this.priceFor(room, s.start, s.end);
          lines.push({
            roomId: room.id,
            roomName: room.name,
            startTime: s.start.toISOString(),
            endTime: s.end.toISOString(),
            price,
          });
        } catch (err: any) {
          // Preview tidak boleh gagal total karena satu tanggal di luar jam
          // sewa — user butuh melihat tanggal mana yang bermasalah.
          rejected.push({
            roomId: room.id,
            roomName: room.name,
            startTime: s.start.toISOString(),
            code: err?.getResponse?.().code ?? 'UNAVAILABLE',
            message: err?.getResponse?.().message ?? String(err?.message ?? err),
          });
        }
      }
    }

    return {
      label: dto.label ?? null,
      pattern: dto.series.pattern,
      sessions: sessions.length,
      rooms: rooms.length,
      total: lines.reduce((s, l) => s + l.price, 0),
      lines,
      rejected,
      firstStart: sessions[0].start.toISOString(),
      lastEnd: sessions[sessions.length - 1].end.toISOString(),
    };
  }

  /**
   * Simpan paket ke keranjang sebagai CartItem biasa.
   *
   * Sifat penting: keranjang TIDAK mengunci slot, dan paket ini tetap bisa
   * dipecah — user boleh menghapus satu sesi dari 12 tanpa kehilangan 11
   * lainnya. Kalau nanti butuh "hapus satu paket sekaligus", itu tambahan
   * kolom penanda di CartItem, bukan constraint database.
   */
  async addToCart(userId: string, dto: AddSeriesDto) {
    const preview = await this.preview(dto);
    if (preview.lines.length === 0) {
      throw new ApiFail(
        'SERIES_NO_SLOT',
        'Tidak ada satu pun tanggal yang cocok dengan jam sewa ruangan.',
        HttpStatus.UNPROCESSABLE_ENTITY,
        false,
        { rejected: preview.rejected.slice(0, 5) },
      );
    }

    let cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { id: randomUUID(), userId },
      });
    }

    // Samarkan item yang sudah ada supaya createMany tidak menabrak unique
    // constraint (cartId, roomId, startTime, endTime) — duplikat diabaikan,
    // bukan error 500.
    const existing = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      select: { roomId: true, startTime: true, endTime: true },
    });
    const key = (roomId: string, s: Date, e: Date) =>
      `${roomId}|${s.toISOString()}|${e.toISOString()}`;
    const seen = new Set(existing.map((i) => key(i.roomId, i.startTime, i.endTime)));
    const fresh = preview.lines.filter((l) => {
      const k = key(l.roomId, new Date(l.startTime), new Date(l.endTime));
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (fresh.length > 0) {
      await this.prisma.cartItem.createMany({
        data: fresh.map((l) => ({
          id: randomUUID(),
          cartId: cart!.id,
          roomId: l.roomId,
          startTime: new Date(l.startTime),
          endTime: new Date(l.endTime),
          priceSnapshot: l.price,
        })),
        skipDuplicates: true,
      });
    }

    return {
      added: fresh.length,
      duplicates: preview.lines.length - fresh.length,
      rejected: preview.rejected,
      cart: await this.loadCart(userId),
    };
  }

  private async loadCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { orderBy: { startTime: 'asc' } } },
    });
    const items = cart?.items ?? [];

    // CartItem menyimpan roomId sebagai String biasa (tanpa relasi Prisma),
    // jadi nama ruangan diambil lewat query kedua lalu disambung di memory.
    // Tanpa ini halaman keranjang selalu menampilkan "Ruangan" karena
    // item.room selalu undefined.
    const roomIds = [...new Set(items.map((i) => i.roomId))];
    const rooms = roomIds.length
      ? await this.prisma.room.findMany({
          where: { id: { in: roomIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(rooms.map((r) => [r.id, r.name]));

    return {
      items: items.map((i) => ({ ...i, roomName: nameById.get(i.roomId) ?? null })),
      total: items.reduce((s, i) => s + Number(i.priceSnapshot), 0),
    };
  }

  /**
   * Harga satu sesi dari RentalSlot hari itu.
   *
   * Versi ini DUPLIKAT dari CheckoutService.validateRentalWindow dengan
   * satu perbedaan penting: ia menerima room + slot SUDAH di-load, karena
   * satu paket bisa berisi ratusan sesi dan memanggil validateRentalWindow
   * per sesi berarti query database per sesi. Aturan bisnisnya harus
   * tetap sama: durasi harus kelipatan slot, dan rentang harus UTUH di
   * dalam SATU slot.
   */
  private priceFor(room: any, start: Date, end: Date): number {
    if (!room.isRentable) {
      throw new ApiFail('ROOM_NOT_RENTABLE', `Ruangan ${room.name} tidak disewakan.`, HttpStatus.FORBIDDEN, false);
    }
    if (room.status !== 'ACTIVE') {
      throw new ApiFail('ROOM_CLOSED', `Ruangan ${room.name} sedang tidak aktif.`, HttpStatus.CONFLICT, false);
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

    const dow = isoDow(start);
    const sMin = start.getUTCHours() * 60 + start.getUTCMinutes();
    const eMin = end.getUTCHours() * 60 + end.getUTCMinutes();

    const slot = (room.rentalSlots as any[]).find((s) => {
      if (s.dayOfWeek !== dow) return false;
      const a = Number(s.startTime.split(':')[0]) * 60 + Number(s.startTime.split(':')[1]);
      const b = Number(s.endTime.split(':')[0]) * 60 + Number(s.endTime.split(':')[1]);
      return a <= sMin && eMin <= b;
    });
    if (!slot) {
      throw new ApiFail(
        'OUTSIDE_RENTAL_HOURS',
        `Jam ${pad(sMin)}–${pad(eMin)} di luar jam sewa ruangan.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
        false,
      );
    }
    return Number(slot.price);
  }
}

function pad(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}