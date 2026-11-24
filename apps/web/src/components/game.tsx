import type { LeaderboardEntry } from '@canli-quiz/shared';
import { sound, useSoundEnabled } from '../lib/sound';

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
      className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(${urgent ? '#f87171' : '#ffffff'} ${ratio * 360}deg, rgba(255,255,255,0.2) 0deg)`,
      }}
      role="timer"
      aria-label={`${seconds} saniye kaldı`}
    >
      <span className="grid h-13 w-13 place-items-center rounded-full bg-indigo-800 text-2xl font-extrabold text-white tabular-nums">
        {seconds}
      </span>
    </div>
  );
}

export function Leaderboard({
  entries,
  highlightId,
}: {
  entries: LeaderboardEntry[];
  highlightId?: string;
}) {
  return (
    <ol className="flex w-full flex-col gap-2">
      {entries.map((e) => (
        <li
          key={e.playerId}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-lg font-semibold ${e.playerId === highlightId ? 'bg-white text-indigo-800' : 'bg-white/10 text-white'}`}
        >
          <span className="w-8 text-center tabular-nums">{e.rank}.</span>
          <span className="min-w-0 flex-1 truncate">{e.nickname}</span>
          <span className="tabular-nums">{e.score.toLocaleString('tr-TR')}</span>
        </li>
      ))}
    </ol>
  );
}

export function GameShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-indigo-700 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">{children}</div>
    </div>
  );
}

export function CenteredMessage({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      {children}
    </div>
  );
}

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
      className="grid h-8 w-8 place-items-center rounded-lg ring-1 ring-white/40 hover:bg-white/10"
    >
      <span aria-hidden>{enabled ? '🔊' : '🔇'}</span>
    </button>
  );
}
