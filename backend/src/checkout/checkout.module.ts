import { Module, forwardRef } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { SettlementService } from './settlement.service';
import { SeriesService } from './series.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PakasirModule } from '../pakasir/pakasir.module';

@Module({
  // PrismaModule itu @Global, jadi SeriesService bisa inject PrismaService
  // tanpa import tambahan.
  imports: [NotificationsModule, forwardRef(() => PakasirModule)],
  providers: [CheckoutService, SettlementService, SeriesService],
  controllers: [CheckoutController],
  exports: [CheckoutService, SettlementService, SeriesService],
})
export class CheckoutModule {}