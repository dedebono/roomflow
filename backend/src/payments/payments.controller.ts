import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Role } from '@prisma/client';

/**
 * Payment kini read-only lewat API.
 *
 * Endpoint yang DIHAPUS (dan alasannya):
 *   POST  /payments/upload          -> bukti bayar manual; konfirmasi hanya webhook
 *   PATCH /payments/:id/approve     -> approval manual; tidak ada jalur refund
 *   PATCH /payments/:id/reject      -> idem
 *   POST  /payments/initiate        -> digantikan POST /checkout
 *   POST  /payments/initiate-batch  -> idem (multi-item kini all-or-nothing)
 *   GET   /payments/confirm-callback -> @Public dan status diambil dari query
 *      string, jadi siapa pun bisa membuka URL itu dan menandai order lunas.
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('gateways')
  @Public()
  getGateways() {
    return this.paymentsService.getEnabledGateways();
  }

  @Get('my')
  myPayments(@CurrentUser('userId') userId: string) {
    return this.paymentsService.myPayments(userId);
  }

  @Get('pending')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  getPending() {
    return this.paymentsService.getPending();
  }

  @Get('awaiting-settlement')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  listAwaiting() {
    return this.paymentsService.listAwaiting();
  }

  @Get('by-user/:userId')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  listForUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.paymentsService.listForUser(userId, role);
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.getOne(id);
  }
}
