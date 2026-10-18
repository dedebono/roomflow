import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomCategory } from '@prisma/client';
import { getPrismaPagination } from '../common/dto/pagination.dto';

/**
 * Rentals = katalog + ketersediaan (READ-ONLY).
 *
 * Semua fungsi hold/cancel/book-from-hold yang ada di versi lama DIHAPUS:
 *   - create-hold / create-holds  -> kunci dipasang di CheckoutService
 *   - book-from-hold              -> Booking lahir dari Order, bukan hold
 *   - cancelHold / holds/:id      -> tanpa refund, tidak ada pembatalan renter
 *   - cancelExpiredHolds interval -> SettlementService, dan WAJIB cancel di
 *                                     gateway dulu sebelum melepas slot
 *   - getRenterStats              -> endpoint statistik dihapus
 *
 * Yang tersisa hanya adolescent yang tidak mengunci apa pun: daftar ruang,
 * kalender ketersediaan, dan konfigurasi slot harga.
 */
@Injectable()
export class RentalsService {
  private readonly logger = new Logger(RentalsService.name);

  constructor(private prisma: PrismaService) {}

  private toNominalUtc(date: string, hhmm: string): Date {
    return new Date(`${date}T${hhmm}:00.000Z`);
  }

  private hhmmOf(value: string | Date): string {
    const s = typeof value === 'string' ? value : value.toISOString();
    if (s.includes('T')) return s.substring(11, 16);
    return s.length >= 5 ? s.substring(0, 5) : '';
  }

  /** Ruangan sewa yang masih aktif. Tidak menyaring per tanggal. */
  async getAvailableRooms(category?: RoomCategory) {
    const rooms = await this.prisma.room.findMany({
      where: {
        isRentable: true,
        status: 'ACTIVE',
        category: category || undefined,
      },
      include: { building: true, rentalSlots: { where: { isActive: true } } },
    });
    return rooms.map((room) => ({
      ...room,
      price:
        room.rentalSlots.length > 0
          ? Math.min(...room.rentalSlots.map((s) => Number(s.price)))
          : 0,
    }));
  }

