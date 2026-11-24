import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { Logo } from './Logo';
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
    <div className="bg-app min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="contents sm:flex sm:items-center sm:gap-8">
            <Link to="/panel" aria-label="Canlı Quiz paneli" className="rounded-lg">
              <Logo size={30} />
            </Link>
            <nav
              aria-label="Ana menü"
              className="order-last -mx-1 flex w-full gap-1 text-sm font-semibold whitespace-nowrap sm:order-none sm:mx-0 sm:w-auto"
            >
              <NavItem to="/panel" icon="📚">
                Quizlerim
              </NavItem>
              <NavItem to="/gecmis" icon="📊">
                Oyun geçmişi
              </NavItem>
            </nav>
          </div>
          <div className="flex items-center gap-2 text-sm whitespace-nowrap">
            <span className="hidden items-center gap-2 font-medium text-slate-700 sm:flex">
              <span
                className="bg-brand-gradient grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-white"
                aria-hidden
              >
                {user.displayName.trim().charAt(0).toLocaleUpperCase('tr-TR')}
              </span>
              {user.displayName}
            </span>
            <Button
              variant="ghost"
              size="sm"
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
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon, children }: { to: string; icon: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${isActive ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`
      }
    >
      <span aria-hidden>{icon}</span>
      {children}
    </NavLink>
  );
}
