import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { GameHistorySummary } from '@canli-quiz/shared';
import { Alert, EmptyState, PageHeader, Spinner } from '../components/ui';
import { api, ApiRequestError } from '../lib/api';
import { formatDateTime, formatPercent } from '../lib/format';

export function GameHistoryPage() {
  const [games, setGames] = useState<GameHistorySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .games()
      .then((list) => {
        if (!cancelled) setGames(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err.message : 'Oyun geçmişi yüklenemedi');
        setGames([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!games) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Oyun geçmişi"
        description="Sunucusu olduğun ve biten oyunlar. Quiz sonradan silinse de sonuçlar burada kalır."
      />

      {error && <Alert>{error}</Alert>}

      {games.length === 0 && !error ? (
        <EmptyState icon="🏁" title="Henüz biten bir oyunun yok">
          Panelden bir quiz başlat; oyun bittiğinde sonuçları ve soru bazında istatistikleri burada
          görürsün.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {games.map((g) => (
            <li key={g.id}>
              <Link
                to={`/gecmis/${g.id}`}
                className="group shadow-card hover:shadow-card-hover flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 transition duration-200 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-xl ring-1 ring-brand-100"
                    aria-hidden
                  >
                    🏆
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-slate-900 group-hover:text-brand-700">
                      {g.quizTitle}
                    </h2>
                    <p className="text-sm text-slate-500">{formatDateTime(g.endedAt)}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-4 rounded-xl bg-slate-50 px-4 py-2.5 text-sm sm:flex sm:gap-8 sm:bg-transparent sm:p-0">
                  <Stat label="Oyuncu" value={String(g.playerCount)} />
                  <Stat label="Doğru oranı" value={formatPercent(g.accuracy)} />
                  <Stat label="Kazanan" value={g.winner?.nickname ?? '—'} />
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="truncate font-bold text-slate-900">{value}</dd>
    </div>
  );
}
