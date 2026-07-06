import { Module } from '@nestjs/common';
import { WahaConfigService } from './waha-config.service';
import { WahaConfigController } from './waha-config.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsAppModule],
  controllers: [WahaConfigController],
  providers: [WahaConfigService],
  exports: [WahaConfigService],
})
export class WahaConfigModule {}