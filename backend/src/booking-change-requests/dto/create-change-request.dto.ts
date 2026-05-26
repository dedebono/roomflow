import { IsNotEmpty, IsUUID, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateChangeRequestDto {
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;

  @IsUUID()
  @IsOptional()
  requestedRoomId?: string;

  @IsDateString()
  @IsOptional()
  requestedStart?: string;

  @IsDateString()
  @IsOptional()
  requestedEnd?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
