import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class InitiatePaymentDto {
  @IsString()
  @IsNotEmpty()
  bookingHoldId: string;

  @IsString()
  @IsNotEmpty()
  gatewayId: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;
}