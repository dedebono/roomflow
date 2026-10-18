import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('managers')
  getManagers() {
    return this.usersService.getManagers();
  }

  /**
   * Daftar renter untuk Room Manager — padanan `GET /users/managers` yang
   * dipakai halaman chat renter.
   *
   * Dulu halaman `/chat` milik staff memanggil `GET /users`, yang hanya
   * diizinkan ADMIN_IT, jadi Room Manager mendapat 403 dan layarnya kosong
   * tanpa pesan error (ditemukan oleh audit QA). Endpoint khusus ini
   * mengembalikan field seperlunya saja — bukan data user lengkap.
   */
  @Get('renters')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  getRenters() {
    return this.usersService.getRenters();
  }

  @Post()
  @Roles(Role.ADMIN_IT)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(Role.ADMIN_IT)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN_IT)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN_IT)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN_IT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
