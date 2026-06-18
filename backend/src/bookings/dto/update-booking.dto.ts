import { IsOptional, IsString, IsUUID, IsDateString, MaxLength } from 'class-validator';

export class UpdateBookingDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsUUID()
  @IsOptional()
  roomId?: string;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;
}
