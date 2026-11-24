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

const relative = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** Geçmiş bir zamanı "3 gün önce", "dün" gibi gösterir. */
export function formatRelative(iso: string, now = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, sec] of UNITS) {
    if (Math.abs(diffSec) >= sec) return relative.format(Math.round(diffSec / sec), unit);
  }
  return 'az önce';
}
