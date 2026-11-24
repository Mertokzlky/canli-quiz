import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { loginSchema, registerSchema } from '@canli-quiz/shared';
import { StageDecor } from '../components/StageDecor';
import { Logo } from '../components/Logo';
import { Alert, Button, TextField } from '../components/ui';
import { ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { zodFieldErrors } from '../lib/errors';

type Mode = 'login' | 'register';

export function AuthPage({ mode }: { mode: Mode }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/panel';

  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const isRegister = mode === 'register';
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = isRegister ? registerSchema.safeParse(form) : loginSchema.safeParse(form);
    if (!parsed.success) {
      setFields(zodFieldErrors(parsed.error));
      return;
    }
    setFields({});
    setSubmitting(true);
    try {
      if (isRegister) await register(registerSchema.parse(form));
      else await login(loginSchema.parse(form));
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFields(err.fields);
      } else {
        setError('Beklenmeyen bir hata oluştu');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="bg-stage relative isolate hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <StageDecor />
        <Link to="/" aria-label="Ana sayfa" className="self-start rounded-lg">
          <Logo tone="light" size={36} />
        </Link>
        <div className="flex flex-col gap-6">
          <h2 className="text-4xl font-extrabold tracking-tight text-balance">
            Quizini hazırla, salonu coştur.
          </h2>
          <ul className="flex flex-col gap-3 text-brand-100">
            <li className="flex items-center gap-3">
              <Feature icon="⚡" /> 14 kategoride 700'den fazla hazır soru
            </li>
            <li className="flex items-center gap-3">
              <Feature icon="📱" /> Oyuncular telefondan, hesap açmadan katılır
            </li>
            <li className="flex items-center gap-3">
              <Feature icon="📊" /> Her oyundan sonra soru bazında istatistikler
            </li>
          </ul>
        </div>
        <p className="text-sm text-brand-200">Tamamen ücretsiz.</p>
      </aside>

      <main className="bg-app flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <Link to="/" aria-label="Ana sayfa" className="self-center rounded-lg lg:hidden">
            <Logo size={38} />
          </Link>
          <form
            onSubmit={onSubmit}
            noValidate
            className="shadow-card flex flex-col gap-5 rounded-3xl bg-white p-6 ring-1 ring-slate-200/70 sm:p-8"
          >
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                {isRegister ? 'Hesap oluştur' : 'Tekrar hoş geldin'}
              </h1>
              <p className="text-sm text-slate-500">
                {isRegister
                  ? 'Birkaç saniyede kendi quizlerini hazırlamaya başla.'
                  : 'Quizlerine ulaşmak için giriş yap.'}
              </p>
            </div>

            {error && <Alert>{error}</Alert>}

            {isRegister && (
              <TextField
                id="displayName"
                label="Adınız"
                autoComplete="name"
                value={form.displayName}
                onChange={set('displayName')}
                error={fields.displayName}
              />
            )}
            <TextField
              id="email"
              label="E-posta"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              error={fields.email}
            />
            <TextField
              id="password"
              label="Şifre"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={set('password')}
              error={fields.password}
            />

            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? 'Lütfen bekleyin...' : isRegister ? 'Kayıt ol' : 'Giriş yap'}
            </Button>

            <p className="text-center text-sm text-slate-600">
              {isRegister ? 'Zaten hesabınız var mı? ' : 'Hesabınız yok mu? '}
              <Link
                to={isRegister ? '/giris' : '/kayit'}
                state={location.state}
                className="font-semibold text-brand-600 hover:text-brand-800"
              >
                {isRegister ? 'Giriş yapın' : 'Kayıt olun'}
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon }: { icon: string }) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15"
      aria-hidden
    >
      {icon}
    </span>
  );
}
