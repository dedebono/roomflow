import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { WebSocketService } from '../websocket/websocket.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private webSocketService: WebSocketService,
    private whatsAppService: WhatsAppService,
  ) {}

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
    this.webSocketService.sendNotification(userId, notification).catch(err => console.error('WebSocket notification failed:', err));

    // Send WhatsApp notification via WAHA when user has WhatsApp number
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { whatsappNumber: true },
    });

    if (user?.whatsappNumber) {
      this.whatsAppService.sendText(user.whatsappNumber, `*${title}*\n\n${message}`).catch(err => console.error('WhatsApp failed:', err));
    }

    return notification;
  }

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { success: true };
  }
}
