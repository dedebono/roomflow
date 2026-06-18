import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  private readonly enabled: boolean;
  private readonly apiUrl: string;
  private readonly session: string;
  private readonly apiKey: string;
  private readonly swaggerUsername: string;
  private readonly swaggerPassword: string;
  private readonly gowsPath: string;
  private readonly gowsSocket: string;
  private readonly mediaStorage: string;
  private readonly zipper: string;
  private readonly whatsappApiSchema: string;
  private readonly whatsappDefaultEngine: string;

  constructor(private configService: ConfigService) {
    this.enabled = this.configService.get<string>('WAHA_ENABLED') === 'true';
    this.apiUrl = this.configService.get<string>('WAHA_API_URL') || 'http://waha:3000';
    this.session = this.configService.get<string>('WAHA_SESSION') || 'default';
    this.apiKey = this.configService.get<string>('WAHA_API_KEY') || '';
    this.swaggerUsername = this.configService.get<string>('WHATSAPP_SWAGGER_USERNAME') || '';
    this.swaggerPassword = this.configService.get<string>('WHATSAPP_SWAGGER_PASSWORD') || '';
    this.gowsPath = this.configService.get<string>('WAHA_GOWS_PATH') || '';
    this.gowsSocket = this.configService.get<string>('WAHA_GOWS_SOCKET') || '';
    this.mediaStorage = this.configService.get<string>('WAHA_MEDIA_STORAGE') || '';
    this.zipper = this.configService.get<string>('WAHA_ZIPPER') || '';
    this.whatsappApiSchema = this.configService.get<string>('WHATSAPP_API_SCHEMA') || 'http';
    this.whatsappDefaultEngine = this.configService.get<string>('WHATSAPP_DEFAULT_ENGINE') || 'WEBJS';
  }

  /** Normalize phone number to 62 format (no +, no 0 prefix) */
  normalizeNumber(num: string): string {
    // Strip all non-digits
    let cleaned = num.replace(/[^0-9]/g, '');
    // Replace leading 0 with 62 (Indonesia country code)
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    return cleaned;
  }

  async sendText(to: string, text: string): Promise<void> {
    if (!this.enabled) {
      console.log('[WhatsApp] Message would have been sent (disabled):', { to, text });
      return;
    }

    try {
      // Normalize number: strip +, convert 0→62, remove non-digits
      const normalized = this.normalizeNumber(to);
      const chatId = `${normalized}@c.us`;

      const response = await fetch(
        `${this.apiUrl}/api/sendText`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
            'X-Api-Username': this.swaggerUsername,
            'X-Api-Password': this.swaggerPassword,
          },
          body: JSON.stringify({
            chatId: chatId,
            text,
            session: this.session,
          }),
        },
      );

      if (!response.ok) {
        console.error('[WhatsApp] WAHA sendText failed:', response.status, await response.text());
      } else {
        const data = await response.json();
        console.log('[WhatsApp] Message sent to', chatId, ':', data);
      }
    } catch (err: any) {
      console.error('[WhatsApp] Failed to send message:', err.message);
    }
  }

  // Implement other message types using sendText or other WAHA API endpoints as needed
  async sendBookingConfirmation(to: string, bookingTitle: string, roomName: string, startTime: Date, endTime: Date): Promise<void> {
    const text = `✅ *Booking Confirmed*\n\n` +
      `Room: ${roomName}\n` +
      `Title: ${bookingTitle}\n` +
      `Start: ${startTime.toLocaleString()}\n` +
      `End: ${endTime.toLocaleString()}\n\n` +
      `RoomFlow Workspace Booking Engine`;

    await this.sendText(to, text);
  }

  async sendPaymentApproved(to: string, amount: number): Promise<void> {
    const text = `✅ *Payment Approved*\n\n` +
      `Amount: $${amount.toFixed(2)}\n` +
      `Your payment has been approved. Thank you!\n\n` +
      `RoomFlow`;

    await this.sendText(to, text);
  }

  async sendPaymentRejected(to: string, amount: number, reason?: string): Promise<void> {
    const text = `❌ *Payment Rejected*\n\n` +
      `Amount: $${amount.toFixed(2)}\n` +
      (reason ? `Reason: ${reason}\n\n` : '') +
      `Please review and resubmit.\n\n` +
      `RoomFlow`;

    await this.sendText(to, text);
  }

  async sendBookingCancellation(to: string, bookingTitle: string): Promise<void> {
    const text = `❌ *Booking Cancelled*\n\n` +
      `Title: ${bookingTitle}\n` +
      `Your booking has been cancelled.\n\n` +
      `RoomFlow`;

    await this.sendText(to, text);
  }

  async sendNewMessage(to: string, senderName: string, content: string): Promise<void> {
    const text = `💬 *New Message*\n\n` +
      `From: ${senderName}\n` +
      `Message: ${content}\n\n` +
      `Tap to reply in RoomFlow.`;

    await this.sendText(to, text);
  }
}
