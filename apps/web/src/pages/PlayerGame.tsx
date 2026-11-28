import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Link, useParams } from 'react-router';
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  PROFANITY_MESSAGE,
  containsProfanity,
  type GameClosedReason,
  type PlayerView,
} from '@canli-quiz/shared';
import { ChoiceShape } from '../components/ChoiceShape';
import { QuestionImage } from '../components/QuestionImage';
import {
  CenteredMessage,
  CountdownBadge,
  GameShell,
  Leaderboard,
  SoundToggle,
  stageButtonClass,
} from '../components/game';
import { LogoMark } from '../components/Logo';
import { choiceStyle, sessionValue, syncServerClock, useCountdown } from '../lib/game';
import { sound, vibrate } from '../lib/sound';
import { request, socket } from '../lib/socket';

const playerKey = (pin: string) => `canli-quiz:player:${pin}`;

type Status =
  | { kind: 'connecting' }
  | { kind: 'nickname' }
  | { kind: 'playing' }
  | { kind: 'closed'; title: string; message: string };

export function PlayerGamePage() {
  const { pin = '' } = useParams();
  const [status, setStatus] = useState<Status>(() =>
    sessionValue.get(playerKey(pin)) ? { kind: 'connecting' } : { kind: 'nickname' },
  );
  const [view, setView] = useState<PlayerView | null>(null);
  usePlayerFeedback(view);

  /** Kayıtlı token varsa oyuna geri döner. Her (yeniden) bağlanışta çalışır. */
  const rejoin = useCallback(async () => {
    const token = sessionValue.get(playerKey(pin));
    if (!token) return;
    const res = await request('player:rejoin', { pin, reconnectToken: token });
    if (res.ok) {
      setStatus({ kind: 'playing' });
    } else if (res.error.includes('PIN')) {
      sessionValue.set(playerKey(pin), null);
      setStatus({ kind: 'closed', title: 'Oyun bulunamadı', message: res.error });
    } else {
      sessionValue.set(playerKey(pin), null);
      setStatus({ kind: 'nickname' });
    }
  }, [pin]);

  useEffect(() => {
    const onConnect = () => void rejoin();
    const onClosed = ({ reason, message }: { reason: GameClosedReason; message: string }) => {
      sessionValue.set(playerKey(pin), null);
      const title = reason === 'kicked' ? 'Oyundan çıkarıldınız' : 'Oyun kapandı';
      setStatus({ kind: 'closed', title, message });
    };
    const onView = (v: PlayerView) => {
      syncServerClock(v.serverNow);
      setView(v);
    };
    socket.on('player:view', onView);
    socket.on('game:closed', onClosed);
    socket.on('connect', onConnect);
    if (socket.connected) onConnect();
    else socket.connect();
    return () => {
      socket.off('player:view', onView);
      socket.off('game:closed', onClosed);
      socket.off('connect', onConnect);
    };
  }, [pin, rejoin]);

  if (status.kind === 'closed') {
    return (
      <GameShell>
        <CenteredMessage
          icon={status.title === 'Oyundan çıkarıldınız' ? '🚪' : '👋'}
          title={status.title}
        >
          <p className="max-w-sm text-brand-100">{status.message}</p>
          <Link to="/" className={stageButtonClass}>
            Ana sayfaya dön
          </Link>
        </CenteredMessage>
      </GameShell>
    );
  }

  if (status.kind === 'nickname') {
    return <NicknameForm pin={pin} onJoined={() => setStatus({ kind: 'playing' })} />;
  }

  if (!view) {
    return (
      <GameShell>
        <CenteredMessage icon="📡" title="Bağlanılıyor..." />
      </GameShell>
    );
  }

  return (
    <GameShell>
      <header className="mb-6 flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2 rounded-xl bg-white/10 py-1 pr-3 pl-1 ring-1 ring-white/15">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15 font-bold">
            {view.me.nickname.charAt(0).toLocaleUpperCase('tr-TR')}
          </span>
          <span className="truncate font-semibold">{view.me.nickname}</span>
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-amber-300 px-3 py-1.5 font-bold text-amber-950 tabular-nums">
            {view.me.score.toLocaleString('tr-TR')} puan
          </span>
          <SoundToggle />
        </div>
      </header>
      <PlayerScreen view={view} />
    </GameShell>
  );
}

