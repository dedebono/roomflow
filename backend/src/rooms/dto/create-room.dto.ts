import { IsNotEmpty, IsString, IsInt, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { RoomStatus } from '@prisma/client';
import { Type } from 'class-transformer';

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
}
