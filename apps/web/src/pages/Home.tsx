import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { PIN_LENGTH } from '@canli-quiz/shared';
import { StageDecor } from '../components/StageDecor';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';

const STEPS = [
  { icon: '🔢', title: "PIN'i gir", text: 'Sunucu ekranındaki kodu yaz ya da QR kodu okut.' },
  { icon: '😎', title: 'Takma adını seç', text: 'Hesap açmana gerek yok, telefonun yeter.' },
  { icon: '⚡', title: 'Hızlı ol', text: 'Doğru ve hızlı cevap daha çok puan getirir.' },
];

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
    <div className="bg-stage relative isolate flex min-h-dvh flex-col overflow-hidden text-white">
      <StageDecor />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5">
        <Logo tone="light" size={34} />
        <nav className="flex items-center gap-2 text-sm font-semibold">
          {user ? (
            <Link
              to="/panel"
              className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 transition hover:bg-white/20"
            >
              Panelim →
            </Link>
          ) : (
            <>
              <Link
                to="/giris"
                className="rounded-xl px-3 py-2 text-brand-100 transition hover:bg-white/10 hover:text-white"
              >
                Giriş yap
              </Link>
              <Link
                to="/kayit"
                className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 transition hover:bg-white/20"
              >
                Kayıt ol
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-4 pt-6 pb-16">
        <div className="animate-rise flex flex-col items-center gap-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-100 uppercase ring-1 ring-white/15">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
            </span>
            Gerçek zamanlı bilgi yarışması
          </span>
          <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
            Bilgini yarıştır,{' '}
            <span className="bg-gradient-to-r from-amber-200 via-rose-200 to-fuchsia-200 bg-clip-text text-transparent">
              canlı oyna.
            </span>
          </h1>
          <p className="max-w-md text-base text-brand-100 sm:text-lg">
            Sınıfınla, arkadaşlarınla ya da ekibinle aynı anda yarış. Katılmak için sadece PIN
            yeter.
          </p>
        </div>

        <form
          className="animate-rise flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-white p-5 text-slate-900 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.5)] [animation-delay:100ms] sm:p-6"
          onSubmit={onSubmit}
          noValidate
        >
          <label htmlFor="pin" className="text-center text-sm font-semibold text-slate-500">
            Oyuna katıl
          </label>
          <input
            id="pin"
            className={`rounded-2xl border-2 bg-slate-50 px-4 py-3.5 text-center text-3xl font-extrabold tracking-[0.3em] text-slate-900 transition outline-none placeholder:text-xl placeholder:font-bold placeholder:tracking-normal placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 ${error ? 'border-red-400' : 'border-slate-200'}`}
            placeholder="Oyun PIN'i"
            inputMode="numeric"
            autoComplete="off"
            maxLength={PIN_LENGTH}
            value={pin}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'pin-error' : undefined}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
              setError(null);
            }}
          />
          {error && (
            <p id="pin-error" role="alert" className="text-center text-sm font-medium text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="bg-brand-gradient shadow-glow rounded-2xl py-3.5 text-lg font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
          >
            Oyuna katıl →
          </button>
        </form>

        <ol className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="animate-rise flex items-start gap-3 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 backdrop-blur-sm"
              style={{ animationDelay: `${250 + i * 80}ms` }}
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-xl"
                aria-hidden
              >
                {step.icon}
              </span>
              <div>
                <p className="font-bold">
                  <span className="text-brand-300">{i + 1}.</span> {step.title}
                </p>
                <p className="text-sm text-brand-100/80">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-center text-sm text-brand-100">
          Quiz hazırlamak mı istiyorsunuz?{' '}
          {user ? (
            <Link to="/panel" className="font-semibold text-white underline underline-offset-4">
              Panelinize gidin
            </Link>
          ) : (
            <Link to="/kayit" className="font-semibold text-white underline underline-offset-4">
              Ücretsiz hesap açın
            </Link>
          )}{' '}
          — 700'den fazla hazır soruyla saniyeler içinde başlayın.
        </p>
      </main>
    </div>
  );
}
