/**
 * Samarkan rahasia di respons konfigurasi.
 *
 * Tiga endpoint (payment-gateways, waha-config, email-config) mengembalikan
 * baris Prisma apa adanya, jadi kunci API masuk ke browser admin — terlihat
 * di Network tab, bisa disalin, dan ikut ter-screenshot saat QA. Nilai
 * aslinya hanya dibutuhkan server; frontend cukup tahu "sudah terisi".
 *
 * Pola: ganti nilai dengan penanda, tambah flag boolean. Form edit memakai
 * nilai kosong = "jangan diubah" (lihat PaymentGatewaysService.update).
 */

export const REDACTED = '••••••••';

/** Kunci yang tidak boleh pernah keluar lewat API. */
const SECRET_KEYS = [
  'apiKey',
  'wahaApiKey',
  'pass',
  'password',
  'token',
  'secret',
  'clientSecret',
] as const;

/**
 * Salin objek dan ganti setiap field rahasia dengan REDACTED.
 * Field yang sudah null/kosong dibiarkan kosong — "tidak ada key" dan
 * "ada key tersembunyi" adalah informasi berbeda.
 */
export function redact<T extends Record<string, unknown>>(row: T): T & { hasSecrets: boolean } {
  const out: Record<string, unknown> = {};
  let anySecret = false;

  for (const [key, value] of Object.entries(row ?? {})) {
    if ((SECRET_KEYS as readonly string[]).includes(key)) {
      if (value !== null && value !== undefined && value !== '') {
        anySecret = true;
        out[key] = REDACTED;
      } else {
        out[key] = value;
      }
    } else {
      out[key] = value;
    }
  }

  return { ...(out as T), hasSecrets: anySecret };
}