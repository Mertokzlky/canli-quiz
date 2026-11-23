import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PIN_LENGTH } from '@canli-quiz/shared';
import { useAuth } from '../lib/auth';
import { socket } from '../lib/socket';

export function HomePage() {
  const { user } = useAuth();
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-indigo-700 px-4 text-white">
      <h1 className="text-5xl font-extrabold tracking-tight">Canlı Quiz</h1>

      <form className="flex w-full max-w-xs flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
        <input
          className="rounded-lg bg-white px-4 py-3 text-center text-2xl font-bold tracking-widest text-gray-900"
          placeholder="Oyun PIN'i"
          aria-label="Oyun PIN'i"
          inputMode="numeric"
          maxLength={PIN_LENGTH}
        />
        <button
          type="submit"
          disabled
          className="rounded-lg bg-gray-900 py-3 text-lg font-bold disabled:opacity-60"
        >
          Katıl (yakında)
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

      <p className="flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
        {connected ? 'Sunucuya bağlı' : 'Sunucuya bağlanılamadı'}
      </p>
    </main>
  );
}
