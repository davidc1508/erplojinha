import { createContext, useEffect, useMemo, useState } from 'react';
import { authApi, subscribeToUnauthorized } from '../services/api';
import type { AuthResponse } from '../services/types';

interface AuthContextValue {
  session: AuthResponse | null;
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<void>;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function clearAllAuthStorage() {
  localStorage.removeItem('lojinha-token');
  localStorage.removeItem('lojinha-session');
  localStorage.removeItem('lojinha-original-token');
  localStorage.removeItem('lojinha-original-session');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthResponse | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('lojinha-session');
    if (raw) {
      setSession(JSON.parse(raw) as AuthResponse);
    }

    return subscribeToUnauthorized(() => {
      clearAllAuthStorage();
      setSession(null);
    });
  }, []);

  const isImpersonating = Boolean(session?.isImpersonating);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isImpersonating,
    login: async (email: string, password: string) => {
      const nextSession = await authApi.login(email, password);
      localStorage.removeItem('lojinha-original-token');
      localStorage.removeItem('lojinha-original-session');
      localStorage.setItem('lojinha-token', nextSession.token);
      localStorage.setItem('lojinha-session', JSON.stringify(nextSession));
      setSession(nextSession);
    },
    startImpersonation: async (userId: string) => {
      const currentToken = localStorage.getItem('lojinha-token');
      const currentSessionRaw = localStorage.getItem('lojinha-session');

      if (!currentToken || !currentSessionRaw) {
        throw new Error('Sessão atual inválida para acessar como.');
      }

      if (!localStorage.getItem('lojinha-original-token')) {
        localStorage.setItem('lojinha-original-token', currentToken);
        localStorage.setItem('lojinha-original-session', currentSessionRaw);
      }

      const nextSession = await authApi.impersonate(userId);
      localStorage.setItem('lojinha-token', nextSession.token);
      localStorage.setItem('lojinha-session', JSON.stringify(nextSession));
      setSession(nextSession);
    },
    stopImpersonation: () => {
      const originalToken = localStorage.getItem('lojinha-original-token');
      const originalSessionRaw = localStorage.getItem('lojinha-original-session');

      if (!originalToken || !originalSessionRaw) {
        clearAllAuthStorage();
        setSession(null);
        return;
      }

      localStorage.setItem('lojinha-token', originalToken);
      localStorage.setItem('lojinha-session', originalSessionRaw);
      localStorage.removeItem('lojinha-original-token');
      localStorage.removeItem('lojinha-original-session');
      setSession(JSON.parse(originalSessionRaw) as AuthResponse);
    },
    logout: () => {
      clearAllAuthStorage();
      setSession(null);
    }
  }), [isImpersonating, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}