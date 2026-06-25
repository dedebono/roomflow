import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: PrismaService;
  let emailService: EmailService;

  const mockPrisma = {
    booking: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    room: {
      findUnique: jest.fn(),
    },
    bookingHold: {
      findMany: jest.fn(),
    },
  };

  const mockEmailService = {
    sendBookingConfirmation: jest.fn(),
    sendBookingCancellation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prisma = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateBookingConflict', () => {
    it('should return true when conflicts exist', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          status: BookingStatus.BOOKED,
          startTime: new Date('2024-01-15T09:00:00Z'),
          endTime: new Date('2024-01-15T10:00:00Z'),
        },
      ]);

      const hasConflict = await service.validateBookingConflict(
        'room-1',
        new Date('2024-01-15T09:30:00Z'),
        new Date('2024-01-15T10:30:00Z'),
      );

      expect(hasConflict).toBe(true);
    });

    it('should return false when no conflicts', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const hasConflict = await service.validateBookingConflict(
        'room-1',
        new Date('2024-01-15T11:00:00Z'),
        new Date('2024-01-15T12:00:00Z'),
      );

      expect(hasConflict).toBe(false);
    });
  });

  describe('create', () => {
    it('should throw BadRequestException if start >= end', async () => {
      await expect(
        service.create('user-1', {
          roomId: 'room-1',
          title: 'Test',
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T09:00:00Z'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if room not found', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          roomId: 'room-1',
          title: 'Test',
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T11:00:00Z'),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create booking successfully', async () => {
      const mockRoom = { id: 'room-1', status: 'ACTIVE' };
      const mockBooking = {
        id: 'booking-1',
        roomId: 'room-1',
        title: 'Test',
        userId: 'user-1',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        room: mockRoom,
        user: { email: 'user@test.com', name: 'User' },
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.booking.create.mockResolvedValue(mockBooking);

      const result = await service.create('user-1', {
        roomId: 'room-1',
        title: 'Test',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
      });

      expect(result).toBeDefined();
      expect(emailService.sendBookingConfirmation).toHaveBeenCalled();
    });
  });
});
