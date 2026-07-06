import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BuildingsModule } from './buildings/buildings.module';
import { RoomsModule } from './rooms/rooms.module';
import { BookingsModule } from './bookings/bookings.module';
import { BookingChangeRequestsModule } from './booking-change-requests/booking-change-requests.module';
import { StorageModule } from './storage/storage.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { EmailModule } from './email/email.module';
import { RentalsModule } from './rentals/rentals.module';
import { PakasirModule } from './pakasir/pakasir.module';
import { PaymentsModule } from './payments/payments.module';
import { PaymentGatewaysModule } from './payment-gateways/payment-gateways.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WebSocketModule } from './websocket/websocket.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { WahaConfigModule } from './waha-config/waha-config.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BuildingsModule,
    RoomsModule,
    BookingsModule,
    BookingChangeRequestsModule,
    StorageModule,
    EmailModule,
    RentalsModule,
    PakasirModule,
    PaymentsModule,
    PaymentGatewaysModule,
    ChatModule,
    NotificationsModule,
    WebSocketModule,
    WhatsAppModule,
    WahaConfigModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
