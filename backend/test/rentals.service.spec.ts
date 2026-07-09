import { Test, TestingModule } from '@nestjs/testing';
import { RentalsService } from '../src/rentals/rentals.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { BookingHoldStatus } from '@prisma/client';
import { ConflictException } from '@nestjs/common';

describe('RentalsService', () => {
  let service: RentalsService;

  const mockPrisma = {
    bookingHold: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    booking: { findFirst: jest.fn() },
    rentalSlot: { findMany: jest.fn() },
    room: { findUnique: jest.fn() },
  };
  const mockNotifications = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Freeze time for predictable expiry tests
    jest.setSystemTime(new Date('2026-06-24T10:00:00Z'));

    // Mock room as rentable
    mockPrisma.room.findUnique.mockResolvedValue({
      id: 'room-1',
      name: 'Test Room',
      isRentable: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentalsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get<RentalsService>(RentalsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createHold — expiresAt must be 1 hour from NOW', () => {
    const userId = 'user-1';
    const roomId = 'room-1';

    beforeEach(() => {
      mockPrisma.bookingHold.findFirst.mockResolvedValue(null);
      mockPrisma.rentalSlot.findMany.mockResolvedValue([
        { id: 'slot-1', startTime: '08:00', endTime: '20:00', price: 50000 },
      ]);
      mockNotifications.create.mockResolvedValue(undefined);
    });

    it('should set expiresAt to ~1 hour from NOW, NOT from rental date', async () => {
      const createdHold = {
        id: 'hold-new',
        userId,
        roomId,
        status: BookingHoldStatus.ACTIVE,
        expiresAt: new Date('2026-06-24T11:00:00Z'),
        startTime: new Date('2026-06-25T09:00:00Z'),
        endTime: new Date('2026-06-25T10:00:00Z'),
        price: 50000,
        room: { id: roomId, name: 'Test Room' },
        user: { id: userId, name: 'Test User', email: 'test@test.com' },
      };
      mockPrisma.bookingHold.create.mockResolvedValue(createdHold);

      // Request a hold for 7 days in the future — this used to BUG out
      const dateStr = '2026-07-01';

      await service.createHold(userId, roomId, dateStr, '09:00', '10:00');

      // Capture the expiresAt passed to create
      const createCall = mockPrisma.bookingHold.create.mock.calls[0];
      const expiresAt = createCall[0].data.expiresAt as Date;

      // expiresAt must be ~1 hour from "now" (2026-06-24T10:00:00Z)
      // not from the rental date (2026-07-01)
      const expectedMin = new Date('2026-06-24T11:00:00Z').getTime();
      const expectedMax = new Date('2026-06-24T11:02:00Z').getTime();

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should throw ConflictException when overlapping active hold exists', async () => {
      mockPrisma.bookingHold.findFirst.mockResolvedValue({
        id: 'existing-hold',
        status: BookingHoldStatus.ACTIVE,
      });

      await expect(
        service.createHold(userId, roomId, '2026-06-25', '09:00', '10:00'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('bookFromHold', () => {
    it('should throw NotFoundException when hold does not exist', async () => {
      mockPrisma.bookingHold.findUnique.mockResolvedValue(null);

      await expect(service.bookFromHold('nonexistent-hold')).rejects.toThrow(
        'Booking hold not found',
      );
    });

    it('should throw ConflictException when hold is not ACTIVE', async () => {
      mockPrisma.bookingHold.findUnique.mockResolvedValue({
        id: 'hold-1',
        status: BookingHoldStatus.EXPIRED,
      });

      await expect(service.bookFromHold('hold-1')).rejects.toThrow(
        'Booking hold is no longer active',
      );
    });
  });
});
