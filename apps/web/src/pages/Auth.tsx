import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { loginSchema, registerSchema } from '@canli-quiz/shared';
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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 block text-center text-3xl font-extrabold text-indigo-700">
          Canlı Quiz
        </Link>
        <form
          onSubmit={onSubmit}
          noValidate
          className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
        >
          <h1 className="text-xl font-bold text-gray-900">
            {isRegister ? 'Hesap oluştur' : 'Giriş yap'}
          </h1>

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

          <Button type="submit" disabled={submitting} className="py-2.5">
            {submitting ? 'Lütfen bekleyin...' : isRegister ? 'Kayıt ol' : 'Giriş yap'}
          </Button>

          <p className="text-center text-sm text-gray-600">
            {isRegister ? 'Zaten hesabınız var mı? ' : 'Hesabınız yok mu? '}
            <Link
              to={isRegister ? '/giris' : '/kayit'}
              state={location.state}
              className="font-semibold text-indigo-600 hover:underline"
            >
              {isRegister ? 'Giriş yapın' : 'Kayıt olun'}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
