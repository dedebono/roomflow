import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CheckoutService } from '../checkout/checkout.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingStatus, BookingSource, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';

/**
 * Bookings = booking STAFF (source='INTERNAL').
 *
 * PEMBEDAAN PERAN:
 *   RENTER -> TIDAK boleh lewat service ini. Renter lewat keranjang ->
 *            CheckoutService (Hold + Order + Payment).
 *   USER   -> booking instan, gratis, HANYA di dalam StaffWindow.
 *   ADMIN  -> bisa melihat/mengubah booking staff.
 *
 * Booking RENTAL (sudah dibayar) tidak bisa diedit lewat sini.
 *
 * CATATAN: pembuatan booking TIDAK lagi memakai INSERT langsung di file ini.
 * Semua jalur masuk ke CheckoutService.createStaffBooking supaya reaping
 * sinkron + exclusion constraint tetap berlaku. Kalau service ini punya
 * INSERT sendiri, slot bisa tertabrak constraint yang tidak dihitung.
 */
@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
    private checkoutService: CheckoutService,
  ) {}

  private assertNotRenter(role: Role) {
    if (role === Role.RENTER) {
      throw new ForbiddenException(
        'Renter harus memesan lewat keranjang dan pembayaran. Endpoint ini untuk staff.',
      );
    }
  }

  async create(userId: string, role: Role, dto: CreateBookingDto) {
    this.assertNotRenter(role);
    const booking = await this.checkoutService.createStaffBooking(
      { id: userId, role },
      {
        roomId: dto.roomId,
        title: dto.title,
        startTime: dto.startTime,
        endTime: dto.endTime,
        notes: dto.notes,
      },
    );

    if (booking.user.email) {
      await this.emailService
        .sendBookingConfirmation(
          booking.user.email,
          booking.title,
          booking.room.name,
          booking.startTime,
          booking.endTime,
        )
        .catch(() => undefined);
    }

    for (const admin of await this.adminIds()) {
      await this.notificationsService
        .create(
          admin.id,
          'BOOKING_CREATED',
          'New Booking',
          `${booking.user.name} booked "${booking.title}" in ${booking.room.name}.`,
        )
        .catch(() => undefined);
    }
    return booking;
  }

  private async adminIds() {
    return this.prisma.user.findMany({
      where: { role: { in: [Role.ROOM_ADMIN, Role.ADMIN_IT] } },
      select: { id: true },
    });
  }

  /**
   * Hanya booking aktif (HELD + CONFIRMED) yang tampil.
   * EXPIRED/CANCELLED sudah tidak memegang slot.
   */
  async findAll(roomId?: string, userId?: string, page?: number, limit?: number) {
    return this.prisma.booking.findMany({
      where: {
        roomId,
        userId,
        status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] },
      },
      skip: page ? (page - 1) * (limit || 20) : undefined,
      take: limit || 20,
      include: {
        room: { include: { building: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Pembatalan hanya booking STAFF. Booking RENTAL tidak bisa dibatalkan
   * siapa pun: uang sudah masuk, tidak ada jalur mengembalikannya.
   */
  async cancel(bookingId: string, userId: string, role: Role) {
    return this.checkoutService.cancelStaffBooking({ id: userId, role }, bookingId);
  }

  /**
   * Edit booking staff.
   *
   * Menggeser jadwal TIDAK dilakukan sebagai UPDATE startTime/endTime.
   * Langsung UPDATE bisa mendarat di slot yang sedang disettle atau di
   * slot yangConstraint-nya belum dihitung. Karena itu_user adjust
   * membuat change request, dan admin yang menyetujui lewat jalur yang
   * sudah計算 reaping + insert ulang.
   */
  async update(
    bookingId: string,
    actorId: string,
    role: Role,
    updateDto: UpdateBookingDto,
  ) {
    this.assertNotRenter(role);
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { room: true, user: { select: { id: true, email: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.source === BookingSource.RENTAL) {
      throw new ForbiddenException('Tidak bisa mengedit booking yang sudah dibayar.');
    }
    const isAdmin = role === Role.ADMIN_IT || role === Role.ROOM_ADMIN;
    if (!isAdmin && booking.userId !== actorId) {
      throw new ForbiddenException('Kamu hanya bisa mengubah booking sendiri.');
    }

    if (updateDto.startTime || updateDto.endTime || updateDto.roomId) {
      if (updateDto.roomId && updateDto.roomId !== booking.roomId) {
        throw new BadRequestException(
          'Pindah ruangan harus lewat change request; booking lama tidak ikut hilang.',
        );
      }
      return this.prisma.bookingChangeRequest.create({
        data: {
          id: randomUUID(),
          bookingId,
          requestedById: actorId,
          requestedStart: updateDto.startTime ? new Date(updateDto.startTime) : null,
          requestedEnd: updateDto.endTime ? new Date(updateDto.endTime) : null,
          reason: updateDto.notes ?? 'Staff meminta perubahan jadwal',
          kind: 'RESCHEDULE',
        },
        include: { booking: { include: { room: true } } },
      });
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { title: updateDto.title, notes: updateDto.notes },
    });
  }

  async findOne(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        room: { include: { building: true } },
        user: { select: { id: true, name: true, email: true } },
        orderItem: { include: { order: true } },
        changeRequests: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }
}
