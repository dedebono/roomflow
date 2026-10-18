import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CartItemDto {
  @IsUUID() roomId: string;

  /** Nominal-UTC: "2026-11-03T14:00:00.000Z". HH:MM == jam yang diklik user. */
  @IsISO8601() startTime: string;
  @IsISO8601() endTime: string;
}

export class AddCartItemDto extends CartItemDto {}

export class CheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  // Batas keras: 60 item per Order. Semula 10, tapi angka itu mustahil
  // untuk sewa berkala: satu paket "tiap Senin selama 3 bulan" = 12 sesi,
  // dan pola 3 hari x 4 minggu juga 12 sesi. Dengan batas 10, fitur ini
  // tidak bisa di-checkout sama sekali.
  //
  // Yang menahan penyalah guna BUKAN angka ini, tapi
  // MAX_ACTIVE_ORDERS_PER_USER = 3 di CheckoutService: satu user tidak bisa
  // punya lebih dari 3 order menunggu pembayaran, jadi eksposurnya
  // 3 x 60 slot, dan semuanya dilepas otomatis setelah TTL 15 menit.
  // Kalau angka ini dinaikkan lagi, naikkan juga MAX_ACTIVE_ORDERS_PER_USER.
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsOptional() gatewayId?: string;
  @IsOptional() @IsString() method?: string;
}

export class StaffBookingDto {
  @IsUUID() roomId: string;
  @IsString() title: string;

  @IsISO8601() startTime: string;
  @IsISO8601() endTime: string;

  @IsOptional() @IsString() notes?: string;
}