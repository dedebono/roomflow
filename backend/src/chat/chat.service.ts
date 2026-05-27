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

    // Send WebSocket notification to receiver
    await this.webSocketService.sendNewMessage({
      id: message.id,
      senderId: message.senderId,
      senderName: message.sender.name,
      content: message.content,
      roomId: message.roomId ?? undefined,
      bookingId: message.bookingId ?? undefined,
      isRead: message.isRead,
      createdAt: message.createdAt,
    });

    // Create notification for receiver
    await this.notificationsService.create(
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
    );

    return message;
  }

  async getConversations(userId: string) {
    // Get all messages for this user
    const allMessages = await this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
    });

    // Group by conversation partner
    const conversations = new Map();
    
    for (const message of allMessages) {
      const partnerId = message.senderId === userId ? message.receiverId : message.senderId;
      
      if (!conversations.has(partnerId)) {
        const partner = await this.prisma.user.findUnique({
          where: { id: partnerId },
          select: { id: true, name: true, email: true },
        });
        
        if (!partner) continue;
        
        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            senderId: partnerId,
            receiverId: userId,
            isRead: false,
          },
        });
        
        conversations.set(partnerId, {
          userId: partner.id,
          userName: partner.name,
          userEmail: partner.email,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
          unreadCount,
        });
      }
    }
    
    return Array.from(conversations.values());
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
}
