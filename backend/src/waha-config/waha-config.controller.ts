import { Controller, Get, Put, Body } from '@nestjs/common';
import { WahaConfigService } from './waha-config.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('waha-config')
export class WahaConfigController {
  constructor(
    private readonly wahaConfigService: WahaConfigService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  @Get()
  @Roles(Role.ADMIN_IT)
  get() {
    return this.wahaConfigService.get();
  }

  @Put()
  @Roles(Role.ADMIN_IT)
  update(
    @Body()
    body: {
      enabled?: boolean;
      wahaUrl?: string;
      wahaSession?: string;
      wahaApiKey?: string;
    },
  ) {
    const result = this.wahaConfigService.update(body);
    this.whatsAppService.clearCache();
    return result;
  }
}
