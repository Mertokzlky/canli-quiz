import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link, useParams } from 'react-router';
import type { HostView } from '@canli-quiz/shared';
import { JoinQrCode } from '../components/JoinQrCode';
import { ChoiceShape } from '../components/ChoiceShape';
import { QuestionImage } from '../components/QuestionImage';
import {
  CenteredMessage,
  CountdownBadge,
  GameShell,
  Leaderboard,
  SoundToggle,
  stageButtonClass,
  stageButtonLargeClass,
  stageGhostClass,
} from '../components/game';
import { LogoMark } from '../components/Logo';
import { choiceStyle, sessionValue, syncServerClock, useCountdown } from '../lib/game';
import { request, socket } from '../lib/socket';
import { sound } from '../lib/sound';
import { useWakeLock } from '../lib/wakeLock';

const hostKey = (quizId: string) => `canli-quiz:host:${quizId}`;

export function HostGamePage() {
  const { quizId = '' } = useParams();
  const [view, setView] = useState<HostView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const creating = useRef(false);
  // Projeksiyondaki ekran oyun bitene kadar uykuya geçmesin.
  useWakeLock(view !== null && view.phase !== 'ENDED');
  useHostSounds(view);

  /** Önceki oyuna dönmeyi dener, olmazsa yeni oyun açar. Her (yeniden) bağlanışta çalışır. */
  const enterGame = useCallback(async () => {
    const savedPin = sessionValue.get(hostKey(quizId));
    if (savedPin) {
      const res = await request('host:rejoin', { pin: savedPin });
      if (res.ok) return;
      sessionValue.set(hostKey(quizId), null);
    }
    if (creating.current) return;
    creating.current = true;
    const res = await request('host:create', { quizId });
    creating.current = false;
    if (res.ok) {
      sessionValue.set(hostKey(quizId), res.data.pin);
      setError(null);
    } else {
      setError(res.error);
    }
  }, [quizId]);

  useEffect(() => {
    const onConnect = () => void enterGame();
    const onView = (v: HostView) => {
      syncServerClock(v.serverNow);
      setView(v);
    };
    socket.on('host:view', onView);
    socket.on('connect', onConnect);
    if (socket.connected) onConnect();
    else socket.connect();
    return () => {
      socket.off('host:view', onView);
      socket.off('connect', onConnect);
    };
  }, [enterGame]);

  async function act(event: 'host:start' | 'host:next' | 'host:end') {
    if (!view) return;
    sound.unlock();
    setBusy(true);
    const res = await request(event, { pin: view.pin });
    setBusy(false);
    setError(res.ok ? null : res.error);
  }

  async function kick(playerId: string) {
    if (!view) return;
    const res = await request('host:kick', { pin: view.pin, playerId });
    setError(res.ok ? null : res.error);
  }

  function newGame() {
    sessionValue.set(hostKey(quizId), null);
    setView(null);
    void enterGame();
  }

  if (!view) {
    return (
      <GameShell>
        <CenteredMessage
          icon={error ? '😕' : '🎲'}
          title={error ? 'Oyun açılamadı' : 'Oyun hazırlanıyor...'}
        >
          {error && <p className="text-brand-100">{error}</p>}
          <Link to="/panel" className={stageGhostClass}>
            Panele dön
          </Link>
        </CenteredMessage>
      </GameShell>
    );
  }

  return (
    <GameShell>
      <header className="mb-6 flex items-center justify-between gap-4 text-sm text-brand-100">
        <span className="flex min-w-0 items-center gap-2.5">
          <LogoMark size={30} />
          <span className="truncate font-semibold text-white">{view.quizTitle}</span>
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="rounded-xl bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
            PIN <strong className="ml-1 text-white tabular-nums">{view.pin}</strong>
          </span>
          <SoundToggle />
          {view.phase !== 'LOBBY' && view.phase !== 'ENDED' && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Oyun şimdi bitirilsin mi?')) void act('host:end');
              }}
              className="rounded-xl px-3 py-1.5 font-semibold ring-1 ring-white/25 transition hover:bg-red-500/80 hover:ring-red-400"
            >
              Oyunu bitir
            </button>
          )}
        </div>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-500/90 px-4 py-2 text-center font-medium">
          {error}
        </p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={screenKey(view)}
          className="flex flex-1 flex-col"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.25 }}
        >
          {view.phase === 'LOBBY' && (
            <Lobby view={view} busy={busy} onStart={() => act('host:start')} onKick={kick} />
          )}
          {(view.phase === 'QUESTION' || view.phase === 'REVEAL') && (
            <QuestionScreen view={view} busy={busy} onNext={() => act('host:next')} />
          )}
          {view.phase === 'LEADERBOARD' && (
            <div className="flex flex-1 flex-col items-center gap-6">
              <h1 className="text-4xl font-extrabold tracking-tight">🏆 Sıralama</h1>
              <div className="w-full max-w-2xl">
                <Leaderboard entries={view.leaderboard} />
              </div>
              <NextButton busy={busy} onClick={() => act('host:next')}>
                Sonraki soru
              </NextButton>
            </div>
          )}
          {view.phase === 'ENDED' && <Final view={view} onNewGame={newGame} />}
        </motion.div>
      </AnimatePresence>
    </GameShell>
  );
}

