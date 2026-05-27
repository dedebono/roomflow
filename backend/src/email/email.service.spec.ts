import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';

describe('EmailService', () => {
  let service: EmailService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'EMAIL_ENABLED') return 'false';
              if (key === 'EMAIL_FROM') return 'noreply@roomflow.local';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should log when disabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test text',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[EmailService] Email would have been sent (disabled):',
        expect.objectContaining({
          from: 'noreply@roomflow.local',
          to: 'test@example.com',
          subject: 'Test Subject',
          text: 'Test text',
        }),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('sendBookingConfirmation', () => {
    it('should format confirmation email correctly', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const startTime = new Date('2024-01-15T10:00:00Z');
      const endTime = new Date('2024-01-15T11:00:00Z');

      await service.sendBookingConfirmation(
        'user@example.com',
        'Team Meeting',
        'Room A',
        startTime,
        endTime,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[EmailService] Email would have been sent (disabled):',
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'RoomFlow - Booking Confirmation',
          text: expect.stringContaining('Team Meeting'),
        }),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('sendChangeRequestStatus', () => {
    it('should format approved status correctly', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.sendChangeRequestStatus(
        'user@example.com',
        'Team Meeting',
        'APPROVED',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[EmailService] Email would have been sent (disabled):',
        expect.objectContaining({
          subject: 'RoomFlow - Change Request APPROVED',
          text: expect.stringContaining('approved'),
        }),
      );
      consoleSpy.mockRestore();
    });

    it('should format rejected status correctly', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.sendChangeRequestStatus(
        'user@example.com',
        'Team Meeting',
        'REJECTED',
        'Reason provided',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[EmailService] Email would have been sent (disabled):',
        expect.objectContaining({
          subject: 'RoomFlow - Change Request REJECTED',
          text: expect.stringContaining('rejected'),
        }),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('sendBookingCancellation', () => {
    it('should format cancellation email correctly', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.sendBookingCancellation(
        'user@example.com',
        'Team Meeting',
        'Room A',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[EmailService] Email would have been sent (disabled):',
        expect.objectContaining({
          subject: 'RoomFlow - Booking Cancellation',
          text: expect.stringContaining('cancelled'),
        }),
      );
      consoleSpy.mockRestore();
    });
  });
});
