import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Aturan pengulangan untuk satu paket sewa.
 *
 * `intervalWeeks` 1 = tiap minggu, 2 = tiap 2 minggu.
 * `daysOfWeek` dipakai HANYA saat `pattern = 'CUSTOM'` — 1=Senin .. 7=Minggu.
 * Aturan sederhana: pola CUSTOM menghasilkan satu sesi per hari terpilih
 * di dalam setiap siklus, jadi 3 hari x 8 minggu = 24 sesi.
 */
export class SeriesDto {
  @IsIn(['ONCE', 'WEEKLY', 'BIWEEKLY', 'CUSTOM'])
  pattern: 'ONCE' | 'WEEKLY' | 'BIWEEKLY' | 'CUSTOM';

  /** Berulang setiap berapa minggu. Default 1 (tiap minggu). */
  @IsOptional() @IsInt() @Min(1) @Max(4)
  intervalWeeks?: number;

  /** 1=Senin .. 7=Minggu. Wajib saat pattern = CUSTOM. */
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(7) @IsInt({ each: true })
  daysOfWeek?: number[];

  /** Tanggal terakhir (YYYY-MM-DD). Wajib kalau occurrences tidak diisi. */
  @IsOptional() @IsString()
  until?: string;

  /** Jumlah sesi yang diinginkan. Alternatif dari `until`. */
  @IsOptional() @IsInt() @Min(1) @Max(400)
  occurrences?: number;
}

/**
 * Tambah satu paket sewa berkala untuk BANYAK ruangan sekaligus.
 *
 * Cross-product: setiap ruangan x setiap tanggal hasil pola. Semua tanggal
 * memakai jam yang sama (slot yang dipilih), jadi satu SERIES = banyak item
 * CartItem yang expanded di server — bukan N request dari browser.
 */
export class AddSeriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  roomIds: string[];

  /** Slot acuan — jam nominal-UTC milik tanggal pertama. */
  @IsISO8601() startTime: string;
  @IsISO8601() endTime: string;

  @ValidateNested()
  @Type(() => SeriesDto)
  series: SeriesDto;

  @IsOptional() @IsString()
  label?: string;
}