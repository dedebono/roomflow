import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { v4 as uuid4 } from 'uuid';
import { Role } from '@prisma/client';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 30;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private whatsAppService: WhatsAppService,
    private emailService: EmailService,
  ) {}

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    role: string;
  }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    // Generate opaque refresh token
    const refresh_token = uuid4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refresh_token },
    });

    return {
      access_token,
      refresh_token,
      refresh_expires_in: this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (
      !user ||
      !(await bcrypt.compare(loginDto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);
    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        whatsappNumber: user.whatsappNumber,
        whatsappVerified: user.whatsappVerified,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const normalizedWa = registerDto.whatsappNumber
      ? this.whatsAppService.normalizeNumber(registerDto.whatsappNumber)
      : null;

    const user = await this.prisma.user.create({
      data: {
        name: registerDto.name,
        email: registerDto.email,
        whatsappNumber: normalizedWa,
        passwordHash: hashedPassword,
        role: registerDto.role ? registerDto.role : Role.RENTER,
      },
    });

    // Generate and send OTP if WhatsApp number or email provided
    if (user.whatsappNumber || user.email) {
      const otp = this.generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          whatsappOtpCode: otp,
          whatsappOtpExpiresAt: expiresAt,
        },
      });

      if (user.whatsappNumber) {
        await this.whatsAppService.sendText(
          user.whatsappNumber,
          `*RoomFlow - Account Verification*\n\nYour OTP code is: *${otp}*\n\nCode expires in 5 minutes.\n\nIf you didn't create an account, ignore this message.`,
        );
      }

      // Also send OTP via email (same message) when email is present
      if (user.email) {
        this.emailService
          .sendOtp(user.email, otp)
          .catch((err) => console.error('Email OTP failed:', err));
      }
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const tokens = await this.generateTokens(user);
    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        whatsappNumber: user.whatsappNumber,
        whatsappVerified: user.whatsappVerified,
      },
    };
  }

  async verifyOtp(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.whatsappNumber) {
      throw new BadRequestException('No WhatsApp number on account');
    }

    if (user.whatsappVerified) {
      throw new BadRequestException('Already verified');
    }

    if (!user.whatsappOtpCode || !user.whatsappOtpExpiresAt) {
      throw new BadRequestException('No OTP sent. Request a new one.');
    }

    if (user.whatsappOtpCode !== otp) {
      throw new BadRequestException('Invalid OTP code');
    }

    if (new Date() > user.whatsappOtpExpiresAt) {
      throw new BadRequestException('OTP expired. Request a new one.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        whatsappVerified: true,
        whatsappOtpCode: null,
        whatsappOtpExpiresAt: null,
      },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        whatsappNumber: user.whatsappNumber,
        whatsappVerified: true,
      },
    };
  }

  async resendOtp(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.whatsappNumber) {
      throw new BadRequestException('No WhatsApp number on account');
    }

    if (user.whatsappVerified) {
      throw new BadRequestException('Already verified');
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        whatsappOtpCode: otp,
        whatsappOtpExpiresAt: expiresAt,
      },
    });

    await this.whatsAppService.sendText(
      user.whatsappNumber,
      `*RoomFlow - Account Verification*\n\nYour new OTP code is: *${otp}*\n\nCode expires in 5 minutes.`,
    );

    // Also resend OTP via email (same message)
    if (user.email) {
      this.emailService
        .sendOtp(user.email, otp, true)
        .catch((err) => console.error('Email OTP failed:', err));
    }

    return { message: 'OTP resent' };
  }

  async getVerificationStatus(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      whatsappNumber: user.whatsappNumber,
      whatsappVerified: user.whatsappVerified,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      whatsappNumber: user.whatsappNumber,
      whatsappVerified: user.whatsappVerified,
    };
  }

  async refreshTokens(refreshToken: string) {
    const user = await this.prisma.user.findFirst({
      where: { refreshToken },
    });

    if (!user) {
      throw new ForbiddenException('Invalid refresh token');
    }

    // Generate new tokens and invalidate old refresh token
    const tokens = await this.generateTokens(user);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: 'Logged out successfully' };
  }
}
