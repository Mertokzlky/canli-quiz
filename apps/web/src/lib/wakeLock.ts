import { useEffect } from 'react';

/**
 * Sunucu ekranı (projeksiyon) oyun sırasında uykuya geçmesin diye ekranı açık tutar.
 * Tarayıcı desteklemiyorsa hiçbir şey yapmaz; sekme gizlenip geri gelince kilidi yeniler.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        // Pil tasarrufu modu gibi durumlarda reddedilebilir; oyun bundan etkilenmez.
      }
    };
    const onVisibility = () => {
      if (!released && document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
