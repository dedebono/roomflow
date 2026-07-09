import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebSocketService } from '../websocket/websocket.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private webSocketService: WebSocketService,
    private notificationsService: NotificationsService,
  ) {}

  async sendMessage(
    senderId: string,
    receiverId: string,
    content: string,
    roomId?: string,
    bookingId?: string,
  ) {
    // Verify receiver exists
    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    console.log('Creating message in DB...');
    // Create the message
    const message = await this.prisma.chatMessage.create({
      data: {
        senderId,
        receiverId,
        content,
        roomId,
        bookingId,
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true },
        },
        room: {
          select: { id: true, name: true },
        },
      },
    });
    console.log('Message created in DB:', message.id);

    // Send WebSocket notification to receiver (non-blocking)
    this.webSocketService
      .sendNewMessage({
        id: message.id,
        senderId: message.senderId,
        senderName: message.sender.name,
        content: message.content,
        roomId: message.roomId ?? undefined,
        bookingId: message.bookingId ?? undefined,
        isRead: message.isRead,
        createdAt: message.createdAt,
      })
      .catch((err) => console.error('WebSocket send failed:', err));

    // Create notification for receiver (non-blocking)
    this.notificationsService
      .create(
        receiverId,
        'NEW_MESSAGE',
        'New Message',
        `You have a new message from ${message.sender.name}.`,
        JSON.stringify({
          messageId: message.id,
          senderId: message.senderId,
          senderName: message.sender.name,
          content: message.content,
        }),
      )
      .catch((err) => console.error('Notification create failed:', err));

    return message;
  }

  async getConversations(userId: string) {
    // Get all distinct conversation partners
    const allMessages = await this.prisma.chatMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true } },
      },
    });

    // Group by partner, keep latest message per partner
    const latestByPartner = new Map<string, typeof allMessages[number]>();
    for (const msg of allMessages) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!latestByPartner.has(partnerId)) {
        latestByPartner.set(partnerId, msg);
      }
    }

    const result = [];
    for (const [partnerId, message] of latestByPartner) {
      const partner = await this.prisma.user.findUnique({
        where: { id: partnerId },
        select: { id: true, name: true, email: true, role: true },
      });
      if (!partner) continue;

      const unreadCount = await this.prisma.chatMessage.count({
        where: { senderId: partnerId, receiverId: userId, isRead: false },
      });

      const currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
      });

      result.push({
        id: `conv_${partnerId}`,
        userId: partnerId,
        participant1Id: userId,
        participant2Id: partnerId,
        participant1: currentUser ? { id: currentUser.id, name: currentUser.name, email: currentUser.email, role: currentUser.role } : null,
        participant2: { id: partner.id, name: partner.name, email: partner.email, role: partner.role },
        lastMessage: { content: message.content, createdAt: message.createdAt },
        lastMessageAt: message.createdAt,
        unreadCount,
      });
    }

    return result;
  }

  async createOrGetConversation(userId: string, participantId: string) {
    // Find the participant
    const participant = await this.prisma.user.findUnique({
      where: { id: participantId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Check if any messages exist between these two users
    const existingMessage = await this.prisma.chatMessage.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: participantId },
          { senderId: participantId, receiverId: userId },
        ],
      },
    });

    // Count unread from this participant
    const unreadCount = await this.prisma.chatMessage.count({
      where: {
        senderId: participantId,
        receiverId: userId,
        isRead: false,
      },
    });

    return {
      id: `conv_${participantId}`,
      userId: participantId,
      participant1Id: userId,
      participant2Id: participantId,
      participant1: null,
      participant2: {
        id: participant.id,
        name: participant.name,
        email: participant.email,
        role: participant.role,
      },
      lastMessage: existingMessage?.content || null,
      lastMessageAt: existingMessage?.createdAt || null,
      unreadCount,
    };
  }

  async getConversation(userId1: string, userId2: string) {
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        OR: [
          {
            senderId: userId1,
            receiverId: userId2,
          },
          {
            senderId: userId2,
            receiverId: userId1,
          },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mark all messages from userId2 to userId1 as read
    await this.prisma.chatMessage.updateMany({
      where: {
        senderId: userId2,
        receiverId: userId1,
        isRead: false,
      },
      data: { isRead: true },
    });

    return messages;
  }

  async markAsRead(userId: string, senderId: string) {
    const result = await this.prisma.chatMessage.updateMany({
      where: {
        senderId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { marked: result.count };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.chatMessage.count({
      where: { receiverId: userId, isRead: false },
    });
    return { unreadCount: count };
  }
}
