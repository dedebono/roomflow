import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateHoldDto {
  @IsUUID()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  startTime: string; // HH:MM

  @IsString()
  @IsNotEmpty()
  endTime: string; // HH:MM
}
