import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

    return this.prisma.paymentGateway
      .create({ data: createDto })
      .then((row) => this.maskConfig(row));
  }

  /**
   * Jangan pernah mengirim nilai apiKey ke browser.
   *
   * `GET /payment-gateways` dipanggil admin dari halaman pengaturan, jadi
   * "/admin saja" bukan alasan cukup — kredensial produksi tetap residing di
   * respons, di Network tab, dan di screenshot QA. Yang dikembalikan hanya
   * `hasApiKey`, jadi UI tetap tahu key terisi tanpa pernah memuat nilainya.
   * Form edit memakai nilai kosong = "jangan diubah".
   */
  private maskConfig<T extends { config?: unknown }>(row: T): T & { hasApiKey: boolean } {
    const cfg = (row.config ?? {}) as Record<string, unknown>;
    const { apiKey, ...rest } = cfg;
    return { ...row, config: rest, hasApiKey: typeof apiKey === 'string' && apiKey.length > 0 };
  }

  private maskMany(rows: any[]) {
    return rows.map((r) => this.maskConfig(r));
  }

  findAll() {
    return this.prisma.paymentGateway
      .findMany({ orderBy: { createdAt: 'desc' } })
      .then((rows) => this.maskMany(rows));
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

    return this.maskConfig(gateway);
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

    // apiKey tidak lagi dikirim di respons GET (lihat maskConfig), jadi form
    // edit mengirim string kosong. Config yang tersimpan harus TIDAK ditimpa
    // dengan kosong — tanpa ini, satu klik "Save Changes" di halaman admin
    // menghapus kunci produksi secara permanen.
    let config = updateDto.config;
    if (config) {
      const incoming = (config as Record<string, unknown>).apiKey;
      const keep = incoming === undefined || incoming === null || String(incoming).trim() === '';
      if (keep) {
        const oldCfg = (existing.config ?? {}) as Record<string, unknown>;
        config = { ...oldCfg, ...config, apiKey: oldCfg.apiKey };
      }
    }

    return this.prisma.paymentGateway
      .update({
        where: { id },
        data: {
          ...updateDto,
          ...(config !== undefined && { config: config as any }),
        },
      })
      .then((row) => this.maskConfig(row));
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
