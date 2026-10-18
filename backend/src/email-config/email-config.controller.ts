import { Controller, Get, Put, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { EmailConfigService } from './email-config.service';
import { EmailService } from '../email/email.service';
import { Roles } from '../common/decorators/roles.decorator';
import { redact, REDACTED } from '../common/utils/redact';
import { Role } from '@prisma/client';

@Controller('email-config')
export class EmailConfigController {
  constructor(
    private readonly emailConfigService: EmailConfigService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  @Roles(Role.ADMIN_IT)
  async get() {
    // smtp password (field `pass`) tidak boleh keluar lewat API.
    return redact(await this.emailConfigService.get());
  }

  @Put()
  @Roles(Role.ADMIN_IT)
  async update(
    @Body()
    body: {
      enabled?: boolean;
      host?: string;
      port?: number;
      secure?: boolean;
      user?: string;
      pass?: string;
      fromAddress?: string;
    },
  ) {
    // Nilai tersamar / kosong = "jangan ubah password", bukan "hapus password".
    const incoming = body.pass;
    const unchanged = incoming === undefined || incoming === '' || incoming === REDACTED;
    const payload = unchanged ? { ...body, pass: undefined } : body;

    const result = await this.emailConfigService.update(payload);
    this.emailService.clearCache();
    return redact(result);
  }

  @Post('test')
  @Roles(Role.ADMIN_IT)
  @HttpCode(HttpStatus.OK)
  async testSend(@Body() body: { to: string }) {
    return this.emailService.testConnection(body.to);
  }
}
