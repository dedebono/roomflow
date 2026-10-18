import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateRentalSlotDto {
  @IsString()
  roomId: string;

  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsNumber()
  price: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
