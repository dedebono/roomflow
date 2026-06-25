import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../src/payments/payments.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PaymentGatewaysService } from '../src/payment-gateways/payment-gateways.service';
import { PakasirService } from '../src/pakasir/pakasir.service';
import {
  BookingHoldStatus,
  PaymentStatus,
  BookingStatus,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockPrisma = {
    bookingHold: { findUnique: jest.fn(), findFirst: jest.fn() },
    booking: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    paymentGateway: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const mockStorage = { upload: jest.fn() };
  const mockNotifications = { create: jest.fn() };
  const mockGateways = { findOne: jest.fn() };
  const mockPakasir = { createTransaction: jest.fn(), getPaymentUrl: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: PaymentGatewaysService, useValue: mockGateways },
        { provide: PakasirService, useValue: mockPakasir },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiatePayment', () => {
    const userId = 'user-1';
    const holdId = 'hold-1';
    const gatewayId = 'gw-1';

    const activeHold = {
      id: holdId,
      userId,
      roomId: 'room-1',
      status: BookingHoldStatus.ACTIVE,
      price: 50000,
      expiresAt: new Date(Date.now() + 3600000),
      startTime: new Date(),
      endTime: new Date(),
      room: { id: 'room-1', name: 'Test Room', isRentable: true },
    };

    const booking = {
      id: 'booking-1',
      roomId: 'room-1',
      userId,
      status: BookingStatus.PENDING,
      bookingHoldId: holdId,
    };

    it('should create payment for active hold', async () => {
      mockPrisma.bookingHold.findUnique.mockResolvedValue(activeHold);
      mockPrisma.booking.findFirst.mockResolvedValue(booking);
      mockPrisma.paymentGateway.findUnique.mockResolvedValue({
        id: gatewayId,
        name: 'Pakasir',
        isActive: true,
        config: { apiKey: 'key', projectSlug: 'slug' },
      });
      mockGateways.findOne.mockResolvedValue({
        id: gatewayId,
        name: 'Pakasir',
        isActive: true,
      });
      mockPakasir.createTransaction.mockResolvedValue({
        orderId: 'RF-booking-12345',
        amount: 50000,
        paymentUrl: 'https://pakasir.test/pay',
      });
      mockPakasir.getPaymentUrl.mockReturnValue('https://pakasir.test/pay');
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-1',
        amount: 50000,
        status: PaymentStatus.PENDING,
        bookingHoldId: holdId,
      });

      const result = await service.initiatePayment(userId, holdId, gatewayId, 50000);
      expect(result.payment.id).toBeDefined();
      expect(mockPakasir.createTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when hold not found', async () => {
      mockPrisma.bookingHold.findUnique.mockResolvedValue(null);

      await expect(service.initiatePayment(userId, holdId, gatewayId, 50000))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when hold belongs to different user', async () => {
      mockPrisma.bookingHold.findUnique.mockResolvedValue({ ...activeHold, userId: 'other-user' });

      await expect(service.initiatePayment(userId, holdId, gatewayId, 50000))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when hold is inactive', async () => {
      mockPrisma.bookingHold.findUnique.mockResolvedValue({
        ...activeHold,
        status: BookingHoldStatus.EXPIRED,
      });

      await expect(service.initiatePayment(userId, holdId, gatewayId, 50000))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when hold is expired', async () => {
      mockPrisma.bookingHold.findUnique.mockResolvedValue({
        ...activeHold,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.initiatePayment(userId, holdId, gatewayId, 50000))
        .rejects.toThrow(BadRequestException);
    });
  });
});