import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class PaymentGatewayConfigDto {
  @IsString()
  @IsOptional()
  apiUrl?: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  projectSlug?: string;

  @IsString()
  @IsOptional()
  virtualAccount?: string;
}

export class CreatePaymentGatewayDto {
  @IsString()
  @IsNotEmpty()
  name: string; // e.g., "Pakasir", "Ipaymu"

  @IsString()
  @IsOptional()
  logo?: string; // URL to logo

  @IsObject()
  @IsOptional()
  config?: Record<string, any>; // Plain object for Prisma Json compatibility

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
