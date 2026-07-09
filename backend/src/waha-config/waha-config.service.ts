import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { WahaConfig } from '@prisma/client';

@Injectable()
export class WahaConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<WahaConfig> {
    let config = await this.prisma.wahaConfig.findFirst();
    if (!config) {
      config = await this.prisma.wahaConfig.create({
        data: { enabled: true, wahaSession: 'default' },
      });
    }
    return config;
  }

  async update(data: {
    enabled?: boolean;
    wahaUrl?: string;
    wahaSession?: string;
    wahaApiKey?: string;
  }) {
    let config = await this.prisma.wahaConfig.findFirst();
    if (!config) {
      config = await this.prisma.wahaConfig.create({
        data: {
          enabled: data.enabled ?? true,
          wahaUrl: data.wahaUrl ?? null,
          wahaSession: data.wahaSession ?? 'default',
          wahaApiKey: data.wahaApiKey ?? null,
        },
      });
      return config;
    }
    return this.prisma.wahaConfig.update({
      where: { id: config.id },
      data: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.wahaUrl !== undefined && { wahaUrl: data.wahaUrl }),
        ...(data.wahaSession !== undefined && {
          wahaSession: data.wahaSession,
        }),
        ...(data.wahaApiKey !== undefined && { wahaApiKey: data.wahaApiKey }),
      },
    });
  }
}
