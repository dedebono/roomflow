import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockWhatsApp = { sendMessage: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'WhatsAppService', useValue: mockWhatsApp },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user with hashed password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

      const userData = {
        name: 'Test User',
        email: 'test@roomflow.local',
        password: 'password123',
        role: 'USER',
      };

      const createdUser = {
        id: 'user-1',
        name: userData.name,
        email: userData.email,
        role: userData.role,
        createdAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await service.create(userData);

      expect(result).toEqual(createdUser);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: userData.name,
            email: userData.email,
            passwordHash: 'hashed_password',
          }),
          select: expect.any(Object),
        }),
      );
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@roomflow.local',
      });

      await expect(
        service.create({
          name: 'Test User',
          email: 'test@roomflow.local',
          password: 'password123',
          role: 'USER',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [
        { id: 'user-1', name: 'User One', email: 'user1@test.com' },
        { id: 'user-2', name: 'User Two', email: 'user2@test.com' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toEqual(users);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.any(Object),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should find a user by id', async () => {
      const user = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@roomflow.local',
        role: 'USER',
        createdAt: new Date(),
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne('user-1');

      expect(result).toEqual(user);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
