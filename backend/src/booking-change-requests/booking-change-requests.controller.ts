import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { BookingChangeRequestsService } from './booking-change-requests.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('booking-change-requests')
export class BookingChangeRequestsController {
  constructor(private readonly service: BookingChangeRequestsService) {}

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: CreateChangeRequestDto,
  ) {
    return this.service.create(userId, role, dto);
  }

  @Get()
  findAll(
    @CurrentUser('role') role: Role,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.findAll(role, userId);
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  approve(@Param('id') id: string, @CurrentUser('userId') reviewerId: string) {
    return this.service.approve(id, reviewerId);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  reject(@Param('id') id: string, @CurrentUser('userId') reviewerId: string) {
    return this.service.reject(id, reviewerId);
  }
}
