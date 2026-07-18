import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { EmailConfig } from '@prisma/client';

export interface EmailConfigUpdate {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  fromAddress?: string;
}

@Injectable()
export class EmailConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<EmailConfig> {
    let config = await this.prisma.emailConfig.findFirst();
    if (!config) {
      config = await this.prisma.emailConfig.create({
        data: { enabled: false, port: 587, secure: false },
      });
    }
    return config;
  }

  async update(data: EmailConfigUpdate) {
    let config = await this.prisma.emailConfig.findFirst();
    if (!config) {
      config = await this.prisma.emailConfig.create({
        data: {
          enabled: data.enabled ?? false,
          host: data.host ?? null,
          port: data.port ?? 587,
          secure: data.secure ?? false,
          user: data.user ?? null,
          pass: data.pass ?? null,
          fromAddress: data.fromAddress ?? 'noreply@roomflow.local',
        },
      });
      return config;
    }
    return this.prisma.emailConfig.update({
      where: { id: config.id },
      data: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.host !== undefined && { host: data.host }),
        ...(data.port !== undefined && { port: data.port }),
        ...(data.secure !== undefined && { secure: data.secure }),
        ...(data.user !== undefined && { user: data.user }),
        ...(data.pass !== undefined && { pass: data.pass }),
        ...(data.fromAddress !== undefined && {
          fromAddress: data.fromAddress,
        }),
      },
    });
  }
}
