import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface WahaConfig {
  enabled: boolean;
  wahaUrl: string | null;
  wahaSession: string;
  wahaApiKey: string | null;
}

@Injectable()
export class WhatsAppService {
  // Fallbacks from env (used when DB has no config)
  private readonly envEnabled: boolean;
  private readonly envUrl: string;
  private readonly envSession: string;
  private readonly envApiKey: string;
  private readonly swaggerUsername: string;
  private readonly swaggerPassword: string;

  // Cached config from DB (refreshed on each write via WahaConfigService)
  private cachedConfig: WahaConfig | null = null;
  private cacheTime = 0;
  private readonly CACHE_TTL_MS = 5_000; // 5s — avoid stale reads, stay fast

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.envEnabled = this.configService.get<string>('WAHA_ENABLED') === 'true';
    this.envUrl =
      this.configService.get<string>('WAHA_API_URL') || 'http://waha:3000';
    this.envSession =
      this.configService.get<string>('WAHA_SESSION') || 'default';
    this.envApiKey = this.configService.get<string>('WAHA_API_KEY') || '';
    this.swaggerUsername =
      this.configService.get<string>('WHATSAPP_SWAGGER_USERNAME') || '';
    this.swaggerPassword =
      this.configService.get<string>('WHATSAPP_SWAGGER_PASSWORD') || '';
  }

  /** Returns the effective runtime config — DB value wins over env fallback. */
  private async getConfig(): Promise<WahaConfig> {
    const now = Date.now();
    if (this.cachedConfig && now - this.cacheTime < this.CACHE_TTL_MS) {
      return this.cachedConfig;
    }
    const db = await this.prisma.wahaConfig.findFirst();
    this.cachedConfig = {
      enabled: db?.enabled ?? this.envEnabled,
      wahaUrl: db?.wahaUrl ?? this.envUrl,
      wahaSession: db?.wahaSession ?? this.envSession,
      wahaApiKey: db?.wahaApiKey ?? this.envApiKey,
    };
    this.cacheTime = now;
    return this.cachedConfig;
  }

  /** Clear cache so the next request picks up fresh DB values. */
  clearCache() {
    this.cachedConfig = null;
  }

  /** Normalize phone number to 62 format (no +, no 0 prefix) */
  normalizeNumber(num: string): string {
    let cleaned = num.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    return cleaned;
  }

  async sendText(to: string, text: string): Promise<void> {
    const config = await this.getConfig();
    if (!config.enabled) {
      console.log('[WhatsApp] Message would have been sent (disabled):', {
        to,
        text,
      });
      return;
    }

    try {
      const normalized = this.normalizeNumber(to);
      const chatId = `${normalized}@c.us`;
      const apiUrl = config.wahaUrl || this.envUrl;
      const session = config.wahaSession || this.envSession;
      const apiKey = config.wahaApiKey || this.envApiKey;

      const response = await fetch(`${apiUrl}/api/sendText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          'X-Api-Username': this.swaggerUsername,
          'X-Api-Password': this.swaggerPassword,
        },
        body: JSON.stringify({ chatId, text, session }),
      });

      if (!response.ok) {
        console.error(
          '[WhatsApp] WAHA sendText failed:',
          response.status,
          await response.text(),
        );
      } else {
        const data = await response.json();
        console.log('[WhatsApp] Message sent to', chatId, ':', data);
      }
    } catch (err: unknown) {
      console.error(
        '[WhatsApp] Failed to send message:',
        (err as Error).message,
      );
    }
  }

  async sendBookingConfirmation(
    to: string,
    bookingTitle: string,
    roomName: string,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
    const text =
      `✅ *Booking Confirmed*\n\n` +
      `Room: ${roomName}\n` +
      `Title: ${bookingTitle}\n` +
      `Start: ${startTime.toLocaleString()}\n` +
      `End: ${endTime.toLocaleString()}\n\n` +
      `RoomFlow Workspace Booking Engine`;
    await this.sendText(to, text);
  }

  async sendPaymentApproved(to: string, amount: number): Promise<void> {
    const text =
      `✅ *Payment Approved*\n\n` +
      `Amount: Rp${amount.toLocaleString('id-ID')}\n` +
      `Your payment has been approved. Thank you!\n\n` +
      `RoomFlow`;
    await this.sendText(to, text);
  }

  async sendPaymentRejected(
    to: string,
    amount: number,
    reason?: string,
  ): Promise<void> {
    const text =
      `❌ *Payment Rejected*\n\n` +
      `Amount: Rp${amount.toLocaleString('id-ID')}\n` +
      (reason ? `Reason: ${reason}\n\n` : '\n') +
      `Please review and resubmit.\n\n` +
      `RoomFlow`;
    await this.sendText(to, text);
  }

  async sendBookingCancellation(
    to: string,
    bookingTitle: string,
  ): Promise<void> {
    const text =
      `❌ *Booking Cancelled*\n\n` +
      `Title: ${bookingTitle}\n` +
      `Your booking has been cancelled.\n\n` +
      `RoomFlow`;
    await this.sendText(to, text);
  }

  async sendNewMessage(
    to: string,
    senderName: string,
    content: string,
  ): Promise<void> {
    const text =
      `💬 *New Message*\n\n` +
      `From: ${senderName}\n` +
      `Message: ${content}\n\n` +
      `Tap to reply in RoomFlow.`;
    await this.sendText(to, text);
  }
}
