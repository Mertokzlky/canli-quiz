import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { GameHistorySummary } from '@canli-quiz/shared';
import { Alert, Spinner } from '../components/ui';
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Oyun geçmişi</h1>
        <p className="text-sm text-gray-600">
          Sunucusu olduğunuz ve biten oyunlar. Quiz sonradan silinse de sonuçlar burada kalır.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      {games.length === 0 && !error ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center text-gray-600">
          Henüz biten bir oyununuz yok. Panelden bir quiz başlatın; oyun bittiğinde sonuçları burada
          görürsünüz.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {games.map((g) => (
            <li key={g.id}>
              <Link
                to={`/gecmis/${g.id}`}
                className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 transition hover:ring-indigo-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-gray-900">{g.quizTitle}</h2>
                  <p className="text-sm text-gray-500">{formatDateTime(g.endedAt)}</p>
                </div>
                <dl className="grid grid-cols-3 gap-4 text-sm sm:flex sm:gap-6">
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
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="truncate font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
