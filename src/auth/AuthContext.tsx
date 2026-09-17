import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isDemo } from '../data';
import { getSupabase } from '../data/supabaseClient';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; userId: string; email: string };

type Methods = {
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<string | null>;
  updatePassword(password: string): Promise<string | null>;
};

const Ctx = createContext<(AuthState & Methods) | null>(null);

const DEMO: AuthState = { status: 'signedIn', userId: 'demo', email: 'demo@example.com' };

function translate(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email o password errati';
  if (/rate limit/i.test(message)) return 'Troppi tentativi, riprova tra qualche minuto';
  if (/password should be at least/i.test(message)) return 'La password deve avere almeno 6 caratteri';
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(isDemo ? DEMO : { status: 'loading' });

  useEffect(() => {
    if (isDemo) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setAuth(u ? { status: 'signedIn', userId: u.id, email: u.email ?? '' } : { status: 'signedOut' });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setAuth(u ? { status: 'signedIn', userId: u.id, email: u.email ?? '' } : { status: 'signedOut' });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const methods = useMemo<Methods>(() => {
    if (isDemo) {
      return {
        signIn: async () => null,
        signOut: async () => {},
        resetPassword: async () => null,
        updatePassword: async () => null,
      };
    }
    const supabase = getSupabase();
    return {
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? translate(error.message) : null;
      },
      async signOut() { await supabase.auth.signOut(); },
      async resetPassword(email) {
        const redirectTo = `${window.location.origin}${window.location.pathname}#/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        return error ? translate(error.message) : null;
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        return error ? translate(error.message) : null;
      },
    };
  }, []);

  const value = useMemo(() => ({ ...auth, ...methods }), [auth, methods]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
