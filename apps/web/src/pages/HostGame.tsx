import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { HostView } from '@canli-quiz/shared';
import { JoinQrCode } from '../components/JoinQrCode';
import { QuestionImage } from '../components/QuestionImage';
import {
  CenteredMessage,
  CountdownBadge,
  GameShell,
  Leaderboard,
  SoundToggle,
} from '../components/game';
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
        <CenteredMessage title={error ? 'Oyun açılamadı' : 'Oyun hazırlanıyor...'}>
          {error && <p className="text-indigo-100">{error}</p>}
          <Link to="/panel" className="font-semibold underline">
            Panele dön
          </Link>
        </CenteredMessage>
      </GameShell>
    );
  }

  return (
    <GameShell>
      <header className="mb-6 flex items-center justify-between gap-4 text-sm text-indigo-100">
        <span className="truncate font-semibold">{view.quizTitle}</span>
        <div className="flex items-center gap-4">
          <span>
            PIN: <strong className="text-white tabular-nums">{view.pin}</strong>
          </span>
          <SoundToggle />
          {view.phase !== 'LOBBY' && view.phase !== 'ENDED' && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Oyun şimdi bitirilsin mi?')) void act('host:end');
              }}
              className="rounded-lg px-3 py-1 ring-1 ring-white/40 hover:bg-white/10"
            >
              Oyunu bitir
            </button>
          )}
        </div>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-500/90 px-4 py-2 text-center">
          {error}
        </p>
      )}

      {view.phase === 'LOBBY' && (
        <Lobby view={view} busy={busy} onStart={() => act('host:start')} onKick={kick} />
      )}
      {(view.phase === 'QUESTION' || view.phase === 'REVEAL') && (
        <QuestionScreen view={view} busy={busy} onNext={() => act('host:next')} />
      )}
      {view.phase === 'LEADERBOARD' && (
        <div className="flex flex-1 flex-col items-center gap-6">
          <h1 className="text-4xl font-extrabold">Sıralama</h1>
          <div className="w-full max-w-2xl">
            <Leaderboard entries={view.leaderboard} />
          </div>
          <NextButton busy={busy} onClick={() => act('host:next')}>
            Sonraki soru
          </NextButton>
        </div>
      )}
      {view.phase === 'ENDED' && <Final view={view} onNewGame={newGame} />}
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
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-white px-6 py-6 text-indigo-800 shadow-xl sm:flex-row sm:px-8">
        <div className="rounded-xl bg-white p-1 ring-1 ring-indigo-100">
          <JoinQrCode url={joinUrl} size={168} />
        </div>
        <div className="flex flex-col items-center gap-2 sm:items-start sm:text-left">
          <p className="text-base sm:text-lg">
            QR kodu okutun ya da <strong>{window.location.host}</strong> adresinde PIN'i girin
          </p>
          <p className="text-6xl font-extrabold tracking-widest tabular-nums sm:text-7xl">
            {view.pin}
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-4">
        <p className="text-xl font-semibold">
          {view.players.length === 0
            ? 'Oyuncular bekleniyor...'
            : `${view.players.length} oyuncu katıldı`}
        </p>
        <ul className="flex max-w-3xl flex-wrap justify-center gap-2">
          {view.players.map((p) => (
            <li
              key={p.id}
              className={`group flex items-center gap-1 rounded-full py-2 pr-2 pl-4 text-lg font-semibold ${p.connected ? 'bg-white/15' : 'bg-white/5 text-white/50 line-through'}`}
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
            </li>
          ))}
        </ul>
        {view.players.length > 0 && (
          <p className="text-sm text-indigo-200">
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
        <span className="text-lg font-semibold text-indigo-100">
          Soru {question.index + 1} / {question.total}
        </span>
        {!reveal && remaining !== null && (
          <CountdownBadge remainingMs={remaining} totalSec={question.timeLimitSec} />
        )}
      </div>

      <h1 className="rounded-2xl bg-white px-6 py-8 text-center text-3xl font-bold text-gray-900 shadow-xl sm:text-4xl">
        {question.text}
      </h1>

      <QuestionImage url={question.imageUrl} className="max-h-[35vh] bg-white/10" />

      <ul className="grid flex-1 gap-3 sm:grid-cols-2">
        {question.choices.map((choice, i) => {
          const style = choiceStyle(i);
          const isCorrect = reveal?.correctChoiceId === choice.id;
          const count = reveal?.distribution[choice.id] ?? 0;
          return (
            <li
              key={choice.id}
              className={`relative flex items-center gap-4 overflow-hidden rounded-2xl px-6 py-5 text-2xl font-bold transition ${style.bg} ${reveal && !isCorrect ? 'opacity-40' : ''}`}
            >
              <span aria-label={style.label}>{style.shape}</span>
              <span className="min-w-0 flex-1">{choice.text}</span>
              {reveal && (
                <span className="flex items-center gap-2 tabular-nums">
                  {isCorrect && <span aria-label="Doğru cevap">✓</span>}
                  {count}
                </span>
              )}
              {reveal && totalAnswers > 0 && (
                <span
                  className="absolute inset-x-0 bottom-0 h-1.5 bg-white/70"
                  style={{ width: `${(count / totalAnswers) * 100}%` }}
                />
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-4">
        <span className="text-lg text-indigo-100">
          {view.answeredCount} / {view.players.filter((p) => p.connected).length} cevap
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
  const podium = [
    { entry: second, height: 'h-28', place: '2' },
    { entry: first, height: 'h-40', place: '1' },
    { entry: third, height: 'h-20', place: '3' },
  ];
  return (
    <div className="flex flex-1 flex-col items-center gap-8">
      <h1 className="text-4xl font-extrabold">Oyun bitti!</h1>

      {view.leaderboard.length === 0 ? (
        <p className="text-indigo-100">Kimse katılmadı.</p>
      ) : (
        <div className="flex items-end justify-center gap-3">
          {podium.map(({ entry, height, place }) =>
            entry ? (
              <div key={place} className="flex w-28 flex-col items-center gap-2 sm:w-36">
                <span className="w-full truncate text-center text-lg font-bold">
                  {entry.nickname}
                </span>
                <span className="text-sm tabular-nums text-indigo-100">
                  {entry.score.toLocaleString('tr-TR')}
                </span>
                <div
                  className={`grid w-full place-items-center rounded-t-xl bg-white text-4xl font-extrabold text-indigo-700 ${height}`}
                >
                  {place}
                </div>
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
        <button
          type="button"
          onClick={onNewGame}
          className="rounded-xl bg-white px-6 py-3 text-lg font-bold text-indigo-700 hover:bg-indigo-50"
        >
          Yeniden oyna
        </button>
        <Link
          to="/panel"
          className="rounded-xl px-6 py-3 text-lg font-bold ring-1 ring-white/50 hover:bg-white/10"
        >
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
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-xl bg-white px-8 py-3 text-xl font-bold text-indigo-700 shadow-lg hover:bg-indigo-50 disabled:opacity-50"
    >
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
