import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { CreateRentalSlotDto } from './dto/create-rental-slot.dto';
import { UpdateRentalSlotDto } from './dto/update-rental-slot.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, RoomCategory } from '@prisma/client';

/**
 * Endpoint create-hold / cancel-hold / book-from-hold DIHAPUS.
 * Kunci slot sekarang hanya dibuat lewat POST /checkout (CheckoutController).
 */
@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get('available-rooms')
  @Public()
  getAvailableRooms(@Query('category') category?: RoomCategory) {
    return this.rentalsService.getAvailableRooms(category);
  }

  @Get('rooms/:id')
  getRoomDetails(@Param('id') id: string) {
    return this.rentalsService.getRoomDetails(id);
  }

  @Get('rooms/:id/availability')
  getRoomAvailability(@Param('id') id: string, @Query('month') month: string) {
    return this.rentalsService.getRoomAvailability(id, month);
  }

  @Get('available-slots')
  getAvailableSlots(
    @Query('roomId') roomId: string,
    @Query('date') date: string,
  ) {
    return this.rentalsService.getAvailableSlots(roomId, date);
  }

  @Get('slots')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  getSlots(
    @Query('roomId') roomId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.rentalsService.getSlots(roomId, page, limit);
  }

  @Post('slots')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  createSlot(@Body() dto: CreateRentalSlotDto) {
    return this.rentalsService.createSlot(dto);
  }

  @Patch('slots/:id')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  updateSlot(@Param('id') id: string, @Body() dto: UpdateRentalSlotDto) {
    return this.rentalsService.updateSlot(id, dto);
  }

  @Delete('slots/:id')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  deleteSlot(@Param('id') id: string) {
    return this.rentalsService.deleteSlot(id);
  }

  // --- Jam operasional staff ------------------------------------------------

  @Get('staff-windows')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  getStaffWindows(@Query('roomId') roomId?: string) {
    return this.rentalsService.getStaffWindows(roomId);
  }

  @Post('staff-windows')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  createStaffWindow(@Body() dto: any) {
    return this.rentalsService.createStaffWindow(dto);
  }

  @Delete('staff-windows/:id')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  deleteStaffWindow(@Param('id') id: string) {
    return this.rentalsService.deleteStaffWindow(id);
  }

  /**
   * Peringatan konfigurasi: jam staff dan jam sewa di ruangan yang sama
   * bertabrakan. Tidak memblokir — exclusion constraint yang tetap menjaga.
   */
  @Get('window-conflicts')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  findWindowConflicts() {
    return this.rentalsService.findWindowConflicts();
  }

  @Get('stats')
  getRenterStats(@CurrentUser('userId') userId: string) {
    return this.rentalsService.getRenterStats(userId);
  }
}
