import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentGatewaysModule } from '../payment-gateways/payment-gateways.module';
import { PakasirModule } from '../pakasir/pakasir.module';

@Module({
  imports: [NotificationsModule, PaymentGatewaysModule, PakasirModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
