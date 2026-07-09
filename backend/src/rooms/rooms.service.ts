import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { StorageService } from '../storage/storage.service';
import { ImageService } from '../storage/image.service';
import { RoomStatus } from '@prisma/client';
import { getPrismaPagination } from '../common/dto/pagination.dto';

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private imageService: ImageService,
  ) {}

  async create(createRoomDto: CreateRoomDto, imageFile?: Express.Multer.File) {
    let imageUrl: string | undefined;
    if (imageFile) {
      imageUrl = await this.imageService.compressAndSave(imageFile);
    }

    return this.prisma.room.create({
      data: {
        ...createRoomDto,
        imageUrl,
      },
    });
  }

  async findAll(
    buildingId?: string,
    status?: RoomStatus,
    page?: number,
    limit?: number,
  ) {
    const { skip, take } = getPrismaPagination(page, limit);
    return this.prisma.room.findMany({
      where: {
        buildingId,
        status,
      },
      skip,
      take,
      select: {
        id: true,
        buildingId: true,
        name: true,
        capacity: true,
        description: true,
        imageUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        amenities: true,
        isRentable: true,
        maxBookingHours: true,
        category: true,
        building: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { building: true, bookings: { where: { status: 'BOOKED' } } },
    });
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }
    return room;
  }

  async update(
    id: string,
    updateRoomDto: UpdateRoomDto,
    imageFile?: Express.Multer.File,
  ) {
    const room = await this.findOne(id);

    let imageUrl = room.imageUrl;
    if (imageFile) {
      if (room.imageUrl) {
        await this.imageService.delete(room.imageUrl);
      }
      imageUrl = await this.imageService.compressAndSave(imageFile);
    }

    return this.prisma.room.update({
      where: { id },
      data: {
        ...updateRoomDto,
        imageUrl,
      },
    });
  }

  async remove(id: string) {
    const room = await this.findOne(id);
    if (room.imageUrl) {
      await this.imageService.delete(room.imageUrl);
    }
    return this.prisma.room.delete({
      where: { id },
    });
  }

  // New rental-related methods
  async getRentableRooms() {
    return this.prisma.room.findMany({
      where: {
        isRentable: true,
        status: RoomStatus.ACTIVE,
      },
      include: {
        building: true,
        rentalSlots: {
          where: {
            isActive: true,
          },
        },
      },
    });
  }

  async updateAmenities(roomId: string, amenities: string[]) {
    const room = await this.findOne(roomId);
    return this.prisma.room.update({
      where: { id: roomId },
      data: {
        amenities: JSON.stringify(amenities),
      },
    });
  }

  async setRentable(roomId: string, isRentable: boolean) {
    const room = await this.findOne(roomId);
    return this.prisma.room.update({
      where: { id: roomId },
      data: { isRentable },
    });
  }

  async updateMaxBookingHours(roomId: string, maxBookingHours: number | null) {
    const room = await this.findOne(roomId);
    return this.prisma.room.update({
      where: { id: roomId },
      data: { maxBookingHours },
    });
  }

  async getRoomWithSlots(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        building: true,
        rentalSlots: {
          where: {
            isActive: true,
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found`);
    }

    return room;
  }
}
