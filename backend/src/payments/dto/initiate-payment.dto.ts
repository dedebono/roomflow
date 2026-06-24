import { IsString, IsNotEmpty, IsNumber, IsPositive, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class InitiatePaymentDto {
  @IsString()
  @IsNotEmpty()
  bookingHoldId: string;

  @IsString()
  @IsNotEmpty()
  gatewayId: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  paymentMethod?: string;
}