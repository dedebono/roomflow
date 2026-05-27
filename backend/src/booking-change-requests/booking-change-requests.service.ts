import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { ChangeRequestStatus, Role, NotificationType } from '@prisma/client';

@Injectable()
export class BookingChangeRequestsService {
  constructor(
    private prisma: PrismaService,
    private bookingsService: BookingsService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateChangeRequestDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { room: true, user: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException('Not your booking');

    const request = await this.prisma.bookingChangeRequest.create({
      data: {
        bookingId: dto.bookingId,
        requestedById: userId,
        requestedRoomId: dto.requestedRoomId,
        requestedStart: dto.requestedStart ? new Date(dto.requestedStart) : null,
        requestedEnd: dto.requestedEnd ? new Date(dto.requestedEnd) : null,
        reason: dto.reason,
      },
      include: {
        booking: { include: { room: true } },
        requestedBy: { select: { name: true, email: true } },
      },
    });

    // Notify all ROOM_ADMIN and ADMIN_IT users
    const admins = await this.prisma.user.findMany({
      where: { role: { in: [Role.ROOM_ADMIN, Role.ADMIN_IT] } },
    });
    for (const admin of admins) {
      await this.emailService.sendChangeRequestStatus(
        admin.email,
        booking.title,
        'PENDING',
        `Change request by ${request.requestedBy.name}: ${dto.reason || 'No reason provided'}`,
      );
      await this.notificationsService.create(
        admin.id,
        NotificationType.CHANGE_REQUEST_SUBMITTED,
        'New Change Request',
        `${request.requestedBy.name} submitted a change request for "${booking.title}"`,
      );
    }

    return request;
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
      include: {
        booking: { include: { user: true, room: true } },
      },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ChangeRequestStatus.PENDING) {
      throw new BadRequestException('Request is already handled');
    }

    const newRoomId = request.requestedRoomId || request.booking.roomId;
    const newStart = request.requestedStart || request.booking.startTime;
    const newEnd = request.requestedEnd || request.booking.endTime;

    const hasChanges = request.requestedRoomId || request.requestedStart || request.requestedEnd;
    const isCancellation = !hasChanges;

    if (!isCancellation) {
      const hasConflict = await this.bookingsService.validateBookingConflict(
        newRoomId,
        newStart,
        newEnd,
        request.bookingId,
      );

      if (hasConflict) {
        throw new BadRequestException('Requested changes conflict with existing bookings');
      }
    }

    // Use transaction
    const result = await this.prisma.$transaction(async (tx) => {
      if (isCancellation) {
        // Cancellation request — cancel the booking
        await tx.booking.update({
          where: { id: request.bookingId },
          data: { status: 'CANCELLED' },
        });
      } else {
        // Reschedule request — update booking details
        await tx.booking.update({
          where: { id: request.bookingId },
          data: {
            roomId: newRoomId,
            startTime: newStart,
            endTime: newEnd,
          },
        });
      }

      return tx.bookingChangeRequest.update({
        where: { id },
        data: { status: ChangeRequestStatus.APPROVED },
      });
    });

    // Notify the requester
    await this.emailService.sendChangeRequestStatus(
      request.booking.user.email,
      request.booking.title,
      'APPROVED',
    );
    await this.notificationsService.create(
      request.booking.userId,
      NotificationType.CHANGE_REQUEST_APPROVED,
      'Change Request Approved',
      `Your ${isCancellation ? 'cancellation' : 'reschedule'} request for "${request.booking.title}" was approved.`,
    );

    return result;
  }

  async reject(id: string) {
    const request = await this.prisma.bookingChangeRequest.findUnique({
      where: { id },
      include: {
        booking: { include: { user: true } },
      },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== ChangeRequestStatus.PENDING) {
      throw new BadRequestException('Request is already handled');
    }

    const result = await this.prisma.bookingChangeRequest.update({
      where: { id },
      data: { status: ChangeRequestStatus.REJECTED },
    });

    // Notify the requester
    await this.emailService.sendChangeRequestStatus(
      request.booking.user.email,
      request.booking.title,
      'REJECTED',
    );
    await this.notificationsService.create(
      request.booking.userId,
      NotificationType.CHANGE_REQUEST_REJECTED,
      'Change Request Rejected',
      `Your change request for "${request.booking.title}" was rejected. Please contact your manager for more information.`,
    );

    return result;
  }
}
