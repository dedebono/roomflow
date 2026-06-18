import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { WebSocketModule } from '../websocket/websocket.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WebSocketModule, WhatsAppModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
