import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingStatus, Role } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async validateBookingConflict(
    roomId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string,
  ) {
    // Conflict logic: (Requested_Start < Existing_End) AND (Requested_End > Existing_Start)
    const conflicts = await this.prisma.booking.findMany({
      where: {
        roomId,
        status: BookingStatus.BOOKED,
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        AND: [
          { startTime: { lt: endTime } },
          { endTime: { gt: startTime } },
        ],
      },
    });

    return conflicts.length > 0;
  }

  async create(userId: string, createBookingDto: CreateBookingDto) {
    const startTime = new Date(createBookingDto.startTime);
    const endTime = new Date(createBookingDto.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    const room = await this.prisma.room.findUnique({ where: { id: createBookingDto.roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status === 'MAINTENANCE') throw new BadRequestException('Room is under maintenance');

    const hasConflict = await this.validateBookingConflict(
      createBookingDto.roomId,
      startTime,
      endTime,
    );

    if (hasConflict) {
      throw new BadRequestException('Room is already booked for this time period');
    }

    return this.prisma.booking.create({
      data: {
        ...createBookingDto,
        userId,
        startTime,
        endTime,
      },
    });
  }

  async findAll(roomId?: string, userId?: string) {
    return this.prisma.booking.findMany({
      where: {
        roomId,
        userId,
        status: BookingStatus.BOOKED,
      },
      include: {
        room: { include: { building: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async cancel(bookingId: string, userId: string, userRole: Role) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');

    if (userRole !== Role.ADMIN_IT && userRole !== Role.ROOM_ADMIN && booking.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });
  }

  async update(bookingId: string, updateDto: { title?: string; notes?: string; roomId?: string; startTime?: string; endTime?: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');

    const roomId = updateDto.roomId || booking.roomId;
    const startTime = updateDto.startTime ? new Date(updateDto.startTime) : booking.startTime;
    const endTime = updateDto.endTime ? new Date(updateDto.endTime) : booking.endTime;

    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    const hasConflict = await this.validateBookingConflict(
      roomId,
      startTime,
      endTime,
      bookingId,
    );

    if (hasConflict) {
      throw new BadRequestException('Room is already booked for this time period');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        title: updateDto.title,
        notes: updateDto.notes,
        roomId,
        startTime,
        endTime,
      },
    });
  }
}
