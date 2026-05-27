import { PartialType } from '@nestjs/mapped-types';
import { CreateRoomDto } from './create-room.dto';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateRoomDto extends PartialType(CreateRoomDto) {
  @IsString()
  @IsOptional()
  amenities?: string;

  @IsBoolean()
  @IsOptional()
  isRentable?: boolean;

  @IsInt()
  @IsOptional()
  maxBookingHours?: number;
}