function NicknameForm({ pin, onJoined }: { pin: string; onJoined: () => void }) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const name = nickname.trim();
    if (name.length < NICKNAME_MIN_LENGTH) {
      setError(`Takma ad en az ${NICKNAME_MIN_LENGTH} karakter olmalı`);
      return;
    }
    // Sunucu da kontrol eder; burada sadece anında geri bildirim için.
    if (containsProfanity(name)) {
      setError(PROFANITY_MESSAGE);
      return;
    }
    setBusy(true);
    sound.unlock();
    if (!socket.connected) socket.connect();
    const res = await request('player:join', { pin, nickname: name });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    sessionValue.set(playerKey(pin), res.data.reconnectToken);
    onJoined();
  }

  return (
    <GameShell>
      <form
        onSubmit={onSubmit}
        className="animate-rise m-auto flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-white p-5 text-slate-900 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.5)] sm:p-6"
      >
        <div className="flex flex-col items-center gap-2 pb-1 text-center">
          <LogoMark size={44} />
          <p className="text-sm font-medium text-slate-500">
            Oyun PIN'i{' '}
            <strong className="rounded-md bg-brand-50 px-1.5 py-0.5 text-brand-700 tabular-nums">
              {pin}
            </strong>
          </p>
        </div>
        <input
          autoFocus
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={NICKNAME_MAX_LENGTH}
          placeholder="Takma adın"
          aria-label="Takma adın"
          className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-2xl font-bold text-slate-900 transition outline-none placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
        />
        {error && (
          <p role="alert" className="text-center text-sm font-medium text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="bg-brand-gradient shadow-glow rounded-2xl py-3.5 text-lg font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? 'Katılınıyor...' : 'Oyuna katıl'}
        </button>
        <Link
          to="/"
          className="text-center text-sm font-medium text-slate-500 hover:text-brand-700"
        >
          Farklı bir PIN gir
        </Link>
      </form>
    </GameShell>
  );
}

function PlayerScreen({ view }: { view: PlayerView }) {
  switch (view.phase) {
    case 'LOBBY':
      return (
        <CenteredMessage icon="🎉" title="Oyundasın!">
          <p className="text-lg text-brand-100">
            Adın sunucu ekranında görünüyor. Oyunun başlamasını bekle.
          </p>
          <p className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/15">
            👥 {view.playerCount} oyuncu katıldı
          </p>
        </CenteredMessage>
      );
    case 'QUESTION':
      return <AnswerScreen view={view} />;
    case 'REVEAL':
      return <ResultScreen view={view} />;
    case 'LEADERBOARD':
      return (
        <div className="flex flex-1 flex-col items-center gap-6">
          <p className="text-2xl font-extrabold">
            {view.me.rank}. sıradasın <span className="text-brand-200">/ {view.playerCount}</span>
          </p>
          <Leaderboard entries={view.leaderboard} highlightId={view.me.id} />
          <p className="text-brand-100">Sonraki soru birazdan...</p>
        </div>
      );
    case 'ENDED':
      return (
        <div className="flex flex-1 flex-col items-center gap-6">
          <CenteredMessage
            icon={view.me.rank !== null && view.me.rank <= 3 ? '🏆' : '🏁'}
            title="Oyun bitti!"
          >
            <p className="bg-gradient-to-b from-amber-200 to-amber-400 bg-clip-text text-6xl font-extrabold text-transparent">
              {view.me.rank}.
            </p>
            <p className="text-lg text-brand-100">
              {view.me.score.toLocaleString('tr-TR')} puanla {view.playerCount} oyuncu arasında
            </p>
          </CenteredMessage>
          <Leaderboard entries={view.leaderboard} highlightId={view.me.id} />
          <Link to="/" className={stageButtonClass}>
            Ana sayfaya dön
          </Link>
        </div>
      );
  }
}

