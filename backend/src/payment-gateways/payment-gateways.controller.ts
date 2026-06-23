import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseBoolPipe,
} from '@nestjs/common';
import { PaymentGatewaysService } from './payment-gateways.service';
import { CreatePaymentGatewayDto } from './dto/create-payment-gateway.dto';
import { UpdatePaymentGatewayDto } from './dto/update-payment-gateway.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('payment-gateways')
export class PaymentGatewaysController {
  constructor(
    private readonly paymentGatewaysService: PaymentGatewaysService,
  ) {}

  @Post()
  @Roles(Role.ADMIN_IT)
  create(@Body() createPaymentGatewayDto: CreatePaymentGatewayDto) {
    return this.paymentGatewaysService.create(createPaymentGatewayDto);
  }

  @Get()
  @Roles(Role.ADMIN_IT)
  findAll() {
    return this.paymentGatewaysService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN_IT)
  findOne(@Param('id') id: string) {
    return this.paymentGatewaysService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN_IT)
  update(
    @Param('id') id: string,
    @Body() updatePaymentGatewayDto: UpdatePaymentGatewayDto,
  ) {
    return this.paymentGatewaysService.update(id, updatePaymentGatewayDto);
  }

  @Patch(':id/toggle')
  @Roles(Role.ADMIN_IT)
  toggleEnabled(
    @Param('id') id: string,
    @Body('enabled', ParseBoolPipe) enabled: boolean,
  ) {
    return this.paymentGatewaysService.toggleEnabled(id, enabled);
  }

  @Delete(':id')
  @Roles(Role.ADMIN_IT)
  remove(@Param('id') id: string) {
    return this.paymentGatewaysService.remove(id);
  }
}
