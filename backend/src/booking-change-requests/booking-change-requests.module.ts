import { Module } from '@nestjs/common';
import { BookingChangeRequestsService } from './booking-change-requests.service';
import { BookingChangeRequestsController } from './booking-change-requests.controller';
import { BookingsModule } from '../bookings/bookings.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [BookingsModule, EmailModule, NotificationsModule],
  providers: [BookingChangeRequestsService],
  controllers: [BookingChangeRequestsController],
  exports: [BookingChangeRequestsService],
})
export class BookingChangeRequestsModule {}
