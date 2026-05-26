import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@Injectable()
export class BuildingsService {
  constructor(private prisma: PrismaService) {}

  async create(createBuildingDto: CreateBuildingDto) {
    return this.prisma.building.create({
      data: createBuildingDto,
    });
  }

  async findAll() {
    return this.prisma.building.findMany({
      include: { _count: { select: { rooms: true } } },
    });
  }

  async findOne(id: string) {
    const building = await this.prisma.building.findUnique({
      where: { id },
      include: { rooms: true },
    });
    if (!building) {
      throw new NotFoundException(`Building with ID ${id} not found`);
    }
    return building;
  }

  async update(id: string, updateBuildingDto: UpdateBuildingDto) {
    return this.prisma.building.update({
      where: { id },
      data: updateBuildingDto,
    });
  }

  async remove(id: string) {
    return this.prisma.building.delete({
      where: { id },
    });
  }
}
