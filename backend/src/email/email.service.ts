import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

export interface EmailData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface ResolvedEmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromAddress: string;
}

@Injectable()
export class EmailService {
  // Env fallbacks (used when DB has no config)
  private readonly envEnabled: boolean;
  private readonly envHost: string;
  private readonly envPort: number;
  private readonly envSecure: boolean;
  private readonly envUser: string;
  private readonly envPass: string;
  private readonly envFrom: string;

  // Cached config from DB (refreshed on each write)
  private cachedConfig: ResolvedEmailConfig | null = null;
  private cacheTime = 0;
  private readonly CACHE_TTL_MS = 5_000; // 5s

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.envEnabled = this.configService.get<string>('EMAIL_ENABLED') === 'true';
    this.envHost = this.configService.get<string>('EMAIL_HOST') || '';
    this.envPort = parseInt(this.configService.get<string>('EMAIL_PORT') || '587', 10);
    this.envSecure = this.configService.get<string>('EMAIL_SECURE') === 'true';
    this.envUser = this.configService.get<string>('EMAIL_USER') || '';
    this.envPass = this.configService.get<string>('EMAIL_PASS') || '';
    this.envFrom =
      this.configService.get<string>('EMAIL_FROM') || 'noreply@roomflow.local';
  }

  /** Clear cache so the next request picks up fresh DB values. */
  clearCache() {
    this.cachedConfig = null;
  }

  /** Returns the effective runtime config — DB value wins over env fallback. */
  private async getConfig(): Promise<ResolvedEmailConfig> {
    const now = Date.now();
    if (this.cachedConfig && now - this.cacheTime < this.CACHE_TTL_MS) {
      return this.cachedConfig;
    }
    const db = await this.prisma.emailConfig.findFirst();
    this.cachedConfig = {
      enabled: db?.enabled ?? this.envEnabled,
      host: db?.host || this.envHost,
      port: db?.port ?? this.envPort,
      secure: db?.secure ?? this.envSecure,
      user: db?.user || this.envUser,
      pass: db?.pass || this.envPass,
      fromAddress: db?.fromAddress || this.envFrom,
    };
    this.cacheTime = now;
    return this.cachedConfig;
  }

  private buildTransport(config: ResolvedEmailConfig): Transporter {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure, // true for 465 (SSL), false for 587 (STARTTLS)
      auth: config.user
        ? { user: config.user, pass: config.pass }
        : undefined,
    });
  }

  async sendEmail(data: EmailData): Promise<boolean> {
    const config = await this.getConfig();

    if (!config.enabled || !config.host) {
      console.log('[EmailService] Email would have been sent (disabled/no host):', {
        from: config.fromAddress,
        to: data.to,
        subject: data.subject,
        text: data.text,
      });
      return false;
    }

    try {
      const transporter = this.buildTransport(config);
      const info = await transporter.sendMail({
        from: `"RoomFlow" <${config.fromAddress}>`,
        to: data.to,
        subject: data.subject,
        text: data.text,
        html: data.html || data.text,
      });
      console.log('[EmailService] Message sent:', info.messageId);
      return true;
    } catch (err: unknown) {
      console.error('[EmailService] Failed to send email:', (err as Error).message);
      return false;
    }
  }

  /** Send a notification using the SAME message body as WhatsApp/WAHA. */
  async sendNotification(to: string, title: string, message: string): Promise<boolean> {
    const text = `*${title}*\n\n${message}`;
    const html = `<div style="font-family:Arial,sans-serif"><h3>${title}</h3><p style="white-space:pre-wrap">${message.replace(/\n/g, '<br/>')}</p><p><small>RoomFlow</small></p></div>`;
    return this.sendEmail({
      to,
      subject: `RoomFlow - ${title}`,
      text,
      html,
    });
  }

  /** Send an OTP email using the SAME message as the WhatsApp OTP. */
  async sendOtp(to: string, otp: string, isResend = false): Promise<boolean> {
    const title = 'RoomFlow - Account Verification';
    const text =
      `*RoomFlow - Account Verification*\n\n` +
      `Your ${isResend ? 'new ' : ''}OTP code is: *${otp}*\n\n` +
      `Code expires in 5 minutes.\n\n` +
      `If you didn't create an account, ignore this message.`;
    const html = `<div style="font-family:Arial,sans-serif"><h3>RoomFlow - Account Verification</h3><p>Your ${isResend ? 'new ' : ''}OTP code is: <strong>${otp}</strong></p><p>Code expires in 5 minutes.</p><p><small>If you didn't create an account, ignore this message.</small></p></div>`;
    return this.sendEmail({ to, subject: title, text, html });
  }

  /** Test the SMTP connection from the saved config. */
  async testConnection(to: string): Promise<{ sent: boolean; message: string }> {
    const config = await this.getConfig();
    if (!config.host) {
      return { sent: false, message: 'SMTP host not configured' };
    }
    try {
      const transporter = this.buildTransport(config);
      await transporter.verify();
      const sent = await this.sendEmail({
        to,
        subject: 'RoomFlow - Email Test',
        text: 'This is a test email sent from RoomFlow Email Settings.',
        html: '<p>This is a test email sent from <strong>RoomFlow</strong> Email Settings.</p>',
      });
      return {
        sent,
        message: sent
          ? 'Test email sent successfully'
          : 'SMTP configured but send failed — check credentials/logs',
      };
    } catch (err: unknown) {
      return { sent: false, message: `SMTP connection failed: ${(err as Error).message}` };
    }
  }

  // ---------------------------------------------------------------------------
  // Legacy structured notification helpers (used by bookings / change-requests)
  // ---------------------------------------------------------------------------

  async sendBookingConfirmation(
    to: string,
    bookingTitle: string,
    roomName: string,
    startTime: Date,
    endTime: Date,
  ): Promise<boolean> {
    const subject = 'RoomFlow - Booking Confirmation';
    const text = `Your booking "${bookingTitle}" has been confirmed for ${roomName} from ${startTime.toLocaleString()} to ${endTime.toLocaleString()}.`;
    const html = `
      <h2>Booking Confirmation</h2>
      <p>Your booking <strong>"${bookingTitle}"</strong> has been confirmed.</p>
      <ul>
        <li><strong>Room:</strong> ${roomName}</li>
        <li><strong>Start:</strong> ${startTime.toLocaleString()}</li>
        <li><strong>End:</strong> ${endTime.toLocaleString()}</li>
      </ul>
      <p>See you there!</p>
      <p><small>RoomFlow Workspace Booking Engine</small></p>
    `;
    return this.sendEmail({ to, subject, text, html });
  }

  async sendChangeRequestStatus(
    to: string,
    bookingTitle: string,
    status: string,
    reason?: string,
  ): Promise<boolean> {
    const subject = `RoomFlow - Change Request ${status}`;
    const statusText = status === 'APPROVED' ? 'approved' : 'rejected';
    const text = `Your change request for "${bookingTitle}" has been ${statusText}.${reason ? ` Reason: ${reason}` : ''}`;
    const html = `
      <h2>Change Request ${status}</h2>
      <p>Your change request for <strong>"${bookingTitle}"</strong> has been <strong>${statusText}</strong>.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p><small>RoomFlow Workspace Booking Engine</small></p>
    `;
    return this.sendEmail({ to, subject, text, html });
  }

  async sendBookingCancellation(
    to: string,
    bookingTitle: string,
    roomName: string,
  ): Promise<boolean> {
    const subject = 'RoomFlow - Booking Cancellation';
    const text = `Your booking "${bookingTitle}" for ${roomName} has been cancelled.`;
    const html = `
      <h2>Booking Cancelled</h2>
      <p>Your booking <strong>"${bookingTitle}"</strong> for <strong>${roomName}</strong> has been cancelled.</p>
      <p><small>RoomFlow Workspace Booking Engine</small></p>
    `;
    return this.sendEmail({ to, subject, text, html });
  }
}
