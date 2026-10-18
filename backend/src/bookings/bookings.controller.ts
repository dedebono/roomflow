import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * Booking instan untuk staff, hanya di dalam jam kerja.
   * Renter DITOLAK di sini (403) — harus lewat POST /checkout.
   */
  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: Role,
    @Body() createBookingDto: CreateBookingDto,
  ) {
    return this.bookingsService.create(userId, role, createBookingDto);
  }

  /**
   * Daftar booking.
   *
   * Renter hanya boleh melihat booking MILIKNYA SENDIRI. Tanpa scoping ini
   * findAll() menerima userId opsional, jadi RENTER yang memanggil tanpa
   * query apa pun mendapat seluruh booking semua user — lengkap dengan
   * nama, email, dan judul rapat. Query ?userId=<orang lain> juga harus
   * diabaikan, bukan dipercaya.
   */
  @Get()
  findAll(
    @CurrentUser('userId') callerId: string,
    @CurrentUser('role') role: Role,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('roomId') roomId?: string,
    @Query('userId') userId?: string,
  ) {
    // Renter HANYA boleh melihat booking miliknya sendiri — dipaksa di
    // controller, bukan di service, karena service yang menerima userId
    // akan selalu dipanggil dengan nilai dari pemanggil.
    //
    // Perhatikan Role.USER, bukan hanya Role.RENTER: akun seed
    // `user@roomflow.local` ber-role USER, dan hanya mengecek RENTER
    // membuat filter ini lolos untuknya sehingga ia melihat SELURUH
    // tabel booking — termasuk nama + email user lain.
    const restricted = role === Role.RENTER || role === Role.USER;
    const scopedUserId = restricted ? callerId : userId;
    return this.bookingsService.findAll(roomId, scopedUserId, page, limit);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.bookingsService.cancel(id, userId, role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('userId') actorId: string,
    @CurrentUser('role') role: Role,
    @Body() updateBookingDto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(id, actorId, role, updateBookingDto);
  }
}
