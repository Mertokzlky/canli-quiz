import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { GameHistoryDetail, QuestionStat } from '@canli-quiz/shared';
import {
  Alert,
  BackLink as BaseBackLink,
  Badge,
  Button,
  buttonClass,
  Card,
  PageHeader,
  Spinner,
} from '../components/ui';
import { api, ApiRequestError } from '../lib/api';
import { formatDateTime, formatDuration, formatPercent } from '../lib/format';

/** Sorudaki oyunculardan doğru bilenlerin oranı. */
const correctRate = (s: QuestionStat) => (s.playerCount === 0 ? 0 : s.correct / s.playerCount);

export function GameHistoryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameHistoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .game(id)
      .then((g) => {
        if (!cancelled) setGame(g);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiRequestError ? err.message : 'Oyun yüklenemedi');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function remove() {
    if (!window.confirm('Bu oyunun sonuçları kalıcı olarak silinsin mi? Bu işlem geri alınamaz.')) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteGame(id);
      navigate('/gecmis', { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Oyun silinemedi');
      setDeleting(false);
    }
  }

  if (error && !game) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert>{error}</Alert>
        <BackLink />
      </div>
    );
  }
  if (!game) return <Spinner />;

  const played = game.questionStats;
  // En az bir soru oynandıysa en düşük doğru oranlı soru "en zor" olarak işaretlenir.
  const hardest =
    played.length > 1
      ? played.reduce((min, s, i) => (correctRate(s) < correctRate(played[min]!) ? i : min), 0)
      : -1;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        back={{ to: '/gecmis', label: 'Oyun geçmişine dön' }}
        title={game.quizTitle}
        description={formatDateTime(game.endedAt)}
        actions={
          <>
            {game.quizId ? (
              <Link to={`/sunucu/${game.quizId}`} className={buttonClass('primary')}>
                ▶ Tekrar oyna
              </Link>
            ) : (
              <span className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-500">
                Quiz silinmiş
              </span>
            )}
            <Button variant="danger" onClick={remove} disabled={deleting}>
              {deleting ? 'Siliniyor...' : 'Sil'}
            </Button>
          </>
        }
      />

      {error && <Alert>{error}</Alert>}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard icon="👥" label="Oyuncu" value={String(game.playerCount)} />
        <SummaryCard
          icon="❓"
          label="Oynanan soru"
          value={`${game.playedQuestionCount} / ${game.questionCount}`}
        />
        <SummaryCard icon="🎯" label="Doğru oranı" value={formatPercent(game.accuracy)} />
        <SummaryCard icon="⏱️" label="Süre" value={formatDuration(game.durationSec)} />
      </dl>

      <section className="flex flex-col gap-3" aria-labelledby="sonuclar">
        <h2 id="sonuclar" className="text-xl font-extrabold tracking-tight text-slate-900">
          Sonuçlar
        </h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Sıra
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Oyuncu
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Doğru
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Puan
                </th>
              </tr>
            </thead>
            <tbody>
              {game.results.map((r) => (
                <tr
                  key={`${r.rank}-${r.nickname}`}
                  className={`border-b border-slate-100 last:border-0 ${r.rank === 1 ? 'bg-amber-50/60' : ''}`}
                >
                  <td className="px-4 py-3 font-semibold text-slate-900 tabular-nums">
                    {MEDALS[r.rank - 1] ?? `${r.rank}.`}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.nickname}</td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                    {r.correctCount} / {game.playedQuestionCount}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                    {r.score.toLocaleString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="sorular">
        <div>
          <h2 id="sorular" className="text-xl font-extrabold tracking-tight text-slate-900">
            Soru bazında sonuçlar
          </h2>
          <p className="text-sm text-slate-600">
            Düşük oranlı sorular, konunun tekrar edilmesi gereken yerlerini gösterir.
          </p>
        </div>
        {played.length === 0 ? (
          <p className="text-sm text-slate-500">Bu oyunda hiçbir soru tamamlanmadı.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {played.map((s, i) => (
              <QuestionStatRow key={i} index={i} stat={s} isHardest={i === hardest} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function QuestionStatRow({
  index,
  stat,
  isHardest,
}: {
  index: number;
  stat: QuestionStat;
  isHardest: boolean;
}) {
  const rate = correctRate(stat);
  const unanswered = stat.playerCount - stat.answered;
  const barColor = rate >= 0.7 ? 'bg-green-500' : rate >= 0.4 ? 'bg-amber-400' : 'bg-red-500';

  return (
    <Card
      as="li"
      className={`flex flex-col gap-3 p-5 ${isHardest ? 'border-l-4 border-red-400' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex gap-2.5 font-semibold text-slate-900">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
            {index + 1}
          </span>
          <span className="pt-0.5">{stat.text}</span>
        </p>
        {isHardest && <Badge tone="red">🔥 En zor soru</Badge>}
      </div>
      <p className="text-sm text-slate-600">
        Doğru cevap: <strong className="text-slate-900">{stat.correctChoice}</strong>
      </p>
      <div className="flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${rate * 100}%` }} />
        </div>
        <span className="w-12 text-right text-sm font-semibold text-slate-900 tabular-nums">
          {formatPercent(rate)}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        {stat.correct} / {stat.playerCount} doğru
        {unanswered > 0 && ` · ${unanswered} cevapsız`}
        {stat.avgCorrectMs !== null &&
          ` · doğru bilenler ortalama ${(stat.avgCorrectMs / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} sn`}
      </p>
    </Card>
  );
}

function SummaryCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <dt className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span
          className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-sm ring-1 ring-brand-100"
          aria-hidden
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd className="text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums">
        {value}
      </dd>
    </Card>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

function BackLink() {
  return <BaseBackLink to="/gecmis">Oyun geçmişine dön</BaseBackLink>;
}
