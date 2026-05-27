import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { UploadPaymentDto } from './dto/upload-payment.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser('userId') userId: string,
    @Body() dto: UploadPaymentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.paymentsService.upload(
      userId,
      dto.bookingHoldId,
      file,
      dto.amount,
      dto.description,
    );
  }

  @Get('pending')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  getPending() {
    return this.paymentsService.getPending();
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') managerId: string,
  ) {
    return this.paymentsService.approve(id, managerId);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') managerId: string,
    @Body('notes') notes?: string,
  ) {
    return this.paymentsService.reject(id, managerId, notes);
  }

  @Get('my')
  getMyPayments(@CurrentUser('userId') userId: string) {
    return this.paymentsService.getMyPayments(userId);
  }
}
