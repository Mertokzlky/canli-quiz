import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { QUICK_QUIZ_SIZES, type BankCategory, type BankDifficulty } from '@canli-quiz/shared';
import { Alert, Button, Card, PageHeader, Spinner } from '../components/ui';
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
      <PageHeader
        back={{ to: '/panel', label: 'Panele dön' }}
        title="⚡ Hızlı quiz"
        description="Kategorileri seç, sorular hazır bankadan rastgele gelsin. Her oluşturuşta farklı sorular ve farklı şık sıraları çıkar."
      />

      {error && <Alert>{error}</Alert>}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold text-slate-900">Kategoriler</h2>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              Seçimi temizle
            </button>
          )}
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {categories.map((c) => {
            const active = selected.includes(c.slug);
            return (
              <li key={c.slug}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(c.slug)}
                  className={`relative flex h-full w-full flex-col items-start gap-2 rounded-2xl p-4 text-left transition duration-150 active:scale-[0.98] ${active ? 'bg-brand-50 shadow-glow ring-2 ring-brand-500' : 'shadow-card hover:shadow-card-hover bg-white ring-1 ring-slate-200/70 hover:-translate-y-0.5'}`}
                >
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-xl text-2xl transition ${active ? 'bg-white' : 'bg-slate-50'}`}
                    aria-hidden
                  >
                    {c.emoji}
                  </span>
                  <span className="font-bold text-slate-900">{c.name}</span>
                  <span className="text-xs font-medium text-slate-500">
                    {c.counts.total} soru · {c.counts.zor} zor
                  </span>
                  {active && (
                    <span
                      className="bg-brand-gradient absolute top-3 right-3 grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white"
                      aria-hidden
                    >
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Card as="section" className="grid gap-6 p-5 sm:grid-cols-2">
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
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/70 bg-white/85 shadow-[0_-8px_24px_-12px_rgb(15_23_42/0.15)] backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm font-medium text-slate-600">
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
      <legend className="mb-2 font-bold text-slate-900">{label}</legend>
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
      className={`min-w-12 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-95 ${active ? 'bg-brand-gradient shadow-glow text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300'}`}
    >
      {children}
    </button>
  );
}
