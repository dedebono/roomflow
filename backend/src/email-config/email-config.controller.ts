import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmailConfigService } from './email-config.service';
import { EmailService } from '../email/email.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('email-config')
export class EmailConfigController {
  constructor(
    private readonly emailConfigService: EmailConfigService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  @Roles(Role.ADMIN_IT)
  get() {
    return this.emailConfigService.get();
  }

  @Put()
  @Roles(Role.ADMIN_IT)
  update(
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
    const result = this.emailConfigService.update(body);
    this.emailService.clearCache();
    return result;
  }

  @Post('test')
  @Roles(Role.ADMIN_IT)
  @HttpCode(HttpStatus.OK)
  async testSend(@Body() body: { to: string }) {
    return this.emailService.testConnection(body.to);
  }
}
