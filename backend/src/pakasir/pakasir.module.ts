import { Module } from '@nestjs/common';
import { PakasirService } from './pakasir.service';
import { PakasirController } from './pakasir.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PakasirController],
  providers: [PakasirService],
  exports: [PakasirService],
})
export class PakasirModule {}
