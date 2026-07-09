import { Test, TestingModule } from '@nestjs/testing';
import { BookingChangeRequestsService } from './booking-change-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ChangeRequestStatus, Role } from '@prisma/client';

describe('BookingChangeRequestsService', () => {
  let service: BookingChangeRequestsService;
  let prisma: PrismaService;
  let bookingsService: BookingsService;
  let emailService: EmailService;

  const mockPrisma = {
    booking: {
      findUnique: jest.fn(),
    },
    bookingChangeRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockBookingsService = {
    validateBookingConflict: jest.fn(),
  };

  const mockEmailService = {
    sendChangeRequestStatus: jest.fn(),
  };

  const mockNotificationsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingChangeRequestsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookingsService, useValue: mockBookingsService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<BookingChangeRequestsService>(
      BookingChangeRequestsService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    bookingsService = module.get<BookingsService>(BookingsService);
    emailService = module.get<EmailService>(EmailService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          bookingId: 'booking-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when not owner', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'other-user',
      });

      await expect(
        service.create('user-1', {
          bookingId: 'booking-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create change request and notify admins', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        title: 'Test Booking',
        room: { id: 'room-1', name: 'Room A' },
        user: { id: 'user-1', email: 'user@test.com' },
      });

      const createdRequest = {
        id: 'req-1',
        bookingId: 'booking-1',
        requestedById: 'user-1',
        status: ChangeRequestStatus.PENDING,
        booking: { room: { id: 'room-1', name: 'Room A' } },
        requestedBy: { name: 'Test User', email: 'user@test.com' },
      };

      mockPrisma.bookingChangeRequest.create.mockResolvedValue(createdRequest);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'admin-1', email: 'admin@roomflow.local', role: Role.ADMIN_IT },
        {
          id: 'admin-2',
          email: 'manager@roomflow.local',
          role: Role.ROOM_ADMIN,
        },
      ]);

      const result = await service.create('user-1', {
        bookingId: 'booking-1',
        reason: 'Need to reschedule',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.bookingChangeRequest.create).toHaveBeenCalled();
      expect(emailService.sendChangeRequestStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAll', () => {
    it('should return all requests for admin', async () => {
      mockPrisma.bookingChangeRequest.findMany.mockResolvedValue([
        { id: 'req-1', status: ChangeRequestStatus.PENDING },
      ]);

      const result = await service.findAll(Role.ADMIN_IT, 'user-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.bookingChangeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should return only own requests for user', async () => {
      mockPrisma.bookingChangeRequest.findMany.mockResolvedValue([]);

      const result = await service.findAll(Role.USER, 'user-1');

      expect(mockPrisma.bookingChangeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { requestedById: 'user-1' },
        }),
      );
    });
  });

  describe('approve', () => {
    it('should throw NotFoundException when request not found', async () => {
      mockPrisma.bookingChangeRequest.findUnique.mockResolvedValue(null);

      await expect(service.approve('req-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when already handled', async () => {
      mockPrisma.bookingChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: ChangeRequestStatus.APPROVED,
        booking: { id: 'booking-1' },
      });

      await expect(service.approve('req-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when conflict detected', async () => {
      mockPrisma.bookingChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: ChangeRequestStatus.PENDING,
        booking: {
          id: 'booking-1',
          roomId: 'room-1',
          startTime: new Date(),
          endTime: new Date(),
        },
        requestedRoomId: 'room-2',
        requestedStart: new Date('2024-01-15T10:00:00Z'),
        requestedEnd: new Date('2024-01-15T11:00:00Z'),
        bookingId: 'booking-1',
      });
      mockBookingsService.validateBookingConflict.mockResolvedValue(true);

      await expect(service.approve('req-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
