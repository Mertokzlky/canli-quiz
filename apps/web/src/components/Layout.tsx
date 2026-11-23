import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { Button, Spinner } from './ui';

/** Giriş yapılmış sayfaların ortak çerçevesi: üst menü ve içerik alanı. */
export function AppLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/giris" replace state={{ from: location.pathname }} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/panel" className="text-xl font-extrabold text-indigo-700">
            Canlı Quiz
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-gray-600 sm:inline">{user.displayName}</span>
            <Button
              variant="ghost"
              onClick={() => {
                logout();
                navigate('/');
              }}
            >
              Çıkış yap
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