function Lobby({
  view,
  busy,
  onStart,
  onKick,
}: {
  view: HostView;
  busy: boolean;
  onStart: () => void;
  onKick: (playerId: string) => void;
}) {
  const joinUrl = `${window.location.origin}/oyun/${view.pin}`;
  return (
    <div className="flex flex-1 flex-col items-center gap-8 text-center">
      <div className="flex flex-col items-center gap-6 rounded-3xl bg-white px-6 py-6 text-slate-900 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.5)] sm:flex-row sm:px-8">
        <div className="rounded-2xl bg-white p-1.5 ring-1 ring-slate-200">
          <JoinQrCode url={joinUrl} size={168} />
        </div>
        <div className="flex flex-col items-center gap-2 sm:items-start sm:text-left">
          <p className="text-base text-slate-600 sm:text-lg">
            QR kodu okutun ya da <strong className="text-slate-900">{window.location.host}</strong>{' '}
            adresinde PIN'i girin
          </p>
          <p className="bg-gradient-to-r from-brand-600 to-fuchsia-600 bg-clip-text text-6xl font-extrabold tracking-widest text-transparent tabular-nums sm:text-7xl">
            {view.pin}
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-4">
        <p className="flex items-center gap-2 text-xl font-bold">
          {view.players.length === 0 ? (
            <>
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-300" />
              </span>
              Oyuncular bekleniyor...
            </>
          ) : (
            <>
              <span className="rounded-lg bg-white/15 px-2.5 py-0.5 tabular-nums">
                {view.players.length}
              </span>
              oyuncu katıldı
            </>
          )}
        </p>
        <ul className="flex max-w-3xl flex-wrap justify-center gap-2">
          <AnimatePresence initial={false}>
            {view.players.map((p) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                className={`group flex items-center gap-1 rounded-full py-2 pr-2 pl-4 text-lg font-semibold shadow-sm ring-1 backdrop-blur ${p.connected ? 'bg-white/15 ring-white/20' : 'bg-white/5 text-white/50 line-through ring-white/5'}`}
              >
                {p.nickname}
                <button
                  type="button"
                  onClick={() => onKick(p.id)}
                  aria-label={`${p.nickname} oyuncusunu çıkar`}
                  title="Oyundan çıkar"
                  className="grid h-7 w-7 place-items-center rounded-full text-base text-white/60 hover:bg-red-500 hover:text-white focus-visible:bg-red-500"
                >
                  ✕
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {view.players.length > 0 && (
          <p className="text-sm text-brand-200/80">
            Uygunsuz bir takma ad görürseniz ✕ ile oyuncuyu çıkarabilirsiniz.
          </p>
        )}
      </div>

      <NextButton busy={busy || view.players.length === 0} onClick={onStart}>
        Başlat
      </NextButton>
    </div>
  );
}

function QuestionScreen({
  view,
  busy,
  onNext,
}: {
  view: HostView;
  busy: boolean;
  onNext: () => void;
}) {
  const question = view.question!;
  const remaining = useCountdown(question.endsAt);
  const secondsLeft = remaining === null ? null : Math.ceil(remaining / 1000);

  // Son 5 saniyede tıkırtı; son 3 saniye daha tiz.
  useEffect(() => {
    if (view.reveal || secondsLeft === null || secondsLeft <= 0 || secondsLeft > 5) return;
    sound.play(secondsLeft <= 3 ? 'tickUrgent' : 'tick');
  }, [secondsLeft, view.reveal]);
  const reveal = view.reveal;
  const totalAnswers = reveal ? Object.values(reveal.distribution).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-lg font-semibold text-brand-100">
            Soru {question.index + 1} / {question.total}
          </span>
          <div
            className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/15"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-400"
              style={{ width: `${((question.index + 1) / question.total) * 100}%` }}
            />
          </div>
        </div>
        {!reveal && remaining !== null && (
          <CountdownBadge remainingMs={remaining} totalSec={question.timeLimitSec} />
        )}
      </div>

      <motion.h1
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl bg-white px-6 py-8 text-center text-3xl font-extrabold tracking-tight text-balance text-slate-900 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.5)] sm:text-4xl"
      >
        {question.text}
      </motion.h1>

      <QuestionImage url={question.imageUrl} className="max-h-[35vh] bg-white/10" />

      <ul className="grid flex-1 gap-3 sm:grid-cols-2">
        {question.choices.map((choice, i) => {
          const style = choiceStyle(i);
          const isCorrect = reveal?.correctChoiceId === choice.id;
          const count = reveal?.distribution[choice.id] ?? 0;
          return (
            <motion.li
              key={choice.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: reveal && !isCorrect ? 0.4 : 1, y: 0 }}
              transition={{ delay: reveal ? 0 : 0.15 + i * 0.07 }}
              className={`relative flex items-center gap-4 overflow-hidden rounded-2xl px-6 py-5 text-2xl font-bold shadow-lg ${style.bg} ${isCorrect ? 'ring-4 ring-white' : ''}`}
            >
              <span
                role="img"
                aria-label={style.label}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20"
              >
                <ChoiceShape index={i} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">{choice.text}</span>
              {reveal && (
                <span className="flex items-center gap-2 rounded-xl bg-black/15 px-3 py-1 tabular-nums">
                  {isCorrect && <span aria-label="Doğru cevap">✓</span>}
                  {count}
                </span>
              )}
              {reveal && totalAnswers > 0 && (
                <motion.span
                  className="absolute bottom-0 left-0 h-2 bg-white/75"
                  initial={{ width: 0 }}
                  animate={{ width: `${(count / totalAnswers) * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              )}
            </motion.li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-4">
        <span className="rounded-xl bg-white/10 px-4 py-2 text-lg font-semibold ring-1 ring-white/15">
          <span className="tabular-nums">
            {view.answeredCount} / {view.players.filter((p) => p.connected).length}
          </span>{' '}
          <span className="text-brand-100">cevap</span>
        </span>
        <NextButton busy={busy} onClick={onNext}>
          {reveal
            ? question.index + 1 === question.total
              ? 'Sonuçlar'
              : 'Devam'
            : 'Cevabı göster'}
        </NextButton>
      </div>
    </div>
  );
}

function Final({ view, onNewGame }: { view: HostView; onNewGame: () => void }) {
  const [first, second, third] = view.leaderboard;
  // Podyum üçüncüden birinciye doğru sırayla yükselir.
  const podium = [
    {
      entry: second,
      height: 112,
      place: '🥈',
      delay: 0.6,
      color: 'from-slate-100 to-slate-300 text-slate-700',
    },
    {
      entry: first,
      height: 160,
      place: '🥇',
      delay: 1.0,
      color: 'from-amber-200 to-amber-400 text-amber-900',
    },
    {
      entry: third,
      height: 80,
      place: '🥉',
      delay: 0.2,
      color: 'from-orange-200 to-orange-400 text-orange-900',
    },
  ];
  return (
    <div className="flex flex-1 flex-col items-center gap-8">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">🎉 Oyun bitti!</h1>

      {view.leaderboard.length === 0 ? (
        <p className="text-brand-100">Kimse katılmadı.</p>
      ) : (
        <div className="flex items-end justify-center gap-3">
          {podium.map(({ entry, height, place, delay, color }) =>
            entry ? (
              <div key={place} className="flex w-28 flex-col items-center gap-2 sm:w-36">
                <motion.div
                  className="flex w-full flex-col items-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: delay + 0.4 }}
                >
                  <span className="w-full truncate text-center text-lg font-bold">
                    {entry.nickname}
                  </span>
                  <span className="text-sm text-brand-100 tabular-nums">
                    {entry.score.toLocaleString('tr-TR')}
                  </span>
                </motion.div>
                <motion.div
                  className={`grid w-full place-items-center overflow-hidden rounded-t-2xl bg-gradient-to-b text-5xl font-extrabold shadow-xl ${color}`}
                  initial={{ height: 0 }}
                  animate={{ height }}
                  transition={{ delay, duration: 0.5, ease: 'easeOut' }}
                >
                  {place}
                </motion.div>
              </div>
            ) : null,
          )}
        </div>
      )}

      {view.leaderboard.length > 3 && (
        <div className="w-full max-w-2xl">
          <Leaderboard entries={view.leaderboard.slice(3)} />
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onNewGame} className={stageButtonClass}>
          Yeniden oyna
        </button>
        <Link to="/panel" className={stageGhostClass}>
          Panele dön
        </Link>
      </div>
    </div>
  );
}

function NextButton({
  busy,
  onClick,
  children,
}: {
  busy: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className={stageButtonLargeClass}>
      {children}
    </button>
  );
}

/** Oyun aşamaları değiştikçe ses çalar. İlk görünümde (ör. sayfa yenilenince) sessiz kalır. */
function useHostSounds(view: HostView | null) {
  const previous = useRef<{ phase: string; questionIndex: number; players: number } | null>(null);

  useEffect(() => {
    if (!view) return;
    const prev = previous.current;
    const questionIndex = view.question?.index ?? -1;
    previous.current = { phase: view.phase, questionIndex, players: view.players.length };
    if (!prev) return;

    if (view.phase === 'LOBBY' && view.players.length > prev.players) sound.play('join');
    else if (
      view.phase === 'QUESTION' &&
      (prev.phase !== 'QUESTION' || prev.questionIndex !== questionIndex)
    ) {
      sound.play('start');
    } else if (view.phase === 'REVEAL' && prev.phase !== 'REVEAL') sound.play('reveal');
    else if (view.phase === 'ENDED' && prev.phase !== 'ENDED') sound.play('fanfare');
  }, [view]);
}

/** Ekran değişimini belirleyen anahtar: soru ve cevabı aynı ekranda kalır, sadece soru değişince kayar. */
function screenKey(view: HostView): string {
  switch (view.phase) {
    case 'QUESTION':
    case 'REVEAL':
      return `soru-${view.question?.index ?? 0}`;
    case 'LEADERBOARD':
      return `siralama-${view.question?.index ?? 0}`;
    default:
      return view.phase;
  }
}
