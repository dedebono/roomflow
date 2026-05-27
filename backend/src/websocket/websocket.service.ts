import { Injectable } from '@nestjs/common';
import { RoomFlowWebSocketGateway } from './websocket.gateway';

@Injectable()
export class WebSocketService {
  constructor(private readonly gateway: RoomFlowWebSocketGateway) {}

  async sendBookingUpdate(userId: string, bookingData: any) {
    await this.gateway.sendBookingUpdate(userId, bookingData);
  }

  async sendPaymentUpdate(userId: string, paymentData: any) {
    await this.gateway.sendPaymentUpdate(userId, paymentData);
  }

  async sendNewMessage(messageData: any) {
    await this.gateway.sendNewMessage(messageData);
  }

  async sendNotification(userId: string, notification: any) {
    await this.gateway.sendNotification(userId, notification);
  }
}
