import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH, type PlayerView } from '@canli-quiz/shared';
import { CenteredMessage, CountdownBadge, GameShell, Leaderboard } from '../components/game';
import { choiceStyle, sessionValue, syncServerClock, useCountdown } from '../lib/game';
import { request, socket } from '../lib/socket';

const playerKey = (pin: string) => `canli-quiz:player:${pin}`;

type Status =
  | { kind: 'connecting' }
  | { kind: 'nickname' }
  | { kind: 'playing' }
  | { kind: 'closed'; message: string };

export function PlayerGamePage() {
  const { pin = '' } = useParams();
  const [status, setStatus] = useState<Status>(() =>
    sessionValue.get(playerKey(pin)) ? { kind: 'connecting' } : { kind: 'nickname' },
  );
  const [view, setView] = useState<PlayerView | null>(null);

  /** Kayıtlı token varsa oyuna geri döner. Her (yeniden) bağlanışta çalışır. */
  const rejoin = useCallback(async () => {
    const token = sessionValue.get(playerKey(pin));
    if (!token) return;
    const res = await request('player:rejoin', { pin, reconnectToken: token });
    if (res.ok) {
      setStatus({ kind: 'playing' });
    } else if (res.error.includes('PIN')) {
      sessionValue.set(playerKey(pin), null);
      setStatus({ kind: 'closed', message: res.error });
    } else {
      sessionValue.set(playerKey(pin), null);
      setStatus({ kind: 'nickname' });
    }
  }, [pin]);

  useEffect(() => {
    const onConnect = () => void rejoin();
    const onClosed = ({ message }: { message: string }) => {
      sessionValue.set(playerKey(pin), null);
      setStatus({ kind: 'closed', message });
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
        <CenteredMessage title="Oyun bulunamadı">
          <p className="text-indigo-100">{status.message}</p>
          <Link to="/" className="rounded-xl bg-white px-6 py-3 font-bold text-indigo-700">
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
        <CenteredMessage title="Bağlanılıyor..." />
      </GameShell>
    );
  }

  return (
    <GameShell>
      <header className="mb-6 flex items-center justify-between text-sm text-indigo-100">
        <span className="truncate font-semibold">{view.me.nickname}</span>
        <span className="tabular-nums">{view.me.score.toLocaleString('tr-TR')} puan</span>
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
    setBusy(true);
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
      <form onSubmit={onSubmit} className="m-auto flex w-full max-w-xs flex-col gap-3">
        <p className="text-center text-indigo-100">
          PIN: <strong className="text-white tabular-nums">{pin}</strong>
        </p>
        <input
          autoFocus
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={NICKNAME_MAX_LENGTH}
          placeholder="Takma adın"
          aria-label="Takma adın"
          className="rounded-lg bg-white px-4 py-3 text-center text-2xl font-bold text-gray-900"
        />
        {error && (
          <p role="alert" className="rounded-lg bg-red-500/90 px-3 py-2 text-center text-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-gray-900 py-3 text-lg font-bold disabled:opacity-60"
        >
          {busy ? 'Katılınıyor...' : 'Oyuna katıl'}
        </button>
        <Link to="/" className="text-center text-sm text-indigo-100 underline">
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
        <CenteredMessage title="Oyundasın!">
          <p className="text-lg text-indigo-100">
            Adın sunucu ekranında görünüyor. Oyunun başlamasını bekle.
          </p>
          <p className="text-sm text-indigo-200">{view.playerCount} oyuncu katıldı</p>
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
            {view.me.rank}. sıradasın <span className="text-indigo-200">/ {view.playerCount}</span>
          </p>
          <Leaderboard entries={view.leaderboard} highlightId={view.me.id} />
          <p className="text-indigo-100">Sonraki soru birazdan...</p>
        </div>
      );
    case 'ENDED':
      return (
        <div className="flex flex-1 flex-col items-center gap-6">
          <CenteredMessage title="Oyun bitti!">
            <p className="text-5xl font-extrabold">{view.me.rank}.</p>
            <p className="text-lg text-indigo-100">
              {view.me.score.toLocaleString('tr-TR')} puanla {view.playerCount} oyuncu arasında
            </p>
          </CenteredMessage>
          <Leaderboard entries={view.leaderboard} highlightId={view.me.id} />
          <Link to="/" className="rounded-xl bg-white px-6 py-3 font-bold text-indigo-700">
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
          className={`grid h-24 w-24 place-items-center rounded-2xl text-5xl ${style.bg}`}
          aria-label={style.label}
        >
          {style.shape}
        </span>
        <p className="text-indigo-100">Diğer oyuncular bekleniyor...</p>
      </CenteredMessage>
    );
  }

  if (remaining === 0) return <CenteredMessage title="Süre doldu ⏰" />;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-indigo-100">
          Soru {question.index + 1} / {question.total}
        </p>
        {remaining !== null && (
          <CountdownBadge remainingMs={remaining} totalSec={question.timeLimitSec} />
        )}
      </div>
      <p className="text-center text-xl font-bold">{question.text}</p>
      {error && (
        <p role="alert" className="rounded-lg bg-red-500/90 px-3 py-2 text-center text-sm">
          {error}
        </p>
      )}
      <div className="grid flex-1 grid-cols-2 gap-3">
        {question.choices.map((choice, i) => {
          const style = choiceStyle(i);
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => choose(choice.id)}
              className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl p-3 text-lg font-bold shadow-lg active:scale-95 ${style.bg}`}
            >
              <span className="text-4xl" aria-hidden>
                {style.shape}
              </span>
              <span className="break-words">{choice.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultScreen({ view }: { view: PlayerView }) {
  const result = view.result;
  if (!result) return <CenteredMessage title="Cevap açıklanıyor..." />;

  const title = !result.answered ? 'Cevap vermedin' : result.correct ? 'Doğru! 🎉' : 'Yanlış';
  return (
    <div
      className={`-mx-4 -my-6 flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center ${result.correct ? 'bg-green-600' : 'bg-red-600'}`}
    >
      <h1 className="text-4xl font-extrabold">{title}</h1>
      {result.correct && (
        <p className="text-2xl font-bold tabular-nums">
          +{result.pointsEarned.toLocaleString('tr-TR')}
        </p>
      )}
      {result.streak >= 2 && <p className="text-lg">🔥 {result.streak} soru üst üste doğru</p>}
      <p className="text-white/80">
        Toplam: {result.totalScore.toLocaleString('tr-TR')} puan · {view.me.rank}. sıra
      </p>
    </div>
  );
}
