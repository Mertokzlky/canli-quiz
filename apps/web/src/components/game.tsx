import { motion } from 'motion/react';
import type { LeaderboardEntry } from '@canli-quiz/shared';
import { sound, useSoundEnabled } from '../lib/sound';
import { StageDecor } from './StageDecor';

export function CountdownBadge({
  remainingMs,
  totalSec,
}: {
  remainingMs: number;
  totalSec: number;
}) {
  const seconds = Math.ceil(remainingMs / 1000);
  const ratio = Math.min(1, remainingMs / (totalSec * 1000));
  const urgent = seconds <= 5;
  return (
    <div
      className={`relative grid h-16 w-16 shrink-0 place-items-center rounded-full shadow-lg ${urgent ? 'animate-pulse' : ''}`}
      style={{
        background: `conic-gradient(${urgent ? '#fb7185' : '#fbbf24'} ${ratio * 360}deg, rgba(255,255,255,0.15) 0deg)`,
      }}
      role="timer"
      aria-label={`${seconds} saniye kaldı`}
    >
      <span className="grid h-13 w-13 place-items-center rounded-full bg-brand-950 text-2xl font-extrabold text-white tabular-nums">
        {seconds}
      </span>
    </div>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function Leaderboard({
  entries,
  highlightId,
}: {
  entries: LeaderboardEntry[];
  highlightId?: string;
}) {
  return (
    <ol className="flex w-full flex-col gap-2">
      {entries.map((e, i) => {
        const me = e.playerId === highlightId;
        return (
          <motion.li
            key={e.playerId}
            layout
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: (entries.length - 1 - i) * 0.08 }}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-semibold backdrop-blur ${me ? 'bg-white text-brand-900 shadow-xl ring-4 ring-amber-300/70' : 'bg-white/10 text-white ring-1 ring-white/10'}`}
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base tabular-nums ${me ? 'bg-brand-100' : 'bg-white/10'}`}
            >
              {MEDALS[e.rank - 1] ?? e.rank}
            </span>
            <span className="min-w-0 flex-1 truncate">{e.nickname}</span>
            <span className="tabular-nums">{e.score.toLocaleString('tr-TR')}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** Oyun ekranlarının koyu, gradyanlı sahnesi. Arkada yavaşça süzülen şekiller vardır. */
export function GameShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-stage relative isolate flex min-h-dvh flex-col overflow-hidden text-white">
      <StageDecor />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">{children}</div>
    </div>
  );
}

export function CenteredMessage({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      {icon && (
        <motion.span
          aria-hidden
          className="text-6xl"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        >
          {icon}
        </motion.span>
      )}
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      {children}
    </div>
  );
}

/** Koyu zemindeki beyaz ana buton. */
const STAGE_BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-white py-3 font-bold text-brand-800 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.45)] transition hover:-translate-y-0.5 hover:bg-brand-50 active:translate-y-0 disabled:translate-y-0 disabled:opacity-50';
export const stageButtonClass = `${STAGE_BUTTON} px-6 text-lg`;
/** Sunucu ekranındaki büyük "Başlat / Devam" butonu. */
export const stageButtonLargeClass = `${STAGE_BUTTON} px-8 text-xl`;

/** Koyu zemindeki ikincil (çerçeveli) buton. */
export const stageGhostClass =
  'inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-lg font-bold text-white ring-1 ring-white/30 transition hover:bg-white/10';

/** Sesi açıp kapatan küçük buton. Tercih tarayıcıda hatırlanır. */
export function SoundToggle() {
  const enabled = useSoundEnabled();
  return (
    <button
      type="button"
      onClick={() => sound.setEnabled(!enabled)}
      aria-pressed={enabled}
      aria-label={enabled ? 'Sesi kapat' : 'Sesi aç'}
      title={enabled ? 'Sesi kapat' : 'Sesi aç'}
      className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15 transition hover:bg-white/20"
    >
      <span aria-hidden>{enabled ? '🔊' : '🔇'}</span>
    </button>
  );
}
