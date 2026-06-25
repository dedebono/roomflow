import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwt = {
    sign: jest.fn(() => 'mock-jwt-token'),
    verify: jest.fn(),
  };

  const mockWhatsApp = {
    sendText: jest.fn(),
    normalizeNumber: jest.fn((n: string) => n),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password');

    service = new AuthService(
      mockPrisma as any,
      mockJwt as unknown as JwtService,
      mockWhatsApp as any,
    );
    jwtService = mockJwt;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return tokens and user on successful login', async () => {
      const user = {
        id: 'user-1',
        email: 'test@test.com',
        passwordHash: 'hashedpassword',
        name: 'Test User',
        role: 'RENTER',
        whatsappNumber: null,
        whatsappVerified: false,
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.login({ email: 'test@test.com', password: 'password123' });

      expect(result.access_token).toBeDefined();
      expect(result.user.email).toBe('test@test.com');
      expect(mockJwt.sign).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'notfound@test.com', password: 'password123' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      const user = {
        id: 'user-1',
        email: 'test@test.com',
        passwordHash: 'hashedpassword',
        name: 'Test User',
        role: 'RENTER',
        whatsappNumber: null,
        whatsappVerified: false,
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.login({ email: 'test@test.com', password: 'wrongpassword' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create a new user with RENTER role', async () => {
      const newUser = {
        id: 'user-new',
        email: 'new@test.com',
        name: 'New User',
        passwordHash: 'hashed-password',
        role: 'RENTER',
        whatsappNumber: null,
        whatsappVerified: false,
      };
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(newUser);

      const result = await service.register({
        email: 'new@test.com',
        name: 'New User',
        password: 'password123',
      } as any);

      expect(result.user.email).toBe('new@test.com');
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'existing@test.com' });

      await expect(service.register({
        email: 'existing@test.com',
        name: 'Existing User',
        password: 'password123',
      } as any)).rejects.toThrow(ConflictException);
    });
  });
});
