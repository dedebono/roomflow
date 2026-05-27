import { IsNotEmpty, IsUUID, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadPaymentDto {
  @IsUUID()
  @IsNotEmpty()
  bookingHoldId: string;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}
