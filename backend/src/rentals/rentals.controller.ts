import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  Header,
} from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { CreateHoldDto } from './dto/create-hold.dto';
import { CreateRentalSlotDto } from './dto/create-rental-slot.dto';
import { UpdateRentalSlotDto } from './dto/update-rental-slot.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, RoomCategory } from '@prisma/client';

@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get('available-rooms')
  @Public()
  getAvailableRooms(
    @Query('date') date: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('category') category?: string,
  ) {
    return this.rentalsService.getAvailableRooms(date, startDate, endDate, category as RoomCategory);
  }

  @Get('rooms/:id')
  @Public()
  getRoomDetails(@Param('id') roomId: string) {
    return this.rentalsService.getRoomDetails(roomId);
  }

  @Get('rooms/:id/availability')
  @Public()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  getRoomAvailability(@Param('id') roomId: string, @Query('month') month: string) {
    return this.rentalsService.getRoomAvailability(roomId, month);
  }

  @Post('check-availability')
  @Public()
  checkAvailability(@Body() dto: CheckAvailabilityDto) {
    return this.rentalsService.checkAvailability(
      dto.roomId,
      dto.date,
      dto.startTime,
      dto.endTime,
    );
  }

  @Post('create-hold')
  createHold(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateHoldDto,
  ) {
    return this.rentalsService.createHold(
      userId,
      dto.roomId,
      dto.date,
      dto.startTime,
      dto.endTime,
    );
  }

  @Post('book-from-hold/:holdId')
  bookFromHold(
    @Param('holdId') holdId: string,
  ) {
    return this.rentalsService.bookFromHold(holdId);
  }

  @Get('my-bookings')
  getMyBookings(@CurrentUser('userId') userId: string) {
    return this.rentalsService.getMyBookings(userId);
  }

  @Get('holds')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  getAllHolds(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.rentalsService.getAllHolds(page, limit);
  }

  @Get('holds/active')
  getActiveHolds(@CurrentUser('userId') userId: string) {
    return this.rentalsService.getActiveHolds(userId);
  }

  @Get('my-holds')
  getMyHolds(@CurrentUser('userId') userId: string) {
    return this.rentalsService.getMyHolds(userId);
  }

  @Get('holds/:id')
  getHoldById(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.rentalsService.getHoldById(id, userId);
  }

  @Delete('holds/:id')
  cancelHold(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.rentalsService.cancelHold(id, userId);
  }

  // RentalSlot CRUD
  @Get('slots')
  getSlots(
    @Query('roomId') roomId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.rentalsService.getSlots(roomId, page, limit);
  }

  @Get('available-slots')
  getAvailableSlots(@Query('roomId') roomId: string, @Query('date') date: string) {
    return this.rentalsService.getAvailableSlots(roomId, date);
  }

  @Get('active-hold')
  getActiveHold(@CurrentUser('userId') userId: string, @Query('roomId') roomId: string) {
    return this.rentalsService.getActiveHoldForRoom(userId, roomId);
  }

  @Post('slots')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  createSlot(@Body() dto: CreateRentalSlotDto) {
    return this.rentalsService.createSlot(dto);
  }

  @Patch('slots/:id')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  updateSlot(
    @Param('id') id: string,
    @Body() dto: UpdateRentalSlotDto,
  ) {
    return this.rentalsService.updateSlot(id, dto);
  }

  @Delete('slots/:id')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  deleteSlot(@Param('id') id: string) {
    return this.rentalsService.deleteSlot(id);
  }
}
