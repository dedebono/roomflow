import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UploadPaymentDto {
  @IsUUID()
  @IsNotEmpty()
  bookingHoldId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999999999)
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;
}
