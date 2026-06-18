import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private whatsAppService: WhatsAppService) {}

  async getManagers() {
    return this.prisma.user.findMany({
      where: {
        role: {
          in: [Role.ROOM_ADMIN, Role.ADMIN_IT],
        },
      },
      select: { id: true, name: true, email: true, whatsappNumber: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        whatsappNumber: dto.whatsappNumber ? this.whatsAppService.normalizeNumber(dto.whatsappNumber) : null,
        passwordHash,
        role: dto.role,
      },
      select: { id: true, name: true, email: true, whatsappNumber: true, role: true, createdAt: true },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, whatsappNumber: true, role: true, createdAt: true },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, whatsappNumber: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const data: any = { ...dto };
    delete data.password;
    if (data.whatsappNumber === '') data.whatsappNumber = null;
    else if (data.whatsappNumber) data.whatsappNumber = this.whatsAppService.normalizeNumber(data.whatsappNumber);

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, whatsappNumber: true, role: true, createdAt: true },
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
