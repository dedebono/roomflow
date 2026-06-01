import { Injectable, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { CreateHoldDto } from './dto/create-hold.dto';
import { CreateRentalSlotDto } from './dto/create-rental-slot.dto';
import { UpdateRentalSlotDto } from './dto/update-rental-slot.dto';
import { BookingHoldStatus, BookingStatus, PaymentStatus, RoomCategory } from '@prisma/client';

@Injectable()
export class RentalsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // Auto-cancel expired BookingHolds every 30 seconds
  onModuleInit() {
    setInterval(async () => {
      try {
        await this.cancelExpiredHolds();
      } catch (err) {
        console.error('[RentalsService] Auto-cancel error:', err);
      }
    }, 30_000);
  }

  private async cancelExpiredHolds() {
    const expiredHolds = await this.prisma.bookingHold.findMany({
      where: {
        status: BookingHoldStatus.ACTIVE,
        expiresAt: { lt: new Date() },
      },
      include: { room: true },
    });

    for (const hold of expiredHolds) {
      await this.prisma.bookingHold.update({
        where: { id: hold.id },
        data: { status: BookingHoldStatus.EXPIRED },
      });

      await this.notificationsService.create(
        hold.userId,
        'BOOKING_EXPIRED',
        'Booking Hold Expired',
        `Your hold for ${hold.room.name} has expired. Please create a new booking if still needed.`,
        JSON.stringify({ holdId: hold.id, roomId: hold.roomId }),
      );
    }

    if (expiredHolds.length > 0) {
      console.log(`[RentalsService] Auto-cancelled ${expiredHolds.length} expired BookingHolds`);
    }
  }

  async getAvailableRooms(date?: string, category?: RoomCategory) {
    // Default to today if no date provided
    const dateStr = date || new Date().toISOString().split('T')[0];
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // local getDay() — matches how rentalSlots.dayOfWeek was stored

    // Get all rooms that are rentable and match category (if provided)
    const rentableRooms = await this.prisma.room.findMany({
      where: {
        isRentable: true,
        status: 'ACTIVE',
        category: category || undefined,
      },
      include: {
        building: true,
        rentalSlots: {
          where: {
            isActive: true,
            dayOfWeek: dateObj.getDay(),
          },
        },
      },
    });


    const availableRooms: any[] = [];
    for (const room of rentableRooms) {
      // Check availability for each rental slot in the room for the given date
      for (const slot of room.rentalSlots) {
        const startTime = slot.startTime;
        const endTime = slot.endTime;

        // Use the checkAvailability logic to see if the slot is free
        const availability = await this.checkAvailability(
          room.id,
          dateStr,
          startTime,
          endTime,
        );

        if (availability.available) {
          // If at least one slot is available, add the room and break to avoid duplicates
          const roomWithPrice = {
            ...room,
            category: room.category,
            // Derive price from available rental slots (use minimum slot price)
            price: room.rentalSlots.length > 0
              ? Math.min(...room.rentalSlots.map(s => s.price))
              : 0,
          };
          availableRooms.push(roomWithPrice);
          break; // Move to the next room once one available slot is found
        }
      }
    }

    return availableRooms;
  }

  async checkAvailability(
    roomId: string,
    date: string,
    startTime: string,
    endTime: string,
  ) {
    const startDate = new Date(date);
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startTimeDate = new Date(startDate);
    startTimeDate.setHours(startHour, startMin, 0, 0);

    const endTimeDate = new Date(startDate);
    endTimeDate.setHours(endHour, endMin, 0, 0);

    if (startTimeDate >= endTimeDate) {
      throw new ConflictException('Start time must be before end time');
    }

    // Check if room exists and is rentable
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room || !room.isRentable) {
      throw new NotFoundException('Room not found or not rentable');
    }

    // Check for regular booking conflicts
    const bookingConflict = await this.prisma.booking.findFirst({
      where: {
        roomId,
        status: BookingStatus.BOOKED,
        startTime: { lt: endTimeDate },
        endTime: { gt: startTimeDate },
      },
    });

    if (bookingConflict) {
      return { available: false, reason: 'Room is booked for this time period' };
    }

    // Check for active booking holds
    const holdConflict = await this.prisma.bookingHold.findFirst({
      where: {
        roomId,
        status: BookingHoldStatus.ACTIVE,
        startTime: { lt: endTimeDate },
        endTime: { gt: startTimeDate },
      },
    });

    if (holdConflict) {
      return { available: false, reason: 'Room is held for this time period' };
    }

    return { available: true };
  }

  async createHold(
    userId: string,
    roomId: string,
    date: string,
    startTime: string,
    endTime: string,
  ) {
    const startDate = new Date(date);
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startTimeDate = new Date(startDate);
    startTimeDate.setHours(startHour, startMin, 0, 0);

    const endTimeDate = new Date(startDate);
    endTimeDate.setHours(endHour, endMin, 0, 0);

    if (startTimeDate >= endTimeDate) {
      throw new ConflictException('Start time must be before end time');
    }

    // Check availability
    const availability = await this.checkAvailability(
      roomId,
      date,
      startTime,
      endTime,
    );

    if (!availability.available) {
      throw new ConflictException(availability.reason);
    }

    // Check if user already has an active hold for this room/date/time
    const existingHold = await this.prisma.bookingHold.findFirst({
      where: {
        userId,
        roomId,
        status: BookingHoldStatus.ACTIVE,
        startTime: { lte: endTimeDate },
        endTime: { gte: startTimeDate },
      },
    });

    if (existingHold) {
      throw new ConflictException('You already have an active hold for this time period');
    }

    // Get rental slot to determine price
    const slot = await this.prisma.rentalSlot.findFirst({
      where: {
        roomId,
        dayOfWeek: startTimeDate.getDay(),
        isActive: true,
        startTime: startTime,
        endTime: endTime,
      },
    });

    const price = slot?.price || 0;

    // Create hold that expires in 1 hour
    const expiresAt = new Date(startTimeDate);
    expiresAt.setHours(expiresAt.getHours() + 1);

    const hold = await this.prisma.bookingHold.create({
      data: {
        userId,
        roomId,
        holdDate: startTimeDate,
        startTime: startTimeDate,
        endTime: endTimeDate,
        expiresAt,
        price,
        status: BookingHoldStatus.ACTIVE,
      },
      include: {
        room: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Create notification
    await this.notificationsService.create(
      userId,
      'BOOKING_CREATED',
      'Booking Hold Created',
      `Hold created for ${hold.room.name} on ${date} from ${startTime} to ${endTime}. Please upload payment within 1 hour.`,
      JSON.stringify({
        holdId: hold.id,
        roomId: hold.roomId,
        roomName: hold.room.name,
        date,
        startTime,
        endTime,
      }),
    );

    return hold;
  }

  async bookFromHold(holdId: string) {
    const hold = await this.prisma.bookingHold.findUnique({
      where: { id: holdId },
      include: { room: true },
    });

    if (!hold) {
      throw new NotFoundException('Booking hold not found');
    }

    if (hold.status !== BookingHoldStatus.ACTIVE) {
      throw new ConflictException('Booking hold is no longer active');
    }

    // Check if hold has expired
    if (new Date() > hold.expiresAt) {
      await this.prisma.bookingHold.update({
        where: { id: holdId },
        data: { status: BookingHoldStatus.EXPIRED },
      });
      throw new ConflictException('Booking hold has expired');
    }

    // Calculate price from rental slots if available
    const slots = await this.prisma.rentalSlot.findMany({
      where: {
        roomId: hold.roomId,
        dayOfWeek: hold.holdDate.getDay(),
        isActive: true,
      },
    });

    let price = 0;
    if (slots.length > 0) {
      // Use average price from slots
      price = slots.reduce((sum, slot) => sum + slot.price, 0) / slots.length;
    }

    // Create booking
    const booking = await this.prisma.booking.create({
      data: {
        roomId: hold.roomId,
        userId: hold.userId,
        title: `Rental: ${hold.room.name}`,
        notes: `Created from booking hold ${holdId}`,
        startTime: hold.startTime,
        endTime: hold.endTime,
        isRental: true,
      },
      include: {
        room: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Update hold status
    await this.prisma.bookingHold.update({
      where: { id: holdId },
      data: { status: BookingHoldStatus.CONVERTED },
    });

    // Create notification for user
    await this.notificationsService.create(
      hold.userId,
      'RENTAL_BOOKED',
      'Rental Confirmed',
      `Your rental for ${hold.room.name} has been confirmed.`,
      JSON.stringify({
        bookingId: booking.id,
        roomId: booking.roomId,
        roomName: booking.room.name,
      }),
    );

    return booking;
  }

  async getMyBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: {
        userId,
        isRental: true,
      },
      include: {
        room: {
          include: { building: true },
        },
        payment: {
          select: {
            fileUrl: true,
            id: true,
            status: true,
            amount: true,
            createdAt: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  // Get all booking holds for manager dashboard
  async getAllHolds() {
    return this.prisma.bookingHold.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        room: {
          include: { building: true },
        },
        payments: {
          select: {
            fileUrl: true,
            id: true,
            status: true,
            amount: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveHolds(userId: string) {
    return this.prisma.bookingHold.findMany({
      where: {
        userId,
        status: BookingHoldStatus.ACTIVE,
      },
      include: {
        room: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // RentalSlot CRUD
  // Get all holds for a renter (for renter bookings page)
  async getMyHolds(userId: string) {
    return this.prisma.bookingHold.findMany({
      where: { userId },
      include: {
        room: { include: { building: true } },
        payments: {
          select: { id: true, status: true, amount: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get active hold for a specific room (for renter room detail page)
  async getActiveHoldForRoom(userId: string, roomId: string) {
    const hold = await this.prisma.bookingHold.findFirst({
      where: {
        userId,
        roomId,
        status: BookingHoldStatus.ACTIVE,
      },
      include: {
        room: {
          include: { building: true },
        },
      },
    });
    return hold;
  }

  // Get available time slots for a room on a given date
  async getAvailableSlots(roomId: string, date: string) {
    // Parse date as local time — rentalSlots.dayOfWeek was stored with local getDay()
    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // local getDay() — matches how rentalSlots.dayOfWeek was stored
    console.log(`[getAvailableSlots] roomId=${roomId}, date=${date}, dayOfWeek=${dayOfWeek}`);

    // Get all active rental slots for this room on this day
    const slots = await this.prisma.rentalSlot.findMany({
      where: {
        roomId,
        dayOfWeek,
        isActive: true,
      },
      orderBy: { startTime: 'asc' },
    });

    // Calculate day boundaries
    const dayStart = new Date(dateObj);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateObj);
    dayEnd.setHours(23, 59, 59, 999);

    // Check for conflicts with booked slots
    const bookings = await this.prisma.booking.findMany({
      where: {
        roomId,
        status: BookingStatus.BOOKED,
        startTime: { lte: dayEnd },
        endTime: { gte: dayStart },
      },
    });

    const holds = await this.prisma.bookingHold.findMany({
      where: {
        roomId,
        status: BookingHoldStatus.ACTIVE,
        startTime: { lte: dayEnd },
        endTime: { gte: dayStart },
      },
    });

    // Build availability map from booked/held ranges
    const isSlotBooked = (slotStart: string, slotEnd: string) => {
      const slotStartDate = new Date(slotStart);
      const slotEndDate = new Date(slotEnd);
      return bookings.some((b) => {
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return slotStartDate < bEnd && slotEndDate > bStart;
      });
    };

    const isSlotHeld = (slotStart: string, slotEnd: string) => {
      const slotStartDate = new Date(slotStart);
      const slotEndDate = new Date(slotEnd);
      return holds.some((h) => {
        const hStart = new Date(h.startTime);
        const hEnd = new Date(h.endTime);
        return slotStartDate < hEnd && slotEndDate > hStart;
      });
    };

    // For each rental slot, expand into hourly sub-slots and check availability
    const result: any[] = [];
    for (const slot of slots) {
      const slotStartTime = new Date(dateObj);
      const [slotStartH, slotStartM] = slot.startTime.split(':').map(Number);
      slotStartTime.setHours(slotStartH, slotStartM, 0, 0);

      const slotEndTime = new Date(dateObj);
      const [slotEndH, slotEndM] = slot.endTime.split(':').map(Number);
      slotEndTime.setHours(slotEndH, slotEndM, 0, 0);

      // Expand into hourly sub-slots
      let currentHour = new Date(slotStartTime);
      while (currentHour < slotEndTime) {
        const subStart = new Date(currentHour);
        const subEnd = new Date(currentHour);
        subEnd.setHours(subEnd.getHours() + 1);

        // Don't exceed the slot's end time
        if (subEnd > slotEndTime) break;

        const subStartISO = subStart.toISOString();
        const subEndISO = subEnd.toISOString();

        const booked = isSlotBooked(subStartISO, subEndISO);
        const held = isSlotHeld(subStartISO, subEndISO);

        result.push({
          id: `${slot.id}_${currentHour.getHours()}`,
          startTime: subStartISO,
          endTime: subEndISO,
          price: slot.price,
          available: !booked && !held,
        });

        currentHour.setHours(currentHour.getHours() + 1);
      }
    }
    console.log(`[getAvailableSlots] returning ${result.length} hourly slots`);
    return result;
  }

  async getSlots(roomId?: string) {
    return this.prisma.rentalSlot.findMany({
      where: { roomId },
      include: { room: { include: { building: true } } },
      orderBy: [{ roomId: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createSlot(dto: CreateRentalSlotDto) {
    return this.prisma.rentalSlot.create({
      data: dto,
      include: { room: { include: { building: true } } },
    });
  }

  async updateSlot(id: string, dto: UpdateRentalSlotDto) {
    const slot = await this.prisma.rentalSlot.findUnique({ where: { id } });
    if (!slot) {
      throw new NotFoundException(`RentalSlot with ID ${id} not found`);
    }
    return this.prisma.rentalSlot.update({
      where: { id },
      data: dto,
      include: { room: { include: { building: true } } },
    });
  }

  async deleteSlot(id: string) {
    const slot = await this.prisma.rentalSlot.findUnique({ where: { id } });
    if (!slot) {
      throw new NotFoundException(`RentalSlot with ID ${id} not found`);
    }
    return this.prisma.rentalSlot.delete({ where: { id } });
  }
}