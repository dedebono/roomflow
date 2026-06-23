import { Controller, Post, Body, Logger, HttpCode } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentStatus, BookingStatus } from '@prisma/client';

@Controller('pakasir')
export class PakasirController {
  private readonly logger = new Logger(PakasirController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() body: any) {
    this.logger.log('Pakasir webhook received:', JSON.stringify(body));

    // Pakasir sends webhook with order_id and status
    const { order_id, status, amount, payment_method } = body;

    if (!order_id) {
      this.logger.warn('Webhook missing order_id');
      return { status: 'ignored' };
    }

    // Find payment by externalId (order_id)
    const payment = await this.prisma.payment.findFirst({
      where: { externalId: order_id },
      include: {
        booking: { include: { room: true } },
        user: true,
      },
    });

    if (!payment) {
      this.logger.warn(`No payment found for order_id: ${order_id}`);
      return { status: 'not_found' };
    }

    // Map Pakasir status to our PaymentStatus
    let newStatus: PaymentStatus;
    let bookingNewStatus: BookingStatus | undefined;

    switch (String(status).toLowerCase()) {
      case 'success':
      case 'paid':
        newStatus = PaymentStatus.APPROVED;
        bookingNewStatus = BookingStatus.BOOKED;
        break;
      case 'failed':
      case 'expired':
        newStatus = PaymentStatus.REJECTED;
        bookingNewStatus = BookingStatus.CANCELLED;
        break;
      case 'pending':
      default:
        return { status: 'pending' };
    }

    // Update payment
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        paymentMethod: payment_method || payment.paymentMethod,
      },
    });

    // Update booking status
    if (bookingNewStatus) {
      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: bookingNewStatus },
      });
    }

    // Notify renter
    if (newStatus === PaymentStatus.APPROVED) {
      await this.notificationsService.create(
        payment.userId,
        'PAYMENT_APPROVED',
        'Payment Approved',
        `Your payment of $${amount || payment.amount} for ${payment.booking.room.name} has been confirmed.`,
        JSON.stringify({ paymentId: payment.id, bookingId: payment.bookingId }),
      );
    } else if (newStatus === PaymentStatus.REJECTED) {
      await this.notificationsService.create(
        payment.userId,
        'PAYMENT_REJECTED',
        'Payment Failed',
        `Payment for ${payment.booking.room.name} was not successful.`,
        JSON.stringify({ paymentId: payment.id, bookingId: payment.bookingId }),
      );
    }

    return { status: 'processed' };
  }
}
