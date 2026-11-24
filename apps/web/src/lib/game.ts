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

/** Şıkların rengi (şekiller ChoiceShape'te). `dot` editördeki küçük renk işaretidir. */
export const CHOICE_STYLES = [
  {
    bg: 'bg-gradient-to-br from-rose-500 to-red-600 shadow-red-950/30',
    dot: 'bg-rose-500',
    label: 'Kırmızı üçgen',
  },
  {
    bg: 'bg-gradient-to-br from-sky-500 to-blue-600 shadow-blue-950/30',
    dot: 'bg-sky-500',
    label: 'Mavi karo',
  },
  {
    bg: 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-950/30',
    dot: 'bg-amber-400',
    label: 'Sarı daire',
  },
  {
    bg: 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-green-950/30',
    dot: 'bg-emerald-500',
    label: 'Yeşil kare',
  },
] as const;

export const choiceStyle = (index: number) => CHOICE_STYLES[index % CHOICE_STYLES.length]!;
