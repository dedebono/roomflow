import { Controller, Get, Put, Body } from '@nestjs/common';
import { WahaConfigService } from './waha-config.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { Roles } from '../common/decorators/roles.decorator';
import { redact, REDACTED } from '../common/utils/redact';
import { Role } from '@prisma/client';

@Controller('waha-config')
export class WahaConfigController {
  constructor(
    private readonly wahaConfigService: WahaConfigService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  @Get()
  @Roles(Role.ADMIN_IT)
  async get() {
    // wahaApiKey adalah kredensial produksi WAHA. Mengembalikannya polos
    // berarti satu request admin cukup untuk mencuri kunci itu.
    return redact(await this.wahaConfigService.get());
  }

  @Put()
  @Roles(Role.ADMIN_IT)
  async update(
    @Body()
    body: {
      enabled?: boolean;
      wahaUrl?: string;
      wahaSession?: string;
      wahaApiKey?: string;
    },
  ) {
    // Nilai tersamar "••••••••" berarti "tidak diubah" — Kalau diteruskan
    // apa adanya, satu klik Save menimpa kunci asli dengan bullet.
    const incoming = body.wahaApiKey;
    const unchanged =
      incoming === undefined ||
      incoming === '' ||
      incoming === REDACTED;
    const payload = unchanged ? { ...body, wahaApiKey: undefined } : body;

    const result = await this.wahaConfigService.update(payload);
    this.whatsAppService.clearCache();
    return redact(result);
  }
}
