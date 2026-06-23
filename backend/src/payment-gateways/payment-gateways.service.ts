import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentGatewayDto } from './dto/create-payment-gateway.dto';
import { UpdatePaymentGatewayDto } from './dto/update-payment-gateway.dto';

@Injectable()
export class PaymentGatewaysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreatePaymentGatewayDto) {
    // Check if a gateway with the same name already exists
    const existing = await this.prisma.paymentGateway.findUnique({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new BadRequestException(
        `Payment gateway with name '${createDto.name}' already exists.`,
      );
    }

    return this.prisma.paymentGateway.create({
      data: createDto,
    });
  }

  findAll() {
    return this.prisma.paymentGateway.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllEnabled() {
    return this.prisma.paymentGateway.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        logo: true,
        // Do NOT return config (secrets) to public/frontend
        config: false,
        enabled: true,
      },
    });
  }

  async findOne(id: string) {
    const gateway = await this.prisma.paymentGateway.findUnique({
      where: { id },
    });

    if (!gateway) {
      throw new NotFoundException(`Payment gateway with ID '${id}' not found.`);
    }

    return gateway;
  }

  async update(id: string, updateDto: UpdatePaymentGatewayDto) {
    const existing = await this.prisma.paymentGateway.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Payment gateway with ID '${id}' not found.`);
    }

    // If name is being updated, check for uniqueness
    if (updateDto.name && updateDto.name !== existing.name) {
      const nameConflict = await this.prisma.paymentGateway.findUnique({
        where: { name: updateDto.name },
      });
      if (nameConflict) {
        throw new BadRequestException(
          `Payment gateway with name '${updateDto.name}' already exists.`,
        );
      }
    }

    return this.prisma.paymentGateway.update({
      where: { id },
      data: updateDto,
    });
  }

  async toggleEnabled(id: string, enabled: boolean) {
    const gateway = await this.prisma.paymentGateway.findUnique({
      where: { id },
    });

    if (!gateway) {
      throw new NotFoundException(`Payment gateway with ID '${id}' not found.`);
    }

    return this.prisma.paymentGateway.update({
      where: { id },
      data: { enabled },
    });
  }

  async remove(id: string) {
    const gateway = await this.prisma.paymentGateway.findUnique({
      where: { id },
    });

    if (!gateway) {
      throw new NotFoundException(`Payment gateway with ID '${id}' not found.`);
    }

    return this.prisma.paymentGateway.delete({ where: { id } });
  }
}
