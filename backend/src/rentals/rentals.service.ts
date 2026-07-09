import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { CreateHoldDto } from './dto/create-hold.dto';
import { CreateRentalSlotDto } from './dto/create-rental-slot.dto';
import { UpdateRentalSlotDto } from './dto/update-rental-slot.dto';
import {
  BookingHoldStatus,
  BookingStatus,
  PaymentStatus,
  RoomStatus,
  RoomCategory,
} from '@prisma/client';
import { getPrismaPagination } from '../common/dto/pagination.dto';

@Injectable()
export class RentalsService implements OnModuleInit {
  private readonly logger = new Logger(RentalsService.name);
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
      this.logger.log(
        `Auto-cancelled ${expiredHolds.length} expired BookingHolds`,
      );
    }
  }

  /**
   * Get all rentable rooms (NEW: returns ALL rooms, no date filtering).
   *
   * The calendar-based booking flow fetches rooms here, then checks
   * availability per-date on the room detail page via getRoomAvailability().
   *
   * Date params (date, startDate, endDate) are ignored for backward compatibility.
   */
  async getAvailableRooms(
    date?: string,
    startDate?: string,
    endDate?: string,
    category?: RoomCategory,
  ) {
    // NEW BEHAVIOR: Ignore all date params. Return ALL rentable rooms.
    // Date filtering moved to getRoomAvailability() endpoint on room detail page.

    // Get all rentable rooms matching category
    const rentableRooms = await this.prisma.room.findMany({
      where: {
        isRentable: true,
        status: 'ACTIVE',
        category: category || undefined,
      },
      include: {
        building: true,
        rentalSlots: {
          where: { isActive: true },
        },
      },
    });

    // Return all rooms with price info
    const availableRooms: any[] = rentableRooms.map((room) => ({
      ...room,
      category: room.category,
      // Show price range from available slots
      price:
        room.rentalSlots.length > 0
          ? Math.min(...room.rentalSlots.map((s) => s.price))
          : 0,
    }));

    return availableRooms;
  }

  async checkAvailability(
    roomId: string,
    date: string,
    startTime: string,
    endTime: string,
  ) {
    // Parse date string as LOCAL midnight so the selected date stays correct in UTC+7
    const startDate = new Date(date + 'T00:00:00');
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
      return {
        available: false,
        reason: 'Room is booked for this time period',
      };
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
    // Parse date string as LOCAL midnight so the selected date stays correct in UTC+7
    const startDate = new Date(date + 'T00:00:00');
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
      throw new ConflictException(
        'You already have an active hold for this time period',
      );
    }

    const slotDayOfWeek = ((startTimeDate.getDay() + 6) % 7) + 1;
    // Get rental slots for the day
    const allDaySlots = await this.prisma.rentalSlot.findMany({
      where: {
        roomId,
        dayOfWeek: slotDayOfWeek,
        isActive: true,
      },
    });

    // Find the slot that contains the requested time range
    const slot = allDaySlots.find(
      (s) => s.startTime <= startTime && s.endTime >= endTime,
    );
    const price = slot?.price || 0;

    // Create hold that expires in 1 hour from now
    const expiresAt = new Date();
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

    // Price is already set on the hold at creation time
    const price = hold.price;

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
  async getAllHolds(page?: number, limit?: number) {
    const { skip, take } = getPrismaPagination(page, limit);
    return this.prisma.bookingHold.findMany({
      skip,
      take,
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
      where: {
        userId,
        status: { in: [BookingHoldStatus.ACTIVE, BookingHoldStatus.CONVERTED] },
      },
      include: {
        room: { include: { building: true } },
        payments: {
          select: { id: true, status: true, amount: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get a specific hold by ID (for renter payment flow)
  async getHoldById(id: string, userId: string) {
    const hold = await this.prisma.bookingHold.findFirst({
      where: { id, userId },
      include: {
        room: { include: { building: true } },
        payments: {
          select: { id: true, status: true, amount: true, createdAt: true },
        },
      },
    });
    if (!hold) throw new NotFoundException('Booking hold not found');
    return hold;
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

  async cancelHold(id: string, userId: string) {
    const hold = await this.prisma.bookingHold.findFirst({
      where: { id, userId },
      include: { room: true },
    });

    if (!hold) {
      throw new NotFoundException('Booking hold not found');
    }

    if (
      hold.status !== BookingHoldStatus.ACTIVE &&
      hold.status !== BookingHoldStatus.EXPIRED &&
      hold.status !== BookingHoldStatus.CANCELLED
    ) {
      throw new ConflictException('Hold cannot be cancelled');
    }

    // Update to CANCELLED only if not already cancelled
    if (hold.status !== BookingHoldStatus.CANCELLED) {
      const cancelled = await this.prisma.bookingHold.update({
        where: { id },
        data: { status: BookingHoldStatus.CANCELLED },
      });

      await this.notificationsService.create(
        userId,
        'BOOKING_CANCELLED',
        'Booking Hold Cancelled',
        `Your hold for ${hold.room.name} has been cancelled.`,
        JSON.stringify({ holdId: id, roomId: hold.roomId }),
      );

      return cancelled;
    }

    return hold; // already cancelled
  }

  // Get available time slots for a room on a given date
  async getAvailableSlots(roomId: string, date: string) {
    // Parse date string as a UTC midnight date to avoid timezone shifting the day.
    // We use UTC days consistently: ((getUTCDay() + 6) % 7) + 1 gives Mon=1, Sun=7
    // This is stored in DB and must match for all slot queries.
    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = ((dateObj.getUTCDay() + 6) % 7) + 1; // 1-7 (Mon=1)
    this.logger.log(
      `[getAvailableSlots] roomId=${roomId}, date=${date}, utcDay=${dateObj.getUTCDay()}, dayOfWeek=${dayOfWeek}`,
    );

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
      const currentHour = new Date(slotStartTime);
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
    this.logger.log(
      `[getAvailableSlots] returning ${result.length} hourly slots`,
    );
    return result;
  }

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

  // NEW: Get room details for room detail page
  async getRoomDetails(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        building: true,
        rentalSlots: {
          where: { isActive: true },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found`);
    }

    return room;
  }

  // NEW: Get room availability calendar (per-day, per-month)
  async getRoomAvailability(roomId: string, month: string) {
    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new ConflictException('Month must be in YYYY-MM format');
    }

    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        rentalSlots: {
          where: { isActive: true },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found`);
    }

    // Parse month
    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, monthNum - 1, 0)).getUTCDate();

    // Build availability map for each day in month
    const availability: Record<
      string,
      { available: boolean; hasSlots: boolean }
    > = {};

    // DEBUG: log DB dayOfWeek values for MLB Hall
    if (room.name.includes('MLB')) {
      const dbDays = [
        ...new Set(room.rentalSlots.map((s) => s.dayOfWeek)),
      ].sort((a, b) => a - b);
      console.log(
        '[DEBUG] MLB Hall DB dayOfWeek:',
        dbDays,
        '-> names:',
        dbDays.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]),
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${month}-${String(day).padStart(2, '0')}`;
      // Parse as UTC to match getUTCDay() — avoid timezone shift on local time parsing
      const dateObj = new Date(Date.UTC(year, monthNum - 1, day));

      // Get day-of-week (Mon=1, Sun=7)
      const dayOfWeek = ((dateObj.getUTCDay() + 6) % 7) + 1;

      // Get slots for this day-of-week
      const daySlots = room.rentalSlots.filter(
        (s) => s.dayOfWeek === dayOfWeek,
      );

      if (daySlots.length === 0) {
        availability[dateStr] = { available: false, hasSlots: false };
        continue;
      }

      // Check if at least one slot has no conflicts
      let hasAvailableSlot = false;
      for (const slot of daySlots) {
        const availCheck = await this.checkAvailability(
          roomId,
          dateStr,
          slot.startTime,
          slot.endTime,
        );
        if (availCheck.available) {
          hasAvailableSlot = true;
          break;
        }
      }

      availability[dateStr] = { available: hasAvailableSlot, hasSlots: true };
    }

    return {
      roomId,
      month,
      availability,
    };
  }

  async getRenterStats(userId: string) {
    const [totalBookings, activeBookings, pendingPayments, availableRooms] = await Promise.all([
      // Total completed rentals (approved/confirmation paid)
      this.prisma.booking.count({
        where: { userId, status: BookingStatus.BOOKED },
      }),
      // Active bookings (approved but not yet past endTime)
      this.prisma.booking.count({
        where: {
          userId,
          status: BookingStatus.BOOKED,
          endTime: { gte: new Date() },
        },
      }),
      // Pending holds (ACTIVE)
      this.prisma.bookingHold.count({
        where: { userId, status: BookingHoldStatus.ACTIVE },
      }),
      // Available rooms count
      this.prisma.room.count({
        where: { status: RoomStatus.ACTIVE },
      }),
    ]);

    // Recent activity: latest 5 notifications
    const recentActivity = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return { totalBookings, activeBookings, pendingPayments, availableRooms, recentActivity };
  }
}