  async getRoomDetails(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        building: true,
        rentalSlots: { where: { isActive: true }, orderBy: { dayOfWeek: 'asc' } },
      },
    });
    if (!room) throw new NotFoundException(`Room with ID ${roomId} not found`);
    return room;
  }

  /**
   * Slot per jam untuk satu tanggal.
   *
   * Satu query rentang, bukan findMany per hari (versi lama melakukan
   * N+1 yang membuat kalender lambat — dan lambat itu muncul sebagai
   * SETTLEMENT_PENDING semu di produksi).
   *
   * Status aktif booking: HELD (termasuk settling) dan CONFIRMED. Keduanya
   * dipegang exclusion constraint, jadi keduanya memblokir.
   */
  async getAvailableSlots(roomId: string, date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // 400 bukan 409: format salah adalah kesalahan permintaan, bukan
      // konflik state. 409 di sini membuat klien menganggap slot bentrok.
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { rentalSlots: { where: { isActive: true } } },
    });
    if (!room) throw new NotFoundException('Room not found');

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    const dayOfWeek = ((dayStart.getUTCDay() + 6) % 7) + 1;

    const slots = room.rentalSlots
      .filter((s) => s.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (slots.length === 0) return [];

    const minStart = this.toNominalUtc(date, slots[0].startTime).getTime();
    const maxEnd = this.toNominalUtc(date, slots[slots.length - 1].endTime).getTime();

    const taken = await this.prisma.booking.findMany({
      where: {
        roomId,
        status: { in: ['HELD', 'CONFIRMED'] },
        startTime: { lt: new Date(maxEnd) },
        endTime: { gt: new Date(minStart) },
      },
      select: { startTime: true, endTime: true, settling: true },
    });

    const step = room.slotMinutes || 60;
    const out: any[] = [];
    for (const slot of slots) {
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);
      let cursor = sh * 60 + sm;
      const end = eh * 60 + em;
      while (cursor + step <= end) {
        const startMin = cursor;
        const endMin = cursor + step;
        const subStart = this.toNominalUtc(
          date,
          `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`,
        );
        const subEnd = this.toNominalUtc(
          date,
          `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
        );
        // Setengah terbuka: [09,10) vs [10,11) tidak bertabrakan.
        const busy = taken.some(
          (b) => b.startTime.getTime() < subEnd.getTime() && b.endTime.getTime() > subStart.getTime(),
        );
        out.push({
          id: `${slot.id}_${startMin}`,
          startTime: subStart.toISOString(),
          endTime: subEnd.toISOString(),
          price: Number(slot.price),
          available: !busy,
        });
        cursor = endMin;
      }
    }
    return out;
  }

  /**
   * Kalender bulanan.
   *
   * Satu query untuk seluruh bulan; hari yang "tidak ada slot" ditentukan
   * dari data RentalSlot, bukan dari panggilan per hari.
   */
  async getRoomAvailability(roomId: string, month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new ConflictException('Month must be in YYYY-MM format');
    }
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { rentalSlots: { where: { isActive: true } } },
    });
    if (!room) throw new NotFoundException(`Room with ID ${roomId} not found`);

    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();

    // Semua hari yang punya RentalSlot, dikelompokkan per tanggal.
    const byDow = new Map<number, any[]>();
    for (const s of room.rentalSlots) {
      const list = byDow.get(s.dayOfWeek) ?? [];
      list.push(s);
      byDow.set(s.dayOfWeek, list);
    }

    const rangeStart = new Date(`${month}-01T00:00:00.000Z`);
    const rangeEnd = new Date(Date.UTC(year, monthNum - 1, daysInMonth, 23, 59, 59, 999));
    const bookings = await this.prisma.booking.findMany({
      where: {
        roomId,
        status: { in: ['HELD', 'CONFIRMED'] },
        startTime: { lt: rangeEnd },
        endTime: { gt: rangeStart },
      },
      select: { startTime: true, endTime: true },
    });

    const step = room.slotMinutes || 60;
    const availability: Record<string, { available: boolean; hasSlots: boolean; reason?: string }> = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${month}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(Date.UTC(year, monthNum - 1, day));
      const dow = ((dateObj.getUTCDay() + 6) % 7) + 1;
      const slots = byDow.get(dow);

      if (!slots || slots.length === 0) {
        availability[dateStr] = { available: false, hasSlots: false, reason: 'OUTSIDE_HOURS' };
        continue;
      }
      if (bookings.length === 0) {
        availability[dateStr] = { available: true, hasSlots: true };
        continue;
      }

      let free = 0;
      for (const slot of slots) {
        const [sh, sm] = slot.startTime.split(':').map(Number);
        const [eh, em] = slot.endTime.split(':').map(Number);
        let cursor = sh * 60 + sm;
        const end = eh * 60 + em;
        while (cursor + step <= end) {
          const subStart = new Date(`${dateStr}T${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}:00.000Z`);
          const subEnd = new Date(`${dateStr}T${String(Math.floor((cursor + step) / 60)).padStart(2, '0')}:${String((cursor + step) % 60).padStart(2, '0')}:00.000Z`);
          const busy = bookings.some(
            (b) => b.startTime.getTime() < subEnd.getTime() && b.endTime.getTime() > subStart.getTime(),
          );
          if (!busy) free++;
          cursor += step;
        }
      }
      availability[dateStr] =
        free > 0
          ? { available: true, hasSlots: true }
          : { available: false, hasSlots: true, reason: 'SOLD_OUT' };
    }

    return { roomId, month, availability };
  }

  // --- Konfigurasi slot harga (admin) ---------------------------------------

  async getSlots(roomId?: string, page?: number, limit?: number) {
    const { skip, take } = getPrismaPagination(page, limit);
    return this.prisma.rentalSlot.findMany({
      where: { roomId },
      skip,
      take,
      include: { room: { include: { building: true } } },
      orderBy: [{ roomId: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createSlot(dto: any) {
    assertValidSlot(dto.roomId, dto.dayOfWeek, dto.startTime, dto.endTime, dto.price);
    return this.prisma.rentalSlot.create({
      data: dto,
      include: { room: { include: { building: true } } },
    });
  }

  async updateSlot(id: string, dto: any) {
    const slot = await this.prisma.rentalSlot.findUnique({ where: { id } });
    if (!slot) throw new NotFoundException(`RentalSlot with ID ${id} not found`);
    // partly-update: field yang tidak dikirim ikut memakai nilai lama.
    assertValidSlot(
      dto.roomId ?? slot.roomId,
      dto.dayOfWeek ?? slot.dayOfWeek,
      dto.startTime ?? slot.startTime,
      dto.endTime ?? slot.endTime,
      dto.price ?? slot.price,
    );
    return this.prisma.rentalSlot.update({
      where: { id },
      data: dto,
      include: { room: { include: { building: true } } },
    });
  }

  async deleteSlot(id: string) {
    const slot = await this.prisma.rentalSlot.findUnique({ where: { id } });
    if (!slot) throw new NotFoundException(`RentalSlot with ID ${id} not found`);
    return this.prisma.rentalSlot.delete({ where: { id } });
  }

  // --- Jam operasional staff -----------------------------------------------

  async getStaffWindows(roomId?: string) {
    return this.prisma.staffWindow.findMany({
      where: { roomId },
      include: { room: { include: { building: true } } },
      orderBy: [{ roomId: 'asc' }, { dayOfWeek: 'asc' }, { startMin: 'asc' }],
    });
  }

  async createStaffWindow(dto: any) {
    return this.prisma.staffWindow.create({
      data: {
        roomId: dto.roomId,
        dayOfWeek: dto.dayOfWeek,
        startMin: dto.startMin,
        endMin: dto.endMin,
      },
    });
  }

  async deleteStaffWindow(id: string) {
    return this.prisma.staffWindow.delete({ where: { id } });
  }

  /**
   * Overlap StaffWindow x RentalSlot diperingatkan, bukan dilarang.
   *
   * Kalau admin salah konfigurasi jam staff dan jam sewa bertabrakan, sistem
   * harus tetap benar: exclusion constraint yang menolak, bukan aturan
   * validasi. Melarangnya di sini berarti database tidak boleh jadi
   * sumber kebenaran tunggal.
   */
  async findWindowConflicts() {
    const conflicts: any[] = [];
    const rooms = await this.prisma.room.findMany({
      where: { isRentable: true },
      include: { staffWindows: true, rentalSlots: { where: { isActive: true } } },
    });
    for (const room of rooms) {
      for (const sw of room.staffWindows) {
        for (const rs of room.rentalSlots) {
          if (rs.dayOfWeek !== sw.dayOfWeek) continue;
          const [sh, sm] = rs.startTime.split(':').map(Number);
          const [eh, em] = rs.endTime.split(':').map(Number);
          const rsStart = sh * 60 + sm;
          const rsEnd = eh * 60 + em;
          if (sw.startMin < rsEnd && sw.endMin > rsStart) {
            conflicts.push({
              roomId: room.id,
              roomName: room.name,
              dayOfWeek: sw.dayOfWeek,
              staff: `${this.toClock(sw.startMin)}-${this.toClock(sw.endMin)}`,
              rental: `${rs.startTime}-${rs.endTime}`,
            });
          }
        }
      }
    }
    return conflicts;
  }

  private toClock(min: number) {
    return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  }

  /** Ringkasan untuk dasbor renter. */
  async getRenterStats(userId: string) {
    const [totalBookings, activeBookings, pendingHolds, availableRooms, recentActivity] =
      await Promise.all([
        this.prisma.booking.count({ where: { userId, status: 'CONFIRMED' } }),
        this.prisma.booking.count({
          where: { userId, status: 'CONFIRMED', endTime: { gte: new Date() } },
        }),
        this.prisma.order.count({ where: { userId, status: 'AWAITING_PAYMENT' } }),
        this.prisma.room.count({ where: { status: 'ACTIVE', isRentable: true } }),
        this.prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);
    return { totalBookings, activeBookings, pendingHolds, availableRooms, recentActivity };
  }
}

/**
 * Validasi slot sewa SEBELUM ditulis ke database.
 *
 * Tanpa ini backend menerima slot dengan jam terbalik (14:00-12:00) dan
 * menyimpannya sebagai "Active", sehingga ikut memengaruhi perhitungan
 * ketersediaan untuk renter — ditemukan oleh audit QA.
 *
 * DTO saja tidak cukup untuk perbandingan antar-field, jadi dicek di sini
 * (dijalankan untuk create DAN update).
 */
function assertValidSlot(
  roomId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  price: number,
) {
  if (!roomId || typeof roomId !== 'string') {
    throw new BadRequestException('roomId wajib diisi.');
  }
  // Seluruh codebase memakai 1=Senin..7=Minggu (lihat isoDayOfWeek).
  // DTO lama mengizinkan 0..6, dan slot ber-dayOfWeek 0 tidak akan pernah
  // cocok dengan perhitungan ketersediaan.
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
    throw new BadRequestException(
      `dayOfWeek harus 1 (Senin) sampai 7 (Minggu), dapat ${dayOfWeek}.`,
    );
  }
  const hm = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const s = hm.exec(String(startTime));
  const e = hm.exec(String(endTime));
  if (!s || !e) {
    throw new BadRequestException(
      `Format jam harus HH:MM 24 jam, got start="${startTime}" end="${endTime}".`,
    );
  }
  const startMin = Number(s[1]) * 60 + Number(s[2]);
  const endMin = Number(e[1]) * 60 + Number(e[2]);
  if (endMin <= startMin) {
    throw new BadRequestException(
      `Jam selesai (${endTime}) harus setelah jam mulai (${startTime}).`,
    );
  }
  if (!Number.isFinite(Number(price)) || Number(price) < 0) {
    throw new BadRequestException('Harga harus angka >= 0.');
  }
}
