import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
} from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { CreateHoldDto } from './dto/create-hold.dto';
import { CreateRentalSlotDto } from './dto/create-rental-slot.dto';
import { UpdateRentalSlotDto } from './dto/update-rental-slot.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get('available-rooms')
  @Public()
  getAvailableRooms(@Query('date') date: string, @Query('category') category?: string) {
    return this.rentalsService.getAvailableRooms(date, category as any);
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
  getAllHolds() {
    return this.rentalsService.getAllHolds();
  }

  @Get('holds/active')
  getActiveHolds(@CurrentUser('userId') userId: string) {
    return this.rentalsService.getActiveHolds(userId);
  }

  @Get('my-holds')
  getMyHolds(@CurrentUser('userId') userId: string) {
    return this.rentalsService.getMyHolds(userId);
  }

  // RentalSlot CRUD
  @Get('slots')
  getSlots(@Query('roomId') roomId?: string) {
    return this.rentalsService.getSlots(roomId);
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
  createSlot(@Body() dto: CreateRentalSlotDto) {
    return this.rentalsService.createSlot(dto);
  }

  @Patch('slots/:id')
  updateSlot(
    @Param('id') id: string,
    @Body() dto: UpdateRentalSlotDto,
  ) {
    return this.rentalsService.updateSlot(id, dto);
  }

  @Delete('slots/:id')
  deleteSlot(@Param('id') id: string) {
    return this.rentalsService.deleteSlot(id);
  }
}
