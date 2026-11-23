import { useEffect, useState } from 'react';

/**
 * Soru süresi sunucu saatine göre biter. Telefonun saati birkaç saniye ileri/geri olabileceği
 * için her görünüm mesajı geldiğinde `serverNow` ile aradaki fark kaydedilir.
 */
let clockOffsetMs = 0;
export function syncServerClock(serverNow: number) {
  clockOffsetMs = serverNow - Date.now();
}

/** Sorunun bitmesine kalan süre (ms). Soru yoksa null. */
export function useCountdown(endsAt: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [endsAt]);

  if (endsAt === null) return null;
  return Math.max(0, endsAt - (now + clockOffsetMs));
}

/** Tarayıcı depolaması kapalı olabilir (gizli sekme); hata vermeden çalışır. */
export const sessionValue = {
  get(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch {
      // Depolama yoksa sayfa yenilenince oturum kaybolur; oyun yine çalışır.
    }
  },
};

/** Şıkların rengi ve renk körleri için şekli. */
export const CHOICE_STYLES = [
  { bg: 'bg-red-600', bar: 'bg-red-500', shape: '▲', label: 'Kırmızı üçgen' },
  { bg: 'bg-blue-600', bar: 'bg-blue-500', shape: '◆', label: 'Mavi karo' },
  { bg: 'bg-amber-500', bar: 'bg-amber-400', shape: '●', label: 'Sarı daire' },
  { bg: 'bg-green-600', bar: 'bg-green-500', shape: '■', label: 'Yeşil kare' },
] as const;

export const choiceStyle = (index: number) => CHOICE_STYLES[index % CHOICE_STYLES.length]!;
