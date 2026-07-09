import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private readonly enabled: boolean;
  private readonly fromAddress: string;

  constructor(private configService: ConfigService) {
    this.enabled = this.configService.get<string>('EMAIL_ENABLED') === 'true';
    this.fromAddress =
      this.configService.get<string>('EMAIL_FROM') || 'noreply@roomflow.local';
  }

  async sendEmail(data: EmailData): Promise<void> {
    if (!this.enabled) {
      // Log the email that would have been sent
      console.log('[EmailService] Email would have been sent (disabled):', {
        from: this.fromAddress,
        to: data.to,
        subject: data.subject,
        text: data.text,
      });
      return;
    }

    // In production, this would integrate with a real email service
    // (SendGrid, AWS SES, Nodemailer, etc.)
    console.log('[EmailService] Sending email:', {
      from: this.fromAddress,
      to: data.to,
      subject: data.subject,
    });

    // Example integration with Nodemailer:
    // const transporter = nodemailer.createTransport({ ... });
    // await transporter.sendMail({
    //   from: this.fromAddress,
    //   to: data.to,
    //   subject: data.subject,
    //   text: data.text,
    //   html: data.html,
    // });
  }

  async sendBookingConfirmation(
    to: string,
    bookingTitle: string,
    roomName: string,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
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

    await this.sendEmail({ to, subject, text, html });
  }

  async sendChangeRequestStatus(
    to: string,
    bookingTitle: string,
    status: string,
    reason?: string,
  ): Promise<void> {
    const subject = `RoomFlow - Change Request ${status}`;
    const statusText = status === 'APPROVED' ? 'approved' : 'rejected';
    const text = `Your change request for "${bookingTitle}" has been ${statusText}.${reason ? ` Reason: ${reason}` : ''}`;

    const html = `
      <h2>Change Request ${status}</h2>
      <p>Your change request for <strong>"${bookingTitle}"</strong> has been <strong>${statusText}</strong>.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p><small>RoomFlow Workspace Booking Engine</small></p>
    `;

    await this.sendEmail({ to, subject, text, html });
  }

  async sendBookingCancellation(
    to: string,
    bookingTitle: string,
    roomName: string,
  ): Promise<void> {
    const subject = 'RoomFlow - Booking Cancellation';
    const text = `Your booking "${bookingTitle}" for ${roomName} has been cancelled.`;

    const html = `
      <h2>Booking Cancelled</h2>
      <p>Your booking <strong>"${bookingTitle}"</strong> for <strong>${roomName}</strong> has been cancelled.</p>
      <p><small>RoomFlow Workspace Booking Engine</small></p>
    `;

    await this.sendEmail({ to, subject, text, html });
  }
}
