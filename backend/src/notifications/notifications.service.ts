import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { WebSocketService } from '../websocket/websocket.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private webSocketService: WebSocketService,
    private whatsAppService: WhatsAppService,
    private emailService: EmailService,
  ) {}

  async remove(id: string, userId: string) {
    // Always scope by userId so a missing/garbage id can never wipe other rows
    const result = await this.prisma.notification.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Notification not found');
    }
    return { success: true };
  }

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data,
      },
    });

    // Send real-time notification via WebSocket (non-blocking)
    this.webSocketService
      .sendNotification(userId, notification)
      .catch((err) => console.error('WebSocket notification failed:', err));

    // Send WhatsApp notification via WAHA when user has WhatsApp number
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { whatsappNumber: true, email: true },
    });

    if (user?.whatsappNumber) {
      this.whatsAppService
        .sendText(user.whatsappNumber, `*${title}*\n\n${message}`)
        .catch((err) => console.error('WhatsApp failed:', err));
    }

    // Send email notification using the SAME message body as WhatsApp
    if (user?.email) {
      this.emailService
        .sendNotification(user.email, title, message)
        .catch((err) => console.error('Email failed:', err));
    }

    return notification;
  }

  async getUserNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    // ponytail: frontend expects `read` not `isRead` — add alias
    return notifications.map((n) => ({ ...n, read: n.isRead }));
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Mark one notification as read, then clear it.
   * Ownership is enforced: the id must belong to the requesting user.
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    await this.prisma.notification.delete({ where: { id: notification.id } });
    return { success: true };
  }

  /**
   * Mark everything as read, then clear it all for this user.
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notification.deleteMany({
      where: {
        userId,
      },
    });

    return { success: true };
  }
}
