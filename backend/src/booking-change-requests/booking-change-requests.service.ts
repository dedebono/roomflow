import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { ChangeRequestStatus, Role } from '@prisma/client';

@Injectable()
export class BookingChangeRequestsService {
  constructor(
    private prisma: PrismaService,
    private bookingsService: BookingsService,
  ) {}

  async create(userId: string, dto: CreateChangeRequestDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException('Not your booking');

    return this.prisma.bookingChangeRequest.create({
      data: {
        bookingId: dto.bookingId,
        requestedById: userId,
        requestedRoomId: dto.requestedRoomId,
        requestedStart: dto.requestedStart ? new Date(dto.requestedStart) : null,
        requestedEnd: dto.requestedEnd ? new Date(dto.requestedEnd) : null,
        reason: dto.reason,
      },
    });
  }

  async findAll(role: Role, userId: string) {
    if (role === Role.ADMIN_IT || role === Role.ROOM_ADMIN) {
      return this.prisma.bookingChangeRequest.findMany({
        include: {
          booking: { include: { room: true } },
          requestedBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.bookingChangeRequest.findMany({
      where: { requestedById: userId },
      include: {
        booking: { include: { room: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string) {
    const request = await this.prisma.bookingChangeRequest.findUnique({
      where: { id },
      include: { booking: true },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ChangeRequestStatus.PENDING) {
      throw new BadRequestException('Request is already handled');
    }

    const newRoomId = request.requestedRoomId || request.booking.roomId;
    const newStart = request.requestedStart || request.booking.startTime;
    const newEnd = request.requestedEnd || request.booking.endTime;

    const hasConflict = await this.bookingsService.validateBookingConflict(
      newRoomId,
      newStart,
      newEnd,
      request.bookingId,
    );

    if (hasConflict) {
      throw new BadRequestException('Requested changes conflict with existing bookings');
    }

    // Use transaction
    return this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: request.bookingId },
        data: {
          roomId: newRoomId,
          startTime: newStart,
          endTime: newEnd,
        },
      });

      return tx.bookingChangeRequest.update({
        where: { id },
        data: { status: ChangeRequestStatus.APPROVED },
      });
    });
  }

  async reject(id: string) {
    return this.prisma.bookingChangeRequest.update({
      where: { id },
      data: { status: ChangeRequestStatus.REJECTED },
    });
  }
}
