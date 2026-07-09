import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PaymentStatus,
  BookingHoldStatus,
  Role,
  BookingStatus,
} from '@prisma/client';
import { PakasirService } from '../pakasir/pakasir.service';
import { PaymentGatewaysService } from '../payment-gateways/payment-gateways.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private notificationsService: NotificationsService,
    private paymentGatewaysService: PaymentGatewaysService,
    private pakasirService: PakasirService,
  ) {}

  async getEnabledGateways() {
    return this.paymentGatewaysService.findAllEnabled();
  }

  async upload(
    userId: string,
    bookingHoldId: string,
    file: Express.Multer.File,
    amount: number,
    description?: string,
  ) {
    // Verify the booking hold exists and belongs to user
    const hold = await this.prisma.bookingHold.findUnique({
      where: { id: bookingHoldId },
      include: { room: true },
    });

    if (!hold) {
      throw new NotFoundException('Booking hold not found');
    }

    if (hold.userId !== userId) {
      throw new ForbiddenException('This booking hold does not belong to you');
    }

    if (hold.status !== BookingHoldStatus.ACTIVE) {
      throw new BadRequestException('Booking hold is not active');
    }

    // Check if hold has expired
    if (new Date() > hold.expiresAt) {
      await this.prisma.bookingHold.update({
        where: { id: bookingHoldId },
        data: { status: BookingHoldStatus.EXPIRED },
      });
      throw new BadRequestException('Booking hold has expired');
    }

    // Upload the file
    const fileUrl = await this.storageService.upload(file);

    // Create payment record - we need a booking first, or link to hold
    // Actually, looking at the schema, Payment has bookingId which is a required unique relation
    // We need to create the booking first, then the payment
    // But the hold hasn't been confirmed yet...
    // Looking at the schema: Payment references Booking, so we need a booking.
    // The flow should be: hold -> payment upload -> manager approves -> hold converted -> booking created
    // But Payment.bookingId is required. Let's create a temporary booking first.

    // Actually, re-reading the schema: Payment has bookingId @unique
    // This means payment is one-to-one with booking.
    // The booking should be created from the hold when payment is approved.
    // But the Payment model needs a bookingId...

    // Let me re-check the schema... Yes, Payment.bookingId is required and unique.
    // This means we need a booking to create a payment.
    // But the task says: "upload(paymentId, bookingHoldId, file, amount): Create payment record linked to booking hold"
    // Let me create the booking first (with isRental=true) from the hold, then create payment.

    // Actually, the flow makes more sense as:
    // 1. Create hold
    // 2. Upload payment (we create a booking first? No...)

    // Let me re-read the task: "upload(userId, bookingHoldId, file, amount): Create payment record linked to booking hold"
    // "approve(paymentId, managerId): Set status=APPROVED, update booking hold status=CONVERTED, create booking from hold"

    // So the payment is linked to the hold, but the schema links payment to booking via bookingId.
    // Since we need a booking to create a payment, let me create a temporary booking here
    // that will be confirmed later. Or better yet, create the booking right away with PENDING status.

    // Wait - looking more carefully at the schema, there's no direct hold-payment link.
    // Payment connects to Booking via bookingId.
    // So I need to create the booking first, then the payment.
    // Let me create the booking here (isRental=true) and link the payment to it.

    // Check if payment already exists for this hold
    const existingPayment = await this.prisma.payment.findFirst({
      where: { bookingHoldId },
    });

    let payment;
    if (existingPayment) {
      // Update existing payment with new file
      payment = await this.prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          fileUrl,
          amount,
          notes: description,
          status: PaymentStatus.PAYMENT_PROOF_UPLOADED,
        },
        include: {
          booking: {
            include: {
              room: true,
            },
          },
          bookingHold: true,
        },
      });
    } else {
      // Create the booking from the hold
      const booking = await this.prisma.booking.create({
        data: {
          roomId: hold.roomId,
          userId: hold.userId,
          title: `Rental: ${hold.room.name}`,
          notes: description || `Rental booking from hold ${bookingHoldId}`,
          startTime: hold.startTime,
          endTime: hold.endTime,
          isRental: true,
          status: BookingStatus.PENDING, // Default to pending until paid/approved
        },
      });

      // Create payment record
      payment = await this.prisma.payment.create({
        data: {
          bookingId: booking.id,
          bookingHoldId,
          userId,
          fileUrl,
          amount,
          notes: description,
          status: PaymentStatus.PAYMENT_PROOF_UPLOADED,
        },
        include: {
          booking: {
            include: {
              room: true,
            },
          },
          bookingHold: true,
        },
      });
    }

    // Create notification for renter
    await this.notificationsService.create(
      userId,
      'PAYMENT_PROOF_UPLOADED',
      'Payment Proof Uploaded',
      `Your payment proof of $${amount} for ${payment.booking.room.name} has been submitted for review.`,
      JSON.stringify({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        amount,
      }),
    );

    // Also notify all ROOM_ADMIN users
    const managers = await this.prisma.user.findMany({
      where: { role: Role.ROOM_ADMIN },
      select: { id: true },
    });

    for (const manager of managers) {
      await this.notificationsService.create(
        manager.id,
        'PAYMENT_PROOF_UPLOADED',
        'New Payment Proof Submitted',
        `${payment.booking.room.name}: $${amount} payment proof uploaded. Review it now.`,
        JSON.stringify({
          paymentId: payment.id,
          bookingId: payment.bookingId,
          amount,
        }),
      );
    }

    return payment;
  }

  async getPending() {
    return this.prisma.payment.findMany({
      where: {
        status: {
          in: [PaymentStatus.PENDING, PaymentStatus.PAYMENT_PROOF_UPLOADED],
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        booking: {
          include: {
            room: {
              include: { building: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(paymentId: string, managerId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: { room: true },
        },
        bookingHold: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (
      payment.status !== PaymentStatus.PENDING &&
      payment.status !== PaymentStatus.PAYMENT_PROOF_UPLOADED
    ) {
      throw new BadRequestException(
        'Payment is not in PENDING or PROOF_UPLOADED status',
      );
    }

    // Update payment status
    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.APPROVED,
        managerId,
      },
    });

    // Update rental booking status to BOOKED so it shows in calendar
    if (payment.booking.isRental) {
      await this.prisma.booking.update({
        where: { id: payment.booking.id },
        data: { status: BookingStatus.BOOKED },
      });
    }

    // Convert the associated booking hold if present
    if (
      payment.bookingHold &&
      payment.bookingHold.status === BookingHoldStatus.ACTIVE
    ) {
      await this.prisma.bookingHold.update({
        where: { id: payment.bookingHold.id },
        data: { status: BookingHoldStatus.CONVERTED },
      });
    }

    // Create notification for user
    await this.notificationsService.create(
      payment.userId,
      'PAYMENT_APPROVED',
      'Payment Approved',
      `Your payment of $${payment.amount} for ${payment.booking.room.name} has been approved. Your rental is confirmed!`,
      JSON.stringify({
        paymentId: payment.id,
        bookingId: payment.booking.id,
        amount: payment.amount,
      }),
    );

    return updatedPayment;
  }

  async reject(paymentId: string, managerId: string, notes?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: { room: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (
      payment.status !== PaymentStatus.PENDING &&
      payment.status !== PaymentStatus.PAYMENT_PROOF_UPLOADED
    ) {
      throw new BadRequestException(
        'Payment is not in PENDING or PROOF_UPLOADED status',
      );
    }

    // Update payment status
    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REJECTED,
        managerId,
        notes,
      },
    });

    // Cancel the booking
    await this.prisma.booking.update({
      where: { id: payment.booking.id },
      data: { status: 'CANCELLED' as any },
    });

    // Find and cancel the associated hold
    const hold = await this.prisma.bookingHold.findFirst({
      where: {
        userId: payment.userId,
        roomId: payment.booking.roomId,
        startTime: payment.booking.startTime,
        endTime: payment.booking.endTime,
        status: BookingHoldStatus.ACTIVE,
      },
    });

    if (hold) {
      await this.prisma.bookingHold.update({
        where: { id: hold.id },
        data: { status: BookingHoldStatus.CANCELLED },
      });
    }

    // Create notification for user
    await this.notificationsService.create(
      payment.userId,
      'PAYMENT_REJECTED',
      'Payment Rejected',
      `Your payment of $${payment.amount} for ${payment.booking.room.name} has been rejected.${notes ? ` Reason: ${notes}` : ''}`,
      JSON.stringify({
        paymentId: payment.id,
        bookingId: payment.booking.id,
        notes,
      }),
    );

    return updatedPayment;
  }

  async getMyPayments(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      include: {
        booking: {
          include: {
            room: {
              include: { building: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => ({
      ...p,
      bookingStartTime: p.booking?.startTime
        ? String(p.booking.startTime.getHours()).padStart(2, '0') +
          ':' +
          String(p.booking.startTime.getMinutes()).padStart(2, '0')
        : null,
      bookingEndTime: p.booking?.endTime
        ? String(p.booking.endTime.getHours()).padStart(2, '0') +
          ':' +
          String(p.booking.endTime.getMinutes()).padStart(2, '0')
        : null,
    }));
  }

  async initiatePayment(
    userId: string,
    bookingHoldId: string,
    gatewayId: string,
    amount: number,
    paymentMethod?: string,
  ) {
    // Resolve booking from hold
    const hold = await this.prisma.bookingHold.findUnique({
      where: { id: bookingHoldId },
      include: { room: true },
    });

    if (!hold) {
      throw new NotFoundException('Booking hold not found');
    }
    if (hold.userId !== userId) {
      throw new ForbiddenException('This booking hold does not belong to you');
    }
    if (hold.status !== BookingHoldStatus.ACTIVE) {
      throw new BadRequestException('Booking hold is not active');
    }
    if (new Date() > hold.expiresAt) {
      throw new BadRequestException('Booking hold has expired');
    }

    // Create or find booking
    let booking = await this.prisma.booking.findFirst({
      where: { bookingHoldId },
    });

    if (!booking) {
      booking = await this.prisma.booking.create({
        data: {
          roomId: hold.roomId,
          userId: hold.userId,
          title: `Rental: ${hold.room.name}`,
          startTime: hold.startTime,
          endTime: hold.endTime,
          isRental: true,
          status: BookingStatus.PENDING,
          bookingHoldId,
        },
      });
    }

    const orderId = `RF-${booking.id.slice(0, 8)}-${Date.now()}`;
    const finalAmount = amount || hold.price; // Already stored as IDR in DB
    const finalMethod = paymentMethod || 'qris';
    const result = await this.pakasirService.createTransaction(gatewayId, {
      orderId,
      amount: finalAmount,
      paymentMethod: finalMethod,
    });

    // Build payment URL if available
    let paymentUrl: string | undefined;
    const gateway = await this.prisma.paymentGateway.findUnique({
      where: { id: gatewayId },
    });
    if (gateway) {
      const config = (gateway.config || {}) as Record<string, string>;
      const frontendBase =
        process.env.FRONTEND_BASE_URL || 'https://room.ytcb.org';
      paymentUrl = this.pakasirService.getPaymentUrl(config, {
        amount: finalAmount,
        orderId,
        redirect: `${frontendBase}/renter/payments`,
      });
    }

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        bookingHoldId,
        userId,
        amount: finalAmount,
        status: PaymentStatus.PENDING,
        paymentMethod: result.payment?.payment_method || finalMethod,
        externalId: orderId,
        paymentGatewayId: gatewayId,
      },
    });

    return { payment, paymentUrl };
  }

  /**
   * Confirm a payment from redirect callback (Pakasir sends order_id + status via URL params).
   * This is a fallback when webhook is not configured.
   */
  async confirmPaymentCallback(orderId: string, status: string) {
    if (!orderId) {
      return { status: 'ignored', message: 'Missing order_id' };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { externalId: orderId },
      include: { booking: { include: { room: true } }, user: true },
    });

    if (!payment) {
      return {
        status: 'not_found',
        message: 'Payment not found for this order',
      };
    }

    let newStatus: PaymentStatus;
    let bookingNewStatus: BookingStatus | undefined;

    switch (String(status).toLowerCase()) {
      case 'success':
      case 'paid':
      case 'completed':
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
        return { status: 'pending', message: 'Payment still pending' };
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus, paymentMethod: payment.paymentMethod },
    });

    if (bookingNewStatus) {
      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: bookingNewStatus },
      });
    }

    if (payment.bookingHoldId) {
      await this.prisma.bookingHold.update({
        where: { id: payment.bookingHoldId },
        data: { status: BookingHoldStatus.CONVERTED },
      });
    }

    if (newStatus === PaymentStatus.APPROVED) {
      await this.notificationsService.create(
        payment.userId,
        'PAYMENT_APPROVED',
        'Payment Approved',
        `Your payment of Rp ${(payment.amount || 0).toLocaleString('id-ID')} for ${payment.booking.room.name} has been confirmed.`,
        JSON.stringify({ paymentId: payment.id, bookingId: payment.bookingId }),
      );
    }

    return {
      status: 'processed',
      paymentId: payment.id,
      bookingStatus: bookingNewStatus,
    };
  }
}
