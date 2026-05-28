import {
  WebSocketGateway as WsGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
@WsGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class RoomFlowWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('RoomFlowWebSocketGateway');

  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Set<any>> = new Map();

  constructor(private jwtService: JwtService) {}

  handleConnection(client: any) {
    try {
      // Extract token from URL query string
      const url = new URL(client.url, 'http://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        this.logger.warn(`Client ${client.id || 'unknown'} connected without token`);
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      client.data = { userId };

      // Track user sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client);

      this.logger.log(`User ${userId} connected via WebSocket`);

      client.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.event === 'ping') {
            client.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      client.on('close', () => {
        this.handleDisconnect(client);
      });

      client.on('error', () => {
        this.handleDisconnect(client);
      });
    } catch (error) {
      this.logger.warn(`Invalid token for client`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: any) {
    const userId = client.data?.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.logger.log(`User ${userId} disconnected`);
    }
  }

  // Emit to a specific user's socket(s)
  private sendToUser(userId: string, payload: string) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach((socket) => {
        try {
          socket.send(payload);
        } catch (e) {
          // Socket may be closed
        }
      });
    }
  }

  sendBookingUpdate(userId: string, bookingData: any) {
    const payload = JSON.stringify({ type: 'booking_update', data: bookingData });
    this.sendToUser(userId, payload);
  }

  sendPaymentUpdate(userId: string, paymentData: any) {
    const payload = JSON.stringify({ type: 'payment_update', data: paymentData });
    this.sendToUser(userId, payload);
  }

  sendNewMessage(messageData: any) {
    const payload = JSON.stringify({ type: 'new_message', data: messageData });
    if (messageData.senderId) {
      this.sendToUser(messageData.senderId, payload);
    }
    if (messageData.receiverId) {
      this.sendToUser(messageData.receiverId, payload);
    }
  }

  sendNotification(userId: string, notification: any) {
    const payload = JSON.stringify({ type: 'notification', data: notification });
    this.sendToUser(userId, payload);
  }
}
