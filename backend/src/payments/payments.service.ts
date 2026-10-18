import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

/**
 * Payment sekarang milik Order, bukan Booking.
 *
 * Yang dihapus dari versi lama:
 *   - upload bukti bayar + approval manual (keputusan: konfirmasi HANYA dari
 *     webhook gateway, tanpa refund)
 *   - initiate / initiate-batch (diganti CheckoutService)
 *   - confirmPaymentCallback yang membaca status dari query string browser —
 *     endpoint publik tempat siapa pun bisa menandai order lunas
 *
 * Payment di sini hanya DIBACA. Perubahan status hanya lewat
 * SettlementService (sweep + rekonsiliasi) dan webhook handler.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private prisma: PrismaService) {}

  async getEnabledGateways() {
    return this.prisma.paymentGateway.findMany({ where: { enabled: true } });
  }

  async myPayments(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      include: {
        order: {
          include: {
            items: { include: { booking: { include: { room: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Dasbor admin: pembayaran yang belum final. */
  async getPending() {
    return this.prisma.payment.findMany({
      where: { status: 'PENDING' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: {
          include: {
            items: { include: { booking: { include: { room: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getOne(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async listForUser(userId: string, role: Role) {
    if (role !== Role.ADMIN_IT && role !== Role.ROOM_ADMIN) {
      throw new ForbiddenException('Not allowed');
    }
    return this.prisma.payment.findMany({
      where: { userId },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Order yang masih menunggu settlement — dipakai rekonsiliasi manual. */
  async listAwaiting() {
    return this.prisma.order.findMany({
      where: { status: 'AWAITING_PAYMENT' },
      include: { payments: true, items: { include: { booking: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
