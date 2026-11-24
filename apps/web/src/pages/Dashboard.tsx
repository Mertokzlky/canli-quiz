import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { GameHistorySummary, QuizSummary } from '@canli-quiz/shared';
import { StageDecor } from '../components/StageDecor';
import {
  Alert,
  Badge,
  Button,
  buttonClass,
  Card,
  EmptyState,
  inputClass,
  Spinner,
} from '../components/ui';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatPercent, formatRelative } from '../lib/format';

const errorMessage = (err: unknown) =>
  err instanceof ApiRequestError ? err.message : 'Beklenmeyen bir hata oluştu';

type SortKey = 'recent' | 'title' | 'questions';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Son güncellenen' },
  { value: 'title', label: 'Ada göre (A-Z)' },
  { value: 'questions', label: 'Soru sayısı' },
];

/** Quiz sayısı bundan fazlaysa arama ve sıralama gösterilir. */
const SEARCH_THRESHOLD = 3;

export function DashboardPage() {
  const navigate = useNavigate();
  const [mine, setMine] = useState<QuizSummary[] | null>(null);
  const [publicQuizzes, setPublicQuizzes] = useState<QuizSummary[]>([]);
  const [games, setGames] = useState<GameHistorySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.myQuizzes(),
      api.publicQuizzes(),
      // Geçmiş yüklenemezse panel yine açılsın; sadece "son oyunlar" boş kalır.
      api.games().catch(() => [] as GameHistorySummary[]),
    ])
      .then(([own, pub, history]) => {
        if (cancelled) return;
        setMine(own);
        setPublicQuizzes(pub.filter((q) => !q.isOwner));
        setGames(history);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(err));
        setMine([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (!mine) return [];
    const q = query.trim().toLocaleLowerCase('tr-TR');
    const filtered = q
      ? mine.filter((quiz) =>
          `${quiz.title} ${quiz.description ?? ''}`.toLocaleLowerCase('tr-TR').includes(q),
        )
      : mine;
    return [...filtered].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'tr-TR');
      if (sort === 'questions') return b.questionCount - a.questionCount;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [mine, query, sort]);

  async function remove(quiz: QuizSummary) {
    if (!window.confirm(`"${quiz.title}" silinsin mi? Bu işlem geri alınamaz.`)) return;
    setBusyId(quiz.id);
    try {
      await api.deleteQuiz(quiz.id);
      setMine((list) => list?.filter((q) => q.id !== quiz.id) ?? null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function copy(quiz: QuizSummary) {
    setBusyId(quiz.id);
    try {
      const { id } = await api.copyQuiz(quiz.id);
      navigate(`/quiz/${id}/duzenle`);
    } catch (err) {
      setError(errorMessage(err));
      setBusyId(null);
    }
  }

  if (!mine) return <Spinner />;

  return (
    <div className="flex flex-col gap-10">
      <WelcomeHero quizzes={mine} games={games} />

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="flex flex-col gap-4 lg:col-span-2" aria-labelledby="quizlerim">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="quizlerim" className="text-xl font-extrabold tracking-tight text-slate-900">
              Quizlerim{' '}
              {mine.length > 0 && (
                <span className="ml-1 align-middle text-sm font-semibold text-slate-400">
                  {mine.length}
                </span>
              )}
            </h2>
            <Link to="/quiz/yeni" className={buttonClass('ghost-brand', 'sm')}>
              + Yeni quiz
            </Link>
          </div>

          {mine.length > SEARCH_THRESHOLD && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Quizlerde ara</span>
                <span
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden
                >
                  🔍
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Quizlerde ara..."
                  className={`${inputClass()} pl-10`}
                />
              </label>
              <label className="sm:w-48">
                <span className="sr-only">Sırala</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className={inputClass()}
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {mine.length === 0 ? (
            <EmptyState icon="📝" title="Henüz bir quizin yok">
              Kendi sorularını yazabilir ya da soru yazmadan{' '}
              <Link to="/quiz/hizli" className="font-semibold text-brand-600 hover:text-brand-800">
                ⚡ Hızlı quiz
              </Link>{' '}
              ile Futbol, Sinema, CS2 gibi kategorilerden saniyeler içinde quiz oluşturabilirsin.
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState icon="🔍" title="Sonuç bulunamadı">
              "{query.trim()}" ile eşleşen bir quiz yok.{' '}
              <button
                type="button"
                onClick={() => setQuery('')}
                className="font-semibold text-brand-600 hover:text-brand-800"
              >
                Aramayı temizle
              </button>
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {visible.map((quiz) => (
                <li key={quiz.id}>
                  <QuizCard quiz={quiz}>
                    <StartLink quizId={quiz.id} />
                    <Link
                      to={`/quiz/${quiz.id}/duzenle`}
                      className={buttonClass('secondary', 'sm')}
                    >
                      Düzenle
                    </Link>
                    <Button
                      variant="ghost-danger"
                      size="sm"
                      className="ml-auto"
                      disabled={busyId === quiz.id}
                      onClick={() => remove(quiz)}
                      aria-label={`${quiz.title} quizini sil`}
                      title="Sil"
                    >
                      Sil
                    </Button>
                  </QuizCard>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <QuickQuizPromo />
          <RecentGames games={games} />
        </aside>
      </div>

      {publicQuizzes.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="hazir">
          <div className="flex flex-col gap-1">
            <h2 id="hazir" className="text-xl font-extrabold tracking-tight text-slate-900">
              Hazır quizler
            </h2>
            <p className="text-slate-600">
              Hemen başlatabilir ya da kopyalayıp kendi hesabında düzenleyebilirsin.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicQuizzes.map((quiz) => (
              <li key={quiz.id}>
                <QuizCard quiz={quiz}>
                  <StartLink quizId={quiz.id} />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === quiz.id}
                    onClick={() => copy(quiz)}
                  >
                    {busyId === quiz.id ? 'Kopyalanıyor...' : 'Kopyala'}
                  </Button>
                </QuizCard>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Günün saatine göre selamlama. */
function greeting(hour: number) {
  if (hour < 6) return 'İyi geceler';
  if (hour < 12) return 'Günaydın';
  if (hour < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

function WelcomeHero({ quizzes, games }: { quizzes: QuizSummary[]; games: GameHistorySummary[] }) {
  const { user } = useAuth();
  const firstName = user?.displayName.trim().split(/\s+/)[0] ?? '';
  const totalQuestions = quizzes.reduce((sum, q) => sum + q.questionCount, 0);
  const totalPlayers = games.reduce((sum, g) => sum + g.playerCount, 0);

  const stats = [
    { icon: '📚', label: 'Quiz', value: quizzes.length },
    { icon: '❓', label: 'Soru', value: totalQuestions },
    { icon: '🎮', label: 'Oyun', value: games.length },
    { icon: '👥', label: 'Oyuncu', value: totalPlayers },
  ];

  return (
    <section
      aria-labelledby="karsilama"
      className="bg-stage relative isolate overflow-hidden rounded-3xl px-6 py-7 text-white shadow-[0_24px_48px_-20px_rgb(59_29_143/0.6)] sm:px-8 sm:py-9"
    >
      <StageDecor />
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-md flex-col gap-3">
          <p className="text-sm font-semibold text-brand-200">
            {greeting(new Date().getHours())} 👋
          </p>
          <h1
            id="karsilama"
            className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl"
          >
            {firstName ? `Hoş geldin, ${firstName}!` : 'Hoş geldin!'}
          </h1>
          <p className="text-brand-100">
            Bir quiz başlat, PIN'i paylaş; oyuncular telefonlarından saniyeler içinde katılsın.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              to="/quiz/yeni"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-50"
            >
              + Yeni quiz
            </Link>
            <Link to="/quiz/hizli" className={buttonClass('accent')}>
              ⚡ Hızlı quiz
            </Link>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[26rem] lg:grid-cols-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15 backdrop-blur-sm"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-lg"
                aria-hidden
              >
                {s.icon}
              </span>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-brand-200">{s.label}</dt>
                <dd className="text-2xl leading-tight font-extrabold tabular-nums">
                  {s.value.toLocaleString('tr-TR')}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

const PROMO_EMOJIS = ['⚽', '🎬', '🎮', '🧠', '🗺️', '🏛️', '🎵', '🐾'];

function QuickQuizPromo() {
  return (
    <Link
      to="/quiz/hizli"
      className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 p-5 text-amber-950 shadow-[0_16px_32px_-16px_rgb(245_158_11/0.8)] transition duration-200 hover:-translate-y-0.5"
    >
      <div className="grid grid-cols-8 gap-1.5" aria-hidden>
        {PROMO_EMOJIS.map((e) => (
          <span
            key={e}
            className="grid aspect-square place-items-center rounded-lg bg-white/40 text-sm transition group-hover:bg-white/60"
          >
            {e}
          </span>
        ))}
      </div>
      <div>
        <h2 className="text-lg font-extrabold">⚡ Soru yazmadan başla</h2>
        <p className="text-sm text-amber-900">
          14 kategori ve 700'den fazla hazır sorudan saniyeler içinde quiz oluştur.
        </p>
      </div>
      <span className="text-sm font-bold">
        Hızlı quiz oluştur{' '}
        <span aria-hidden className="inline-block transition group-hover:translate-x-1">
          →
        </span>
      </span>
    </Link>
  );
}

function RecentGames({ games }: { games: GameHistorySummary[] }) {
  const recent = games.slice(0, 4);
  return (
    <Card as="section" className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-extrabold tracking-tight text-slate-900">Son oyunlar</h2>
        {games.length > 0 && (
          <Link to="/gecmis" className="text-sm font-semibold text-brand-600 hover:text-brand-800">
            Tümü →
          </Link>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          🏁 Henüz biten bir oyun yok. İlk oyununu başlattığında sonuçlar burada görünür.
        </p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {recent.map((g) => (
            <li key={g.id}>
              <Link
                to={`/gecmis/${g.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-base ring-1 ring-brand-100"
                  aria-hidden
                >
                  🏆
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {g.quizTitle}
                  </span>
                  <span className="truncate text-xs text-slate-500">
                    {formatRelative(g.endedAt)} · {g.playerCount} oyuncu
                    {g.winner && ` · 🥇 ${g.winner.nickname}`}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold text-slate-700 tabular-nums">
                  {formatPercent(g.accuracy)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StartLink({ quizId }: { quizId: string }) {
  return (
    <Link to={`/sunucu/${quizId}`} className={buttonClass('primary', 'sm')}>
      ▶ Başlat
    </Link>
  );
}

/** Kartın üst şeridi için başlıktan türetilen sabit bir renk (her quiz hep aynı rengi alır). */
const CARD_ACCENTS = [
  'from-brand-500 to-fuchsia-500',
  'from-sky-500 to-brand-500',
  'from-amber-400 to-rose-500',
  'from-emerald-400 to-sky-500',
  'from-rose-500 to-brand-600',
  'from-fuchsia-500 to-amber-400',
];

function accentFor(text: string) {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CARD_ACCENTS[hash % CARD_ACCENTS.length]!;
}

function QuizCard({ quiz, children }: { quiz: QuizSummary; children: React.ReactNode }) {
  const accent = accentFor(quiz.title);
  return (
    <article className="group shadow-card hover:shadow-card-hover flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 transition duration-200 hover:-translate-y-0.5">
      <div className={`h-1.5 bg-gradient-to-r ${accent}`} aria-hidden />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-lg font-extrabold text-white shadow-sm ${accent}`}
            aria-hidden
          >
            {quiz.title.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?'}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="leading-snug font-bold break-words text-slate-900">{quiz.title}</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="brand">{quiz.questionCount} soru</Badge>
              {quiz.isOwner ? (
                <Badge tone={quiz.isPublic ? 'green' : 'neutral'}>
                  {quiz.isPublic ? 'Herkese açık' : 'Gizli'}
                </Badge>
              ) : (
                <Badge>{quiz.ownerName}</Badge>
              )}
            </div>
          </div>
        </div>
        {quiz.description && (
          <p className="line-clamp-2 text-sm text-slate-600">{quiz.description}</p>
        )}
        {quiz.isOwner && (
          <p className="text-xs text-slate-400">{formatRelative(quiz.updatedAt)} güncellendi</p>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1">{children}</div>
      </div>
    </article>
  );
}
