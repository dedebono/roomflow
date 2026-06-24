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
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import * as express from 'express';
import { UploadPaymentDto } from './dto/upload-payment.dto';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { paymentFileFilter, MAX_FILE_SIZE } from '../common/validators/file.validator';
import { Public } from '../common/decorators/public.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: paymentFileFilter,
  }))
  upload(
    @CurrentUser('userId') userId: string,
    @Req() req: express.Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    let dto: UploadPaymentDto;
    try {
      const rawData = req.body.paymentData || req.body;
      dto = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch (e) {
      throw new Error('Invalid payment data format');
    }
    
    if (!dto || !dto.bookingHoldId) {
      throw new Error('Missing bookingHoldId in payment data');
    }

    return this.paymentsService.upload(
      userId,
      dto.bookingHoldId,
      file,
      Number(dto.amount),
      dto.description,
    );
  }

  @Get('pending')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  getPending() {
    return this.paymentsService.getPending();
  }

  @Get('gateways')
  @Public()
  getGateways() {
    return this.paymentsService.getEnabledGateways();
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

  @Post('initiate')
  initiatePayment(
    @CurrentUser('userId') userId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiatePayment(
      userId,
      dto.bookingHoldId,
      dto.gatewayId,
      dto.amount ?? 0,
      dto.paymentMethod,
    );
  }

  /**
   * Called when Pakasir redirects the user back after payment.
   * Pakasir appends ?order_id=...&status=completed/failed.
   * This acts like a manual webhook for redirect-based flows.
   */
  @Get('confirm-callback')
  @Public()
  confirmCallback(
    @Req() req: express.Request,
  ) {
    const { order_id, status } = req.query as Record<string, string>;
    return this.paymentsService.confirmPaymentCallback(order_id, status);
  }
}
