import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from '@canli-quiz/shared';
import { api, ApiRequestError, SESSION_EXPIRED_EVENT, tokenStore } from './api';
import { resetSocketAuth } from './socket';

interface AuthState {
  user: PublicUser | null;
  /** Sayfa açılırken kayıtlı token kontrol edilirken true. */
  loading: boolean;
  /** Oturum kullanım sırasında geçersizleştiyse true (giriş sayfasında bilgi gösterilir). */
  sessionExpired: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Herhangi bir istek oturumun geçersiz olduğunu fark ederse kullanıcı çıkış yapmış sayılır;
  // korumalı sayfalar onu giriş sayfasına yönlendirir.
  useEffect(() => {
    const onExpired = () => {
      setSessionExpired(true);
      setUser(null);
      resetSocketAuth();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .me()
      .then(setUser)
      .catch((err) => {
        // Süresi dolmuş veya geçersiz token: sessizce çıkış yap.
        if (err instanceof ApiRequestError && err.status === 401) tokenStore.set(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = useCallback((res: AuthResponse) => {
    tokenStore.set(res.token);
    resetSocketAuth();
    setSessionExpired(false);
    setUser(res.user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      sessionExpired,
      login: async (input) => handleAuth(await api.login(input)),
      register: async (input) => handleAuth(await api.register(input)),
      logout: () => {
        tokenStore.set(null);
        resetSocketAuth();
        setUser(null);
      },
    }),
    [user, loading, sessionExpired, handleAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}
