import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { QUICK_QUIZ_SIZES, type BankCategory, type BankDifficulty } from '@canli-quiz/shared';
import { Alert, Button, Spinner } from '../components/ui';
import { api, ApiRequestError } from '../lib/api';

type Difficulty = 'karisik' | BankDifficulty;

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'karisik', label: 'Karışık' },
  { value: 'kolay', label: 'Kolay' },
  { value: 'orta', label: 'Orta' },
  { value: 'zor', label: 'Zor' },
];

export function QuickQuizPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<BankCategory[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('karisik');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'start' | 'edit' | null>(null);

  useEffect(() => {
    api
      .bankCategories()
      .then(setCategories)
      .catch(() => {
        setError('Kategoriler yüklenemedi');
        setCategories([]);
      });
  }, []);

  if (!categories) return <Spinner />;

  const available = categories
    .filter((c) => selected.includes(c.slug))
    .reduce(
      (sum, c) => sum + (difficulty === 'karisik' ? c.counts.total : c.counts[difficulty]),
      0,
    );

  const toggle = (slug: string) =>
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));

  async function create(then: 'start' | 'edit') {
    if (selected.length === 0) {
      setError('En az bir kategori seçin');
      return;
    }
    setBusy(then);
    setError(null);
    try {
      const { id } = await api.quickQuiz({
        categories: selected,
        questionCount: count,
        difficulty,
      });
      navigate(then === 'start' ? `/sunucu/${id}` : `/quiz/${id}/duzenle`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Quiz oluşturulamadı');
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex flex-col gap-1">
        <Link to="/panel" className="text-sm font-semibold text-indigo-600 hover:underline">
          ← Panele dön
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">⚡ Hızlı quiz</h1>
        <p className="text-gray-600">
          Kategorileri seçin, sorular hazır bankadan rastgele gelsin. Her oluşturuşta farklı sorular
          ve farklı şık sıraları çıkar.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-gray-900">Kategoriler</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {categories.map((c) => {
            const active = selected.includes(c.slug);
            return (
              <li key={c.slug}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(c.slug)}
                  className={`flex h-full w-full flex-col items-start gap-1 rounded-2xl p-4 text-left ring-2 transition ${active ? 'bg-indigo-50 ring-indigo-600' : 'bg-white ring-gray-200 hover:ring-gray-300'}`}
                >
                  <span className="text-2xl" aria-hidden>
                    {c.emoji}
                  </span>
                  <span className="font-semibold text-gray-900">{c.name}</span>
                  <span className="text-xs text-gray-500">{c.counts.total} soru</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <OptionGroup label="Soru sayısı">
          {QUICK_QUIZ_SIZES.map((n) => (
            <Chip key={n} active={count === n} onClick={() => setCount(n)}>
              {n}
            </Chip>
          ))}
        </OptionGroup>
        <OptionGroup label="Zorluk">
          {DIFFICULTIES.map((d) => (
            <Chip
              key={d.value}
              active={difficulty === d.value}
              onClick={() => setDifficulty(d.value)}
            >
              {d.label}
            </Chip>
          ))}
        </OptionGroup>
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-gray-600">
            {selected.length === 0
              ? 'Kategori seçin'
              : available < count
                ? `Bu seçimde ${available} soru var, hepsi kullanılacak`
                : `${count} soru, ${selected.length} kategoriden`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={busy !== null || selected.length === 0}
              onClick={() => create('edit')}
            >
              {busy === 'edit' ? 'Oluşturuluyor...' : 'Oluştur ve düzenle'}
            </Button>
            <Button
              disabled={busy !== null || selected.length === 0}
              onClick={() => create('start')}
            >
              {busy === 'start' ? 'Oluşturuluyor...' : '▶ Oluştur ve başlat'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-semibold text-gray-900">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ring-1 ${active ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-gray-700 ring-gray-300 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  );
}
