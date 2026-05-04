import { createContext, useEffect, useMemo, useState } from 'react';
import { authApi, subscribeToUnauthorized } from '../services/api';
import type { AuthResponse } from '../services/types';

interface AuthContextValue {
  session: AuthResponse | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthResponse | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('lojinha-session');
    if (raw) {
      setSession(JSON.parse(raw) as AuthResponse);
    }

    return subscribeToUnauthorized(() => {
      setSession(null);
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    login: async (email: string, password: string) => {
      const nextSession = await authApi.login(email, password);
      localStorage.setItem('lojinha-token', nextSession.token);
      localStorage.setItem('lojinha-session', JSON.stringify(nextSession));
      setSession(nextSession);
    },
    logout: () => {
      localStorage.removeItem('lojinha-token');
      localStorage.removeItem('lojinha-session');
      setSession(null);
    }
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}