import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { Button, Spinner } from './ui';

/** Menüsüz, tam ekran sayfalar (ör. sunucu ekranı) için sadece giriş kontrolü. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/giris" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

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
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="contents sm:flex sm:items-center sm:gap-6">
            <Link to="/panel" className="text-xl font-extrabold whitespace-nowrap text-indigo-700">
              Canlı Quiz
            </Link>
            <nav
              aria-label="Ana menü"
              className="order-last flex w-full gap-1 text-sm font-semibold whitespace-nowrap sm:order-none sm:w-auto"
            >
              <NavItem to="/panel">Quizlerim</NavItem>
              <NavItem to="/gecmis">Oyun geçmişi</NavItem>
            </nav>
          </div>
          <div className="flex items-center gap-2 text-sm whitespace-nowrap">
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

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-lg px-2 py-1.5 sm:px-3 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`
      }
    >
      {children}
    </NavLink>
  );
}
