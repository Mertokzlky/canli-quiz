/** Türkçe tarih ve saat, ör. "24 Kas 2026 14:05". */
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });

/** Saniyeyi "3 dk 05 sn" biçiminde gösterir. */
export function formatDuration(totalSec: number | null): string {
  if (totalSec === null) return '—';
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min === 0 ? `${sec} sn` : `${min} dk ${String(sec).padStart(2, '0')} sn`;
}

/** 0-1 arası oranı yüzde olarak gösterir; değer yoksa "—". */
export const formatPercent = (ratio: number | null) =>
  ratio === null ? '—' : `%${Math.round(ratio * 100)}`;
