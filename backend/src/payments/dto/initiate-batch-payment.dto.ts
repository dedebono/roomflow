import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InitiateBatchPaymentDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  bookingHoldIds: string[];

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
