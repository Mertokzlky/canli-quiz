import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { PIN_LENGTH } from '@canli-quiz/shared';
import { useAuth } from '../lib/auth';

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
      setError(`PIN ${PIN_LENGTH} haneli bir sayı olmalı`);
      return;
    }
    navigate(`/oyun/${pin}`);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-indigo-700 px-4 text-white">
      <h1 className="text-5xl font-extrabold tracking-tight">Canlı Quiz</h1>

      <form className="flex w-full max-w-xs flex-col gap-3" onSubmit={onSubmit} noValidate>
        <input
          className="rounded-lg bg-white px-4 py-3 text-center text-2xl font-bold tracking-widest text-gray-900"
          placeholder="Oyun PIN'i"
          aria-label="Oyun PIN'i"
          inputMode="numeric"
          autoComplete="off"
          maxLength={PIN_LENGTH}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''));
            setError(null);
          }}
        />
        {error && (
          <p role="alert" className="rounded-lg bg-red-500/90 px-3 py-2 text-center text-sm">
            {error}
          </p>
        )}
        <button type="submit" className="rounded-lg bg-gray-900 py-3 text-lg font-bold">
          Devam
        </button>
      </form>

      <p className="text-sm text-indigo-100">
        Quiz hazırlamak mı istiyorsunuz?{' '}
        {user ? (
          <Link to="/panel" className="font-semibold text-white underline">
            Panelinize gidin
          </Link>
        ) : (
          <>
            <Link to="/giris" className="font-semibold text-white underline">
              Giriş yapın
            </Link>{' '}
            veya{' '}
            <Link to="/kayit" className="font-semibold text-white underline">
              kayıt olun
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
