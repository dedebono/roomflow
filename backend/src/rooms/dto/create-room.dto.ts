import { IsNotEmpty, IsString, IsInt, IsOptional, IsUUID, IsEnum, IsBoolean } from 'class-validator';
import { RoomStatus } from '@prisma/client';
import { Type, Transform } from 'class-transformer';

export class CreateRoomDto {
  @IsUUID()
  @IsNotEmpty()
  buildingId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  capacity: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(RoomStatus)
  @IsOptional()
  status?: RoomStatus;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isRentable?: boolean;

  @IsString()
  @IsOptional()
  amenities?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  maxBookingHours?: number;
}
