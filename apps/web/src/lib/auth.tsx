import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from '@canli-quiz/shared';
import { api, ApiRequestError, tokenStore } from './api';

interface AuthState {
  user: PublicUser | null;
  /** Sayfa açılırken kayıtlı token kontrol edilirken true. */
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);

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
    setUser(res.user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (input) => handleAuth(await api.login(input)),
      register: async (input) => handleAuth(await api.register(input)),
      logout: () => {
        tokenStore.set(null);
        setUser(null);
      },
    }),
    [user, loading, handleAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}
