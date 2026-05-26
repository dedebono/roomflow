import { Module } from '@nestjs/common';
import { BookingChangeRequestsService } from './booking-change-requests.service';
import { BookingChangeRequestsController } from './booking-change-requests.controller';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [BookingsModule],
  providers: [BookingChangeRequestsService],
  controllers: [BookingChangeRequestsController],
})
export class BookingChangeRequestsModule {}
