import { useSyncExternalStore } from 'react';

// Sesler dosya yerine tarayıcının Web Audio özelliğiyle üretilir: indirme yok, telif sorunu yok.

export type SoundName =
  'join' | 'start' | 'tick' | 'tickUrgent' | 'reveal' | 'correct' | 'wrong' | 'fanfare';

interface Note {
  freq: number;
  /** Notanın başlangıcı (sn, sesin başından itibaren). */
  at: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
}

const SOUNDS: Record<SoundName, Note[]> = {
  join: [{ freq: 880, at: 0, duration: 0.08, type: 'sine', volume: 0.15 }],
  start: [
    { freq: 523, at: 0, duration: 0.12 },
    { freq: 659, at: 0.12, duration: 0.12 },
    { freq: 784, at: 0.24, duration: 0.2 },
  ],
  tick: [{ freq: 1000, at: 0, duration: 0.04, type: 'square', volume: 0.05 }],
  tickUrgent: [{ freq: 1400, at: 0, duration: 0.06, type: 'square', volume: 0.08 }],
  reveal: [
    { freq: 392, at: 0, duration: 0.15 },
    { freq: 523, at: 0.15, duration: 0.25 },
  ],
  correct: [
    { freq: 659, at: 0, duration: 0.1 },
    { freq: 988, at: 0.1, duration: 0.25 },
  ],
  wrong: [
    { freq: 220, at: 0, duration: 0.18, type: 'sawtooth', volume: 0.1 },
    { freq: 165, at: 0.18, duration: 0.3, type: 'sawtooth', volume: 0.1 },
  ],
  fanfare: [
    { freq: 523, at: 0, duration: 0.15 },
    { freq: 659, at: 0.15, duration: 0.15 },
    { freq: 784, at: 0.3, duration: 0.15 },
    { freq: 1047, at: 0.45, duration: 0.5 },
  ],
};

const STORAGE_KEY = 'canli-quiz:sound';
const listeners = new Set<() => void>();
let context: AudioContext | null = null;

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

let enabled = readEnabled();

function getContext(): AudioContext | null {
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

export const sound = {
  /**
   * Tarayıcılar sesi ancak bir kullanıcı etkileşiminden sonra başlatır.
   * Butonlara tıklanınca çağrılır.
   */
  unlock() {
    const ctx = getContext();
    if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined);
  },

  play(name: SoundName) {
    if (!enabled) return;
    const ctx = getContext();
    if (!ctx || ctx.state !== 'running') return;
    const start = ctx.currentTime + 0.01;

    for (const note of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type ?? 'triangle';
      osc.frequency.value = note.freq;

      // Tıkırtı olmasın diye ses hızla yükselip yumuşakça söner.
      const t0 = start + note.at;
      const peak = note.volume ?? 0.2;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.duration);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + note.duration + 0.02);
    }
  },

  isEnabled: () => enabled,

  setEnabled(value: boolean) {
    enabled = value;
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
    } catch {
      // Depolama kapalıysa tercih sadece bu sayfada geçerli olur.
    }
    if (value) sound.unlock();
    listeners.forEach((l) => l());
  },
};

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled,
  );
}

/** Telefonda kısa titreşim. Desteklemeyen cihazlarda ve ses kapalıyken bir şey yapmaz. */
export function vibrate(pattern: number | number[]) {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Bazı tarayıcılar izin vermez; sorun değil.
  }
}
