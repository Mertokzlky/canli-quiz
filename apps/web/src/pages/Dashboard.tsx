import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { QuizSummary } from '@canli-quiz/shared';
import {
  Alert,
  Badge,
  Button,
  buttonClass,
  EmptyState,
  PageHeader,
  Spinner,
} from '../components/ui';
import { api, ApiRequestError } from '../lib/api';

const errorMessage = (err: unknown) =>
  err instanceof ApiRequestError ? err.message : 'Beklenmeyen bir hata oluştu';

export function DashboardPage() {
  const navigate = useNavigate();
  const [mine, setMine] = useState<QuizSummary[] | null>(null);
  const [publicQuizzes, setPublicQuizzes] = useState<QuizSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.myQuizzes(), api.publicQuizzes()])
      .then(([own, pub]) => {
        if (cancelled) return;
        setMine(own);
        setPublicQuizzes(pub.filter((q) => !q.isOwner));
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
    <div className="flex flex-col gap-12">
      {error && <Alert>{error}</Alert>}

      <section className="flex flex-col gap-5">
        <PageHeader
          title="Quizlerim"
          description="Quizlerini düzenle, tek tıkla başlat. Oyuncular telefonlarından PIN ile katılır."
          actions={
            <>
              <Link to="/quiz/hizli" className={buttonClass('accent')}>
                ⚡ Hızlı quiz
              </Link>
              <Link to="/quiz/yeni" className={buttonClass('primary')}>
                + Yeni quiz
              </Link>
            </>
          }
        />

        {mine.length === 0 ? (
          <EmptyState icon="📝" title="Henüz bir quizin yok">
            Kendi sorularını yazabilir ya da soru yazmadan{' '}
            <Link to="/quiz/hizli" className="font-semibold text-brand-600 hover:text-brand-800">
              ⚡ Hızlı quiz
            </Link>{' '}
            ile Futbol, Sinema, CS2 gibi kategorilerden saniyeler içinde quiz oluşturabilirsin.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((quiz) => (
              <li key={quiz.id}>
                <QuizCard quiz={quiz}>
                  <StartLink quizId={quiz.id} />
                  <Link to={`/quiz/${quiz.id}/duzenle`} className={buttonClass('secondary', 'sm')}>
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

      {publicQuizzes.length > 0 && (
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Hazır quizler</h2>
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
        <div className="mt-auto flex items-center gap-2 pt-2">{children}</div>
      </div>
    </article>
  );
}
