// Shared formatting helpers – used across booking/room pages.

export const formatRupiah = (amount: number | undefined): string =>
  amount !== undefined
    ? 'Rp ' + amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : 'Rp -';

// Date string ("2026-07-27T09:00:00.000Z" or "2026-07-27") -> "Jul 27, 2026"
export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const cleanDate = dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr;
  return new Date(cleanDate + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// "2026-07-27T09:00:00.000Z" -> "09:00"
// Stored times are nominal wall-clock (UTC-nominated); read HH:MM substring directly
// to keep display identical to what user picked, without TZ conversion.
export const formatTime = (isoStr?: string): string => {
  if (!isoStr) return '--:--';
  return isoStr.length >= 16 ? isoStr.substring(11, 16) : isoStr;
};

// Date string ("2026-07-27") + time string ("09:00") -> "Jul 27 at 09:00"
export const formatDateTime = (dateStr?: string, timeStr?: string): string => {
  if (!dateStr) return '-';
  const cleanDate = dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr;
  const d = new Date(cleanDate + 'T00:00:00');
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr || '--:--'}`;
};
