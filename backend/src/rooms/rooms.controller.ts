import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, RoomStatus } from '@prisma/client';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  create(
    @Body() createRoomDto: CreateRoomDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.roomsService.create(createRoomDto, file);
  }

  @Get()
  findAll(
    @Query('buildingId') buildingId?: string,
    @Query('status') status?: RoomStatus,
  ) {
    return this.roomsService.findAll(buildingId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  update(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.roomsService.update(id, updateRoomDto, file);
  }

  @Delete(':id')
  @Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)
  remove(@Param('id') id: string) {
    return this.roomsService.remove(id);
  }
}