function AnswerScreen({ view }: { view: PlayerView }) {
  const question = view.question!;
  const remaining = useCountdown(question.endsAt);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const chosenId = view.myChoiceId ?? pendingId;

  async function choose(choiceId: string) {
    if (chosenId) return;
    sound.unlock();
    vibrate(30);
    setPendingId(choiceId);
    setError(null);
    const res = await request('player:answer', { pin: view.pin, choiceId });
    if (!res.ok) {
      setPendingId(null);
      setError(res.error);
    }
  }

  if (chosenId) {
    const index = question.choices.findIndex((c) => c.id === chosenId);
    const style = choiceStyle(index);
    return (
      <CenteredMessage title="Cevabın alındı">
        <span
          className={`grid h-24 w-24 place-items-center rounded-3xl shadow-xl ${style.bg}`}
          role="img"
          aria-label={style.label}
        >
          <ChoiceShape index={index} className="h-11 w-11" />
        </span>
        <p className="text-brand-100">Diğer oyuncular bekleniyor...</p>
      </CenteredMessage>
    );
  }

  if (remaining === 0) return <CenteredMessage icon="⏰" title="Süre doldu" />;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-brand-100">
          Soru {question.index + 1} / {question.total}
        </p>
        {remaining !== null && (
          <CountdownBadge remainingMs={remaining} totalSec={question.timeLimitSec} />
        )}
      </div>
      <p className="rounded-2xl bg-white/10 px-4 py-4 text-center text-xl font-bold text-balance ring-1 ring-white/15">
        {question.text}
      </p>
      <QuestionImage url={question.imageUrl} className="max-h-[25vh]" />
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-500/90 px-3 py-2 text-center text-sm font-medium"
        >
          {error}
        </p>
      )}
      <div className="grid flex-1 grid-cols-2 gap-3">
        {question.choices.map((choice, i) => {
          const style = choiceStyle(i);
          return (
            <motion.button
              key={choice.id}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => choose(choice.id)}
              className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl p-3 text-lg font-bold shadow-lg ${style.bg}`}
            >
              <span
                className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20"
                aria-hidden
              >
                <ChoiceShape index={i} className="h-6 w-6" />
              </span>
              <span className="break-words">{choice.text}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function ResultScreen({ view }: { view: PlayerView }) {
  const result = view.result;
  if (!result) return <CenteredMessage icon="🥁" title="Cevap açıklanıyor..." />;

  const title = !result.answered ? 'Cevap vermedin' : result.correct ? 'Doğru! 🎉' : 'Yanlış';
  return (
    <div
      className={`-mx-4 -my-6 flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center ${result.correct ? 'bg-gradient-to-b from-emerald-500 to-green-700' : 'bg-gradient-to-b from-rose-500 to-red-700'}`}
    >
      <motion.span
        aria-hidden
        className="grid h-24 w-24 place-items-center rounded-full bg-white/20 text-5xl ring-4 ring-white/30"
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14 }}
      >
        {!result.answered ? '⌛' : result.correct ? '✓' : '✕'}
      </motion.span>
      <motion.h1
        className="text-4xl font-extrabold"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
      >
        {title}
      </motion.h1>
      {result.correct && (
        <p className="rounded-2xl bg-white/20 px-5 py-2 text-3xl font-extrabold tabular-nums">
          +{result.pointsEarned.toLocaleString('tr-TR')}
        </p>
      )}
      {result.streak >= 2 && (
        <p className="rounded-full bg-amber-300 px-4 py-1.5 text-base font-bold text-amber-950">
          🔥 {result.streak} soru üst üste doğru
        </p>
      )}
      <p className="font-medium text-white/85">
        Toplam: {result.totalScore.toLocaleString('tr-TR')} puan · {view.me.rank}. sıra
      </p>
    </div>
  );
}

/**
 * Yeni soru gelince kısa titreşim, sonuç açıklanınca doğru/yanlış sesi ve titreşimi.
 * İlk görünümde (sayfa yenilenince) tetiklenmez.
 */
function usePlayerFeedback(view: PlayerView | null) {
  const previous = useRef<{ phase: string; questionIndex: number } | null>(null);

  useEffect(() => {
    if (!view) return;
    const prev = previous.current;
    const questionIndex = view.question?.index ?? -1;
    previous.current = { phase: view.phase, questionIndex };
    if (!prev) return;

    if (
      view.phase === 'QUESTION' &&
      (prev.phase !== 'QUESTION' || prev.questionIndex !== questionIndex)
    ) {
      vibrate(40);
    } else if (view.phase === 'REVEAL' && prev.phase !== 'REVEAL' && view.result) {
      if (view.result.correct) {
        sound.play('correct');
        vibrate(80);
      } else {
        sound.play('wrong');
        vibrate([60, 60, 60]);
      }
    } else if (view.phase === 'ENDED' && prev.phase !== 'ENDED') {
      sound.play('fanfare');
    }
  }, [view]);
}
