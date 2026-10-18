import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { ChangeRequestStatus, ChangeRequestKind, BookingSource, Role, NotificationType } from '@prisma/client';

/**
 * Change request = STAFF menggeser jadwal booking sendiri, disetujui admin.
 *
 * Booking RENTAL (sudah dibayar) tidak boleh punya change request sama
 * sekali: tidak ada refund, jadi memindahkan jadwal setelah bayar hanya
 * menambah ambigu tanpa ada mekanisme penyelesaian.
 *
 * PERUBAHAN DESAIN: requestedRoomId DIHAPUS. Memindahkan booking ke ruang
 * lain berarti membuat booking baru di ruang lain yang mungkin sudah
 * bentrok dengan booking milik requester sendiri — dan tidak ada satu
 * baris pun yang exclusion constraint tangkap. Room jadi immutable; yang
 * bisa berubah hanya jam.
 *
 * APPROVE = approve-then-reinsert, bukan UPDATE. Booking lama yang sedang
 * HELD/settling sudah memegang slot; slot tujuan bisa saja sudah diambil
 * orang lain sejak request dibuat. Kalau insert baru ditolak constraint,
 * ROLLBACK dan request tetap PENDING — admin bisa coba lagi nanti.
 */
@Injectable()
export class BookingChangeRequestsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, role: Role, dto: CreateChangeRequestDto) {
    if (role === Role.RENTER) {
      throw new ForbiddenException('Change request hanya untuk booking staff.');
    }
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { room: true, user: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('Bukan booking milikmu');
    }
    if (booking.source === BookingSource.RENTAL) {
      throw new ForbiddenException('Booking yang sudah dibayar tidak bisa diubah.');
    }
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Hanya booking terkonfirmasi yang bisa diajukan.');
    }

    const hasStart = !!dto.requestedStart;
    const hasEnd = !!dto.requestedEnd;
    if (hasStart !== hasEnd) {
      throw new BadRequestException('Jam mulai dan jam selesai harus diisi berdua.');
    }
    if (!hasStart && !dto.reason) {
      throw new BadRequestException('Isi jam baru atau alasan perubahan.');
    }

    const request = await this.prisma.bookingChangeRequest.create({
      data: {
        id: randomUUID(),
        bookingId: dto.bookingId,
        requestedById: userId,
        requestedStart: hasStart ? new Date(dto.requestedStart!) : null,
        requestedEnd: hasEnd ? new Date(dto.requestedEnd!) : null,
        reason: dto.reason,
        kind: hasStart ? ChangeRequestKind.RESCHEDULE : ChangeRequestKind.CANCEL,
      },
      include: {
        booking: { include: { room: true } },
        requestedBy: { select: { name: true, email: true } },
      },
    });

    const admins = await this.prisma.user.findMany({
      where: { role: { in: [Role.ROOM_ADMIN, Role.ADMIN_IT] } },
    });
    for (const admin of admins) {
      await this.emailService
        .sendChangeRequestStatus(
          admin.email,
          booking.title,
          'PENDING',
          `Permintaan ${request.kind.toLowerCase()} dari ${request.requestedBy.name}: ${dto.reason || 'tanpa alasan'}`,
        )
        .catch(() => undefined);
      await this.notificationsService
        .create(
          admin.id,
          NotificationType.CHANGE_REQUEST_SUBMITTED,
          'Permintaan perubahan',
          `${request.requestedBy.name} mengajukan perubahan untuk "${booking.title}" di ${booking.room.name}.`,
        )
        .catch(() => undefined);
    }
    return request;
  }

  async findAll(role: Role, userId: string) {
    if (role === Role.ADMIN_IT || role === Role.ROOM_ADMIN) {
      return this.prisma.bookingChangeRequest.findMany({
        include: {
          booking: { include: { room: true } },
          requestedBy: { select: { name: true, email: true } },
          reviewedBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.bookingChangeRequest.findMany({
      where: { requestedById: userId },
      include: { booking: { include: { room: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, reviewerId: string) {
    const request = await this.prisma.bookingChangeRequest.findUnique({
      where: { id },
      include: { booking: { include: { user: true, room: true } } },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ChangeRequestStatus.PENDING) {
      throw new BadRequestException('Request is already handled');
    }

    if (request.kind === ChangeRequestKind.CANCEL) {
      await this.prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: request.bookingId },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        await tx.bookingChangeRequest.update({
          where: { id },
          data: {
            status: ChangeRequestStatus.APPROVED,
            reviewedById: reviewerId,
            reviewedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            entityType: 'Booking',
            entityId: request.bookingId,
            action: 'change_request_approved',
            fromState: request.booking.status,
            toState: 'CANCELLED',
            actorType: 'USER',
            actorId: reviewerId,
            meta: { requestId: id, kind: request.kind },
          },
        });
      });
    } else {
      const newStart = request.requestedStart!;
      const newEnd = request.requestedEnd!;
      if (newStart >= newEnd) {
        throw new BadRequestException('Jam mulai harus sebelum jam selesai');
      }

      const old = request.booking;
      try {
        await this.prisma.$transaction(async (tx) => {
          // 1. reaping sinkron di slot TUJUAN (sama seperti checkout)
          await tx.$executeRaw`
            UPDATE "Booking"
               SET settling = true, "updatedAt" = now()
             WHERE "roomId" = ${old.roomId}
               AND status = 'HELD'
               AND settling = false
               AND "holdExpiresAt" <= now()
               AND "startTime" < ${newEnd}
               AND "endTime" > ${newStart}
          `;

          // 2. booking lama dilepas (CANCELLED), booking baru dibuat CONFIRMED.
          //    Delete-then-insert, bukan UPDATE, supaya constraint benar-benar
          //    dievaluasi dan startTime baru benar-benar dicek.
          await tx.booking.update({
            where: { id: old.id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          });

          const newId = randomUUID();
          await tx.$executeRaw`
            INSERT INTO "Booking"
              (id, "roomId", "userId", title, notes, "startTime", "endTime", status,
               source, "isRental", "holdExpiresAt", settling, "holdExtended",
               "priceSnapshot", "confirmedAt", "createdAt", "updatedAt")
            VALUES
              (${newId}, ${old.roomId}, ${old.userId}, ${old.title}, ${old.notes},
               ${newStart}, ${newEnd}, 'CONFIRMED',
               ${old.source}::"BookingSource", false, now(), false, false,
               ${old.priceSnapshot}, now(), now(), now())
          `;
          await tx.bookingChangeRequest.update({
            where: { id },
            data: {
              status: ChangeRequestStatus.APPROVED,
              reviewedById: reviewerId,
              reviewedAt: new Date(),
            },
          });
          await tx.auditLog.create({
            data: {
              id: randomUUID(),
              entityType: 'Booking',
              entityId: newId,
              action: 'change_request_approved',
              toState: 'CONFIRMED',
              actorType: 'USER',
              actorId: reviewerId,
              meta: { requestId: id, previousBookingId: old.id, newStart, newEnd },
            },
          });
        });
      } catch (err: any) {
        if (this.isExclusionViolation(err)) {
          // Request TIDAK hilang. Tetap PENDING, booking lama utuh.
          throw new ConflictException(
            'Slot tujuan sudah dipakai. Booking lama tidak berubah; coba lagi nanti.',
          );
        }
        throw err;
      }
    }

    await this.emailService
      .sendChangeRequestStatus(request.booking.user.email, request.booking.title, 'APPROVED')
      .catch(() => undefined);
    await this.notificationsService
      .create(
        request.booking.userId,
        NotificationType.CHANGE_REQUEST_APPROVED,
        'Permintaan disetujui',
        `Permintaan perubahan untuk "${request.booking.title}" disetujui.`,
      )
      .catch(() => undefined);
    return this.prisma.bookingChangeRequest.findUnique({ where: { id } });
  }

  private isExclusionViolation(err: any): boolean {
    const raw = err?.meta?.database_error || err?.message || '';
    return String(raw).includes('booking_no_overlap');
  }

  async reject(id: string, reviewerId: string) {
    const request = await this.prisma.bookingChangeRequest.findUnique({
      where: { id },
      include: { booking: { include: { user: true } } },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ChangeRequestStatus.PENDING) {
      throw new BadRequestException('Request is already handled');
    }
    const result = await this.prisma.bookingChangeRequest.update({
      where: { id },
      data: {
        status: ChangeRequestStatus.REJECTED,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });
    await this.emailService
      .sendChangeRequestStatus(request.booking.user.email, request.booking.title, 'REJECTED')
      .catch(() => undefined);
    await this.notificationsService
      .create(
        request.booking.userId,
        NotificationType.CHANGE_REQUEST_REJECTED,
        'Permintaan ditolak',
        `Permintaan perubahan untuk "${request.booking.title}" ditolak. Hubungi admin untuk penjelasan.`,
      )
      .catch(() => undefined);
    return result;
  }
}