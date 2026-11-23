import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { QuizSummary } from '@canli-quiz/shared';
import { Alert, Button, Spinner } from '../components/ui';
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
    <div className="flex flex-col gap-10">
      {error && <Alert>{error}</Alert>}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Quizlerim</h1>
          <Link
            to="/quiz/yeni"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Yeni quiz
          </Link>
        </div>

        {mine.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center text-gray-600">
            Henüz bir quiziniz yok. Yeni bir tane oluşturun ya da aşağıdaki hazır quizlerden birini
            kopyalayarak başlayın.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {mine.map((quiz) => (
              <li key={quiz.id}>
                <QuizCard quiz={quiz}>
                  <StartLink quizId={quiz.id} />
                  <Link
                    to={`/quiz/${quiz.id}/duzenle`}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50"
                  >
                    Düzenle
                  </Link>
                  <Button
                    variant="danger"
                    className="px-3 py-1.5"
                    disabled={busyId === quiz.id}
                    onClick={() => remove(quiz)}
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
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Hazır quizler</h2>
            <p className="text-sm text-gray-600">
              Hemen başlatabilir ya da kopyalayıp kendi hesabınızda düzenleyebilirsiniz.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {publicQuizzes.map((quiz) => (
              <li key={quiz.id}>
                <QuizCard quiz={quiz}>
                  <StartLink quizId={quiz.id} />
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5"
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
    <Link
      to={`/sunucu/${quizId}`}
      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
    >
      ▶ Başlat
    </Link>
  );
}

function QuizCard({ quiz, children }: { quiz: QuizSummary; children: React.ReactNode }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{quiz.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${quiz.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
        >
          {quiz.isPublic ? 'Herkese açık' : 'Gizli'}
        </span>
      </div>
      {quiz.description && <p className="text-sm text-gray-600">{quiz.description}</p>}
      <p className="mt-auto text-xs text-gray-500">
        {quiz.questionCount} soru{!quiz.isOwner && ` · ${quiz.ownerName}`}
      </p>
      <div className="flex gap-2">{children}</div>
    </article>
  );
}
